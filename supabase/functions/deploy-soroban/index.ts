// ───────────────────────────────────────────────────────────────────────
// Deploy Soroban Smart Contract
//
// Edge Function que:
//   1. Carrega o WASM compilado do bucket Storage (`contracts-wasm/<template_id>.wasm`)
//   2. Faz upload do WASM para a Stellar (uploadContractWasm)
//   3. Cria a instância do contrato (createContract)
//   4. Invoca `init(...)` com os argumentos do template
//   5. Grava no DB o contract_address + tx_hash de cada etapa
//
// O sponsor (STELLAR_SECRET_KEY) paga as fees de deploy. O dono do contrato
// (ownerAddress) é registrado como admin no payload de init quando aplicável.
// ───────────────────────────────────────────────────────────────────────

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as StellarSdk from 'https://esm.sh/@stellar/stellar-sdk@13.3.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map template_id → nome do arquivo WASM no bucket
const TEMPLATE_WASM: Record<string, string> = {
  rent: 'rent.wasm',
  ecommerce: 'ecommerce.wasm',
  freelancer: 'freelancer.wasm',
  legal_fees: 'legal_fees.wasm',
  construction_contract: 'construction.wasm',
  real_estate_token: 'real_estate_vault.wasm',
};

interface DeployRequest {
  contractId: string;       // ID do documento no Supabase
  templateId: string;       // 'rent' | 'ecommerce' | ...
  initArgs: unknown[];      // Argumentos serializáveis para init()
  network?: 'testnet' | 'mainnet';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  let stage = 'init';
  try {
    // ── ENV CHECK ────────────────────────────────────────────────────
    stage = 'env_check';
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const sponsorSecret = Deno.env.get('STELLAR_SECRET_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !sponsorSecret) {
      return error(500, stage, 'env_missing', {
        hint: 'Configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e STELLAR_SECRET_KEY nos secrets da Edge Function.',
      });
    }

    // ── PARSE ────────────────────────────────────────────────────────
    stage = 'parse_body';
    const body = (await req.json()) as DeployRequest;
    const { contractId, templateId, initArgs } = body;
    const isTestnet = body.network !== 'mainnet';

    if (!contractId || !templateId || !Array.isArray(initArgs)) {
      return error(400, stage, 'invalid_body', {
        hint: 'Body precisa de { contractId, templateId, initArgs[] }',
      });
    }

    const wasmFile = TEMPLATE_WASM[templateId];
    if (!wasmFile) {
      return error(400, stage, 'unknown_template', {
        hint: `Template "${templateId}" não tem WASM mapeado. Compile e suba para o bucket.`,
      });
    }

    // ── SUPABASE CLIENT ─────────────────────────────────────────────
    stage = 'supabase_init';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── WASM DOWNLOAD ───────────────────────────────────────────────
    stage = 'wasm_download';
    const { data: wasmBlob, error: bucketErr } = await supabase.storage
      .from('contracts-wasm')
      .download(wasmFile);
    if (bucketErr || !wasmBlob) {
      return error(500, stage, 'wasm_not_found', {
        hint: `Suba o arquivo ${wasmFile} no bucket "contracts-wasm" do Supabase Storage.`,
        detail: bucketErr?.message,
      });
    }
    const wasmBytes = new Uint8Array(await wasmBlob.arrayBuffer());

    // ── STELLAR SETUP ───────────────────────────────────────────────
    stage = 'stellar_setup';
    const rpcUrl = isTestnet
      ? 'https://soroban-testnet.stellar.org'
      : 'https://soroban-rpc.stellar.org';
    const networkPassphrase = isTestnet
      ? StellarSdk.Networks.TESTNET
      : StellarSdk.Networks.PUBLIC;

    const sponsor = StellarSdk.Keypair.fromSecret(sponsorSecret);
    const rpc = new StellarSdk.rpc.Server(rpcUrl, { allowHttp: false });

    // ── STEP 1: Upload WASM ─────────────────────────────────────────
    stage = 'upload_wasm';
    let sponsorAccount = await rpc.getAccount(sponsor.publicKey());

    const uploadTx = new StellarSdk.TransactionBuilder(sponsorAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase,
    })
      .addOperation(StellarSdk.Operation.uploadContractWasm({ wasm: Buffer.from(wasmBytes) }))
      .setTimeout(60)
      .build();

    const uploadPrepared = await rpc.prepareTransaction(uploadTx);
    uploadPrepared.sign(sponsor);
    const uploadResp = await rpc.sendTransaction(uploadPrepared);

    if (uploadResp.status === 'ERROR') {
      return error(500, stage, 'upload_failed', { detail: uploadResp.errorResult?.result() });
    }
    const uploadResult = await pollTx(rpc, uploadResp.hash);
    if (uploadResult.status !== 'SUCCESS') {
      return error(500, stage, 'upload_tx_failed', { detail: uploadResult });
    }
    const wasmHash = (uploadResult.returnValue as StellarSdk.xdr.ScVal)
      .bytes()
      .toString('hex');

    // ── STEP 2: Create Contract Instance ────────────────────────────
    stage = 'create_contract';
    sponsorAccount = await rpc.getAccount(sponsor.publicKey());
    const salt = StellarSdk.hash(Buffer.from(`contractease-${contractId}-${Date.now()}`));

    const createTx = new StellarSdk.TransactionBuilder(sponsorAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.createCustomContract({
          address: StellarSdk.Address.fromString(sponsor.publicKey()),
          wasmHash: Buffer.from(wasmHash, 'hex'),
          salt,
        }),
      )
      .setTimeout(60)
      .build();

