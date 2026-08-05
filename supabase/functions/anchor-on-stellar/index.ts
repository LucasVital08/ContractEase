// ───────────────────────────────────────────────────────────────────────
// Ancoragem de hash de contrato na Stellar
//
// [CRIT] Antes: função totalmente anônima. Consequências:
//   - Qualquer um consumia o XLM da conta custodial (STELLAR_SECRET_KEY),
//     drenando o saldo com transações de spam.
//   - `contractId` vinha do corpo e era aplicado com service_role, ou seja,
//     sem RLS: dava para marcar QUALQUER contrato como `status='active'` e
//     sobrescrever `contract_hash`/`stellar_tx_hash` de terceiros — destruindo
//     a prova de existência que é o núcleo do produto.
//
// Agora: exige JWT válido, confirma que o caller é dono/parte do contrato e
// valida o formato do hash antes de gastar qualquer fee.
// ───────────────────────────────────────────────────────────────────────

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import * as StellarSdk from 'https://esm.sh/@stellar/stellar-sdk@15';
import {
  handler,
  jsonResponse,
  requireUser,
  requireContractAccess,
  serviceClient,
  isUuid,
  HttpError,
} from '../_shared/security.ts';

/** Hash SHA-256 em hex: 64 caracteres. Memo.hash exige exatamente isso. */
const SHA256_HEX = /^[0-9a-f]{64}$/i;

Deno.serve(handler(async (req) => {
  const user = await requireUser(req);

  const secretKey = Deno.env.get('STELLAR_SECRET_KEY');
  if (!secretKey) {
    throw new HttpError(500, 'stellar_key_not_configured', 'STELLAR_SECRET_KEY não configurada.');
  }

  const { contractId, contractHash, network } = await req.json();

  if (!contractHash || !SHA256_HEX.test(String(contractHash))) {
    throw new HttpError(400, 'invalid_contract_hash', 'contractHash precisa ser SHA-256 em hex (64 chars).');
  }

  const supabase = serviceClient();

  // A ancoragem sempre pertence a um contrato: sem isso a função vira uma
  // torneira aberta de transações pagas pelo sponsor.
  if (!isUuid(contractId)) {
    throw new HttpError(400, 'invalid_contract_id', 'contractId é obrigatório.');
  }
  await requireContractAccess(supabase, contractId, user);

  // Só a testnet é liberada por padrão. Ir para mainnet gasta XLM real, então
  // exige uma decisão explícita de operação (ALLOW_MAINNET_ANCHOR=true).
  const wantsMainnet = network === 'mainnet';
  if (wantsMainnet && Deno.env.get('ALLOW_MAINNET_ANCHOR') !== 'true') {
    throw new HttpError(403, 'mainnet_disabled', 'Ancoragem em mainnet desabilitada nesta instância.');
  }
  const isTestnet = !wantsMainnet;

  const horizonUrl = isTestnet ? 'https://horizon-testnet.stellar.org' : 'https://horizon.stellar.org';
  const networkPassphrase = isTestnet ? StellarSdk.Networks.TESTNET : StellarSdk.Networks.PUBLIC;

  let keypair: StellarSdk.Keypair;
  try {
    keypair = StellarSdk.Keypair.fromSecret(secretKey);
  } catch {
    throw new HttpError(500, 'invalid_stellar_key', 'STELLAR_SECRET_KEY em formato inválido.');
  }

  const server = new StellarSdk.Horizon.Server(horizonUrl);

  let account;
  try {
    account = await server.loadAccount(keypair.publicKey());
  } catch (accErr) {
    // Não expomos a chave pública custodial nem detalhes da Horizon ao cliente.
    console.error('[anchor-on-stellar] falha ao carregar conta custodial:', accErr);
    throw new HttpError(502, 'custodial_account_unavailable', 'Conta custodial indisponível.');
  }

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: keypair.publicKey(),
        asset: StellarSdk.Asset.native(),
        amount: '0.0000001',
      }),
    )
    .addMemo(StellarSdk.Memo.hash(contractHash))
    .setTimeout(30)
    .build();

  tx.sign(keypair);

  let result;
  try {
    result = await server.submitTransaction(tx);
  } catch (submitErr: unknown) {
    console.error('[anchor-on-stellar] Stellar rejeitou a transação:', submitErr);
    throw new HttpError(502, 'stellar_rejected', 'A rede Stellar rejeitou a transação.');
  }

  const { error: updateError } = await supabase
    .from('contracts')
    .update({
      stellar_tx_hash: result.hash,
      contract_hash: contractHash,
      status: 'active',
    })
    .eq('id', contractId);

  if (updateError) {
    console.error('[anchor-on-stellar] falha ao atualizar DB:', updateError);
    return jsonResponse(req, 200, {
      success: true,
      txHash: result.hash,
      ledger: result.ledger,
      warning: 'Ancorado na Stellar, mas houve falha ao atualizar o registro.',
    });
  }

  return jsonResponse(req, 200, {
    success: true,
    txHash: result.hash,
    ledger: result.ledger,
    network: isTestnet ? 'testnet' : 'mainnet',
  });
}));
