/**
 * Registro único de carteiras.
 *
 * Toda a aplicação passa por aqui. A tela nunca pergunta "é MetaMask ou
 * Freighter?" — ela pergunta "qual é a carteira ativa?" e manda assinar.
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import { metamaskProvider } from './metamask';
import { freighterProvider } from './freighter';
import { appWalletProvider } from './app';
import type {
  StellarNetwork,
  WalletAccount,
  WalletProvider,
  WalletProviderId,
} from './types';
import { WalletError } from './types';

export * from './types';
export { metamaskProvider, freighterProvider, appWalletProvider };

/** Ordem de exibição na tela de conexão — a recomendada primeiro. */
export const WALLET_PROVIDERS: WalletProvider[] = [
  metamaskProvider,
  freighterProvider,
  appWalletProvider,
];

export function getProvider(id: WalletProviderId): WalletProvider {
  const provider = WALLET_PROVIDERS.find((p) => p.meta.id === id);
  if (!provider) throw new WalletError(id, `Carteira desconhecida: ${id}`);
  return provider;
}

// ─── Rede ──────────────────────────────────────────────────────────────

const HORIZON = {
  testnet: 'https://horizon-testnet.stellar.org',
  mainnet: 'https://horizon.stellar.org',
} as const;

export function horizonUrl(network: StellarNetwork) {
  return HORIZON[network];
}

export function networkPassphrase(network: StellarNetwork) {
  return network === 'testnet' ? StellarSdk.Networks.TESTNET : StellarSdk.Networks.PUBLIC;
}

export function explorerAccountUrl(address: string, network: StellarNetwork = 'testnet') {
  const seg = network === 'testnet' ? 'testnet' : 'public';
  return `https://stellar.expert/explorer/${seg}/account/${address}`;
}

export function explorerTxUrl(hash: string, network: StellarNetwork = 'testnet') {
  const seg = network === 'testnet' ? 'testnet' : 'public';
  return `https://stellar.expert/explorer/${seg}/tx/${hash}`;
}

export function friendbotUrl(address: string) {
  return `https://friendbot.stellar.org/?addr=${encodeURIComponent(address)}`;
}

/** Encurta G...ABCD para GABC…WXYZ — endereço inteiro não cabe em botão. */
export function shortenAddress(address: string, prefix = 4, suffix = 4): string {
  if (!address || address.length <= prefix + suffix + 3) return address;
  return `${address.slice(0, prefix)}…${address.slice(-suffix)}`;
}

// ─── Estado da conta on-chain ──────────────────────────────────────────

export interface AccountStatus {
  /** A conta existe na rede? Stellar exige um depósito inicial pra existir. */
  exists: boolean;
  /** Saldo nativo em XLM (usado para pagar as taxas de rede). */
  xlm: string;
}

export async function getAccountStatus(
  address: string,
  network: StellarNetwork = 'testnet',
): Promise<AccountStatus> {
  const server = new StellarSdk.Horizon.Server(horizonUrl(network));
  try {
    const account = await server.loadAccount(address);
    const native = account.balances.find((b) => b.asset_type === 'native');
    return { exists: true, xlm: native?.balance ?? '0' };
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) return { exists: false, xlm: '0' };
    throw err;
  }
}

/**
 * Cria + financia a conta na rede de testes (Friendbot da SDF).
 * Só existe na testnet: é dinheiro de mentira, feito para desenvolvimento.
 */
export async function fundTestnetAccount(address: string): Promise<void> {
  const endpoints = [
    `https://horizon-testnet.stellar.org/friendbot?addr=${encodeURIComponent(address)}`,
    `https://friendbot.stellar.org/?addr=${encodeURIComponent(address)}`,
  ];
  const failures: string[] = [];
  for (const url of endpoints) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
      const text = await res.text();
      // Conta já criada não é erro — é o estado desejado.
      if (/createAccountAlreadyExist|op_already_exists/i.test(text)) return;
      failures.push(`${res.status}`);
    } catch (err) {
      failures.push((err as Error)?.message ?? 'rede');
    }
  }
  throw new WalletError(
    'app',
    `Não deu para liberar o saldo de teste (${failures.join(', ')}).`,
    `Abra ${friendbotUrl(address)} em outra aba e depois clique em "Atualizar saldo".`,
  );
}

// ─── Assinatura + envio ────────────────────────────────────────────────

export interface SubmitResult {
  hash: string;
  ledger?: number;
}

/**
 * Assina um XDR com a carteira indicada e envia para a rede.
 * Erros do Horizon são traduzidos para linguagem humana — o usuário comum não
 * deve ver `tx_insufficient_balance` e ficar sem saber o que fazer.
 */