    const createPrepared = await rpc.prepareTransaction(createTx);
    createPrepared.sign(sponsor);
    const createResp = await rpc.sendTransaction(createPrepared);
    if (createResp.status === 'ERROR') {
      return error(500, stage, 'create_failed', { detail: createResp.errorResult?.result() });
    }
    const createResult = await pollTx(rpc, createResp.hash);
    if (createResult.status !== 'SUCCESS') {
      return error(500, stage, 'create_tx_failed', { detail: createResult });
    }

    const contractAddress = StellarSdk.Address.contract(
      (createResult.returnValue as StellarSdk.xdr.ScVal).address().contractId(),
    ).toString();

    // ── STEP 3: Invoke init(...) ────────────────────────────────────
    stage = 'invoke_init';
    sponsorAccount = await rpc.getAccount(sponsor.publicKey());

    const scArgs = initArgs.map((a) => jsonToScVal(a));
    const contract = new StellarSdk.Contract(contractAddress);

    const initTx = new StellarSdk.TransactionBuilder(sponsorAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase,
    })
      .addOperation(contract.call('init', ...scArgs))
      .setTimeout(60)
      .build();

    const initPrepared = await rpc.prepareTransaction(initTx);
    initPrepared.sign(sponsor);
    const initResp = await rpc.sendTransaction(initPrepared);
    if (initResp.status === 'ERROR') {
      return error(500, stage, 'init_failed', { detail: initResp.errorResult?.result() });
    }
    const initResult = await pollTx(rpc, initResp.hash);
    if (initResult.status !== 'SUCCESS') {
      return error(500, stage, 'init_tx_failed', { detail: initResult });
    }

    // ── SAVE ─────────────────────────────────────────────────────────
    stage = 'save_db';
    await supabase
      .from('contracts')
      .update({
        soroban_contract_address: contractAddress,
        soroban_wasm_hash: wasmHash,
        soroban_deploy_tx: createResp.hash,
        soroban_init_tx: initResp.hash,
        soroban_network: isTestnet ? 'testnet' : 'mainnet',
        soroban_deployed_at: new Date().toISOString(),
      })
      .eq('id', contractId);

    return new Response(
      JSON.stringify({
        success: true,
        contractAddress,
        wasmHash,
        uploadTx: uploadResp.hash,
        createTx: createResp.hash,
        initTx: initResp.hash,
        network: isTestnet ? 'testnet' : 'mainnet',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const e = err as Error;
    console.error('[deploy-soroban]', stage, e);
    return error(500, stage, 'unexpected', { detail: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────

function error(status: number, stage: string, code: string, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ error: code, stage, ...extra }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function pollTx(rpc: StellarSdk.rpc.Server, hash: string, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const tx = await rpc.getTransaction(hash);
    if (tx.status !== 'NOT_FOUND' && tx.status !== 'PENDING') return tx;
  }
  throw new Error(`Tx ${hash} timed out after ${maxAttempts * 2}s`);
}

/**
 * Conversor JSON → ScVal.
 *
 * Aceita formato discriminado:
 *   { type: 'address', value: 'G...' | 'C...' }
 *   { type: 'i128', value: '1000000000' }    // string para evitar precisão
 *   { type: 'u32', value: 5 }
 *   { type: 'u64', value: '1700000000' }
 *   { type: 'bool', value: true }
 *   { type: 'string', value: 'hello' }
 *   { type: 'bytes', value: 'deadbeef' }      // hex
 *   { type: 'option', value: T | null }
 *   { type: 'vec', value: [T, ...] }
 *   { type: 'struct', value: { field: T, ... } }
 *
 * O frontend é responsável por construir esses payloads.
 */
function jsonToScVal(input: unknown): StellarSdk.xdr.ScVal {
  if (input === null || input === undefined) {
    return StellarSdk.xdr.ScVal.scvVoid();
  }
  if (typeof input !== 'object') {
    throw new Error(`Invalid scval payload: ${JSON.stringify(input)}`);
  }
  const { type, value } = input as { type: string; value: unknown };

  switch (type) {
    case 'address':
      return StellarSdk.Address.fromString(value as string).toScVal();
    case 'i128':
      return StellarSdk.nativeToScVal(BigInt(value as string), { type: 'i128' });
    case 'u32':
      return StellarSdk.xdr.ScVal.scvU32(Number(value));
    case 'u64':
      return StellarSdk.nativeToScVal(BigInt(value as string), { type: 'u64' });
    case 'bool':
      return StellarSdk.xdr.ScVal.scvBool(Boolean(value));
    case 'string':
      return StellarSdk.xdr.ScVal.scvString(value as string);
    case 'bytes':
      return StellarSdk.xdr.ScVal.scvBytes(Buffer.from(value as string, 'hex'));
    case 'option':
      return value === null ? StellarSdk.xdr.ScVal.scvVoid() : jsonToScVal(value);
    case 'vec':
      return StellarSdk.xdr.ScVal.scvVec((value as unknown[]).map(jsonToScVal));
    case 'struct': {
      const entries = Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) =>
          new StellarSdk.xdr.ScMapEntry({
            key: StellarSdk.xdr.ScVal.scvSymbol(k),
            val: jsonToScVal(v),
          }),
        );
      return StellarSdk.xdr.ScVal.scvMap(entries);
    }
    default:
      throw new Error(`Unsupported scval type: ${type}`);
  }
}