export async function signAndSubmit(
  providerId: WalletProviderId,
  xdr: string,
  network: StellarNetwork = 'testnet',
): Promise<SubmitResult> {
  const provider = getProvider(providerId);
  const signedXdr = await provider.signXdr(xdr, network);
  const server = new StellarSdk.Horizon.Server(horizonUrl(network));
  const tx = StellarSdk.TransactionBuilder.fromXDR(signedXdr, networkPassphrase(network));

  try {
    const result = await server.submitTransaction(tx);
    return { hash: (result as { hash: string }).hash, ledger: (result as { ledger?: number }).ledger };
  } catch (err) {
    throw new WalletError(providerId, ...translateHorizonError(err));
  }
}

function translateHorizonError(err: unknown): [string, string] {
  const codes = (err as { response?: { data?: { extras?: { result_codes?: Record<string, unknown> } } } })
    ?.response?.data?.extras?.result_codes;
  const primary = String(codes?.transaction ?? '');

  if (primary.includes('tx_insufficient_balance')) {
    return ['Saldo insuficiente para pagar a taxa da rede.', 'Adicione XLM à carteira — na rede de testes, use o botão de saldo grátis.'];
  }
  if (primary.includes('tx_bad_auth')) {
    return ['A assinatura não bateu com a conta.', 'Confirme que a carteira conectada é a mesma que assinou.'];
  }
  if (primary.includes('tx_bad_seq')) {
    return ['A transação ficou desatualizada.', 'Tente novamente — vamos montar uma transação nova.'];
  }
  if (primary.includes('tx_too_late')) {
    return ['A transação expirou antes de ser confirmada.', 'Tente de novo e assine mais rápido na carteira.'];
  }
  const message = (err as Error)?.message ?? String(err);
  return [`A rede recusou a transação: ${message}`, 'Confira a rede selecionada na carteira e tente novamente.'];
}

// ─── Ancoragem de documento ────────────────────────────────────────────

/**
 * Grava a impressão digital (hash) de um documento na blockchain.
 *
 * Como funciona: uma transação mínima da conta para ela mesma, carregando o
 * hash no memo. O documento em si nunca sai do app — só a prova de que ele
 * existia naquele instante. Isso é o que torna a assinatura verificável por
 * qualquer pessoa, sem depender do ContractEase.
 */
export async function anchorDocumentHash(
  providerId: WalletProviderId,
  address: string,
  contractHash: string,
  network: StellarNetwork = 'testnet',
): Promise<SubmitResult> {
  const server = new StellarSdk.Horizon.Server(horizonUrl(network));

  let account: StellarSdk.Account;
  try {
    account = await server.loadAccount(address);
  } catch {
    throw new WalletError(
      providerId,
      'Esta conta ainda não existe na blockchain.',
      network === 'testnet'
        ? 'Volte um passo e clique em "Liberar saldo de teste" — isso cria a conta.'
        : 'Envie um valor mínimo de XLM para esta conta antes de continuar.',
    );
  }

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: networkPassphrase(network),
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: address,
        asset: StellarSdk.Asset.native(),
        amount: '0.0000001',
      }),
    )
    .addMemo(StellarSdk.Memo.hash(contractHash.slice(0, 64)))
    .setTimeout(180)
    .build();

  return signAndSubmit(providerId, tx.toXDR(), network);
}

/**
 * Registra on-chain que uma carteira assinou determinado documento.
 * Usa `manageData`, que é a forma canônica de gravar um par chave/valor
 * permanente na própria conta do assinante.
 */
export async function signDocumentOnChain(
  providerId: WalletProviderId,
  address: string,
  contractHash: string,
  role: 'signer' | 'witness' = 'signer',
  network: StellarNetwork = 'testnet',
): Promise<SubmitResult> {
  const server = new StellarSdk.Horizon.Server(horizonUrl(network));

  let account: StellarSdk.Account;
  try {
    account = await server.loadAccount(address);
  } catch {
    throw new WalletError(
      providerId,
      'Esta conta ainda não existe na blockchain.',
      network === 'testnet'
        ? 'Libere o saldo de teste primeiro — isso cria a conta.'
        : 'Envie um valor mínimo de XLM para esta conta antes de assinar.',
    );
  }

  const hex = contractHash.slice(0, 64);
  const bytes = Uint8Array.from(hex.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) ?? []);

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: networkPassphrase(network),
  })
    .addOperation(
      StellarSdk.Operation.manageData({
        name: `ce:${role}:${Date.now().toString(36)}`,
        value: Buffer.from(bytes),
      }),
    )
    .addMemo(StellarSdk.Memo.text(`ContractEase:sign:${role}`))
    .setTimeout(180)
    .build();

  return signAndSubmit(providerId, tx.toXDR(), network);
}

// ─── Reexport de tipo utilitário ───────────────────────────────────────

export type { WalletAccount };
