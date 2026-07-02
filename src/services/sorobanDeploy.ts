/**
 * Soroban Deploy & Invoke Service
 *
 * Camada que conecta o frontend ao mundo on-chain:
 *
 * - `deployContract` chama a Edge Function `deploy-soroban` que faz upload do
 *   WASM, cria a instância e invoca `init(...)`. Retorna o contract address.
 * - `invokeAction` monta uma operação Soroban, pede assinatura à carteira do
 *   usuário (Freighter), envia e aguarda confirmação.
 * - `readState` faz simulação (sem custo) para ler dados públicos do contrato.
 * - `subscribeEvents` monitora eventos via polling no RPC Soroban.
 *
 * Compatível com os 6 templates implementados:
 *   rent · ecommerce · freelancer · legal_fees · construction_contract · real_estate_token
 */

import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  Networks,
  TransactionBuilder,
  xdr,
  nativeToScVal,
  scValToNative,
  rpc as sorobanRpc,
} from '@stellar/stellar-sdk';
import { supabase } from '@/lib/supabase';
import { getFreighterPublicKey, signTransactionWithFreighter } from '@/services/stellarWallet';

// ─── CONSTANTES ────────────────────────────────────────────────────────

const TESTNET_RPC = 'https://soroban-testnet.stellar.org';
const MAINNET_RPC = 'https://soroban-rpc.stellar.org';
const TESTNET_HORIZON_PUBLIC = 'https://horizon-testnet.stellar.org';

export type SorobanNetwork = 'testnet' | 'mainnet';

function rpcServer(network: SorobanNetwork) {
  return new sorobanRpc.Server(network === 'testnet' ? TESTNET_RPC : MAINNET_RPC);
}

function passphrase(network: SorobanNetwork) {
  return network === 'testnet' ? Networks.TESTNET : Networks.PUBLIC;
}

// ─── PAYLOADS DE ARGUMENTOS ────────────────────────────────────────────

/**
 * Discriminated union para serializar argumentos do contrato.
 * O mesmo formato é entendido pela Edge Function `deploy-soroban`.
 */
export type ScValPayload =
  | { type: 'address'; value: string }
  | { type: 'i128'; value: string }
  | { type: 'u32'; value: number }
  | { type: 'u64'; value: string }
  | { type: 'bool'; value: boolean }
  | { type: 'string'; value: string }
  | { type: 'bytes'; value: string } // hex sem 0x
  | { type: 'option'; value: ScValPayload | null }
  | { type: 'vec'; value: ScValPayload[] }
  | { type: 'struct'; value: Record<string, ScValPayload> };

// Helpers ergonômicos
export const sc = {
  addr: (v: string): ScValPayload => ({ type: 'address', value: v }),
  i128: (v: bigint | string | number): ScValPayload => ({
    type: 'i128',
    value: typeof v === 'bigint' ? v.toString() : String(v),
  }),
  u32: (v: number): ScValPayload => ({ type: 'u32', value: v }),
  u64: (v: bigint | number | string): ScValPayload => ({
    type: 'u64',
    value: typeof v === 'bigint' ? v.toString() : String(v),
  }),
  bool: (v: boolean): ScValPayload => ({ type: 'bool', value: v }),
  str: (v: string): ScValPayload => ({ type: 'string', value: v }),
  bytes: (hex: string): ScValPayload => ({ type: 'bytes', value: hex.replace(/^0x/, '') }),
  opt: (v: ScValPayload | null): ScValPayload => ({ type: 'option', value: v }),
  vec: (v: ScValPayload[]): ScValPayload => ({ type: 'vec', value: v }),
  struct: (v: Record<string, ScValPayload>): ScValPayload => ({ type: 'struct', value: v }),
};

// ─── DEPLOY ────────────────────────────────────────────────────────────

export interface DeployParams {
  contractId: string;
  templateId: string;
  initArgs: ScValPayload[];
  network?: SorobanNetwork;
}

export interface DeployResult {
  contractAddress: string;
  wasmHash: string;
  uploadTx: string;
  createTx: string;
  initTx: string;
  network: SorobanNetwork;
}

/**
 * Faz deploy do contrato Soroban via Edge Function (sponsor paga as fees).
 * Após sucesso, o DB já fica com `soroban_contract_address` preenchido.
 */
export async function deployContract(params: DeployParams): Promise<DeployResult> {
  const { data, error } = await supabase.functions.invoke('deploy-soroban', {
    body: {
      contractId: params.contractId,
      templateId: params.templateId,
      initArgs: params.initArgs,
      network: params.network ?? 'testnet',
    },
  });

  if (error) {
    const detail = await safeReadError(error);
    throw new Error(`[deploy-soroban] ${detail.code ?? 'unknown'} @ ${detail.stage ?? '?'}: ${detail.message}`);
  }
  if (!data?.success) {
    throw new Error(`[deploy-soroban] resposta inesperada: ${JSON.stringify(data)}`);
  }
  return data as DeployResult;
}

// ─── INVOKE ────────────────────────────────────────────────────────────

export interface InvokeParams {
  contractAddress: string;
  method: string;
  args: ScValPayload[];
  network?: SorobanNetwork;
  /** Endereço da carteira que vai assinar. Se omitido, usa Freighter. */
  caller?: string;
}

export interface InvokeResult {
  txHash: string;
  returnValue: xdr.ScVal;
}

/**
 * Invoca um método do contrato Soroban. Assinatura via Freighter.
 *
 * - Constrói a transação localmente.
 * - `prepareTransaction` no RPC para inferir footprint (storage usado).
 * - Assina com Freighter.
 * - Envia e faz polling.
 */
export async function invokeAction(params: InvokeParams): Promise<InvokeResult> {
  const network = params.network ?? 'testnet';
  const rpc = rpcServer(network);
  const net = passphrase(network);

  const caller = params.caller ?? (await getFreighterPublicKey());
  if (!caller) {
    throw new Error('Carteira Freighter não conectada. Conecte para invocar o contrato.');
  }

  const account = await rpc.getAccount(caller);
  const contract = new Contract(params.contractAddress);

  const scArgs = params.args.map(payloadToScVal);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: net,
  })
    .addOperation(contract.call(params.method, ...scArgs))
    .setTimeout(60)
    .build();

  const prepared = await rpc.prepareTransaction(tx);

  const signedXdr = await signTransactionWithFreighter(prepared.toXDR(), net);
  const signedTx = TransactionBuilder.fromXDR(signedXdr, net);

  const sent = await rpc.sendTransaction(signedTx);
  if (sent.status === 'ERROR') {
    throw new Error(`Envio falhou: ${JSON.stringify(sent.errorResult)}`);
  }

  const final = await waitForTx(rpc, sent.hash);
  if (final.status !== 'SUCCESS') {
    throw new Error(`Tx ${sent.hash} terminou com status ${final.status}`);
  }

  return {
    txHash: sent.hash,
    returnValue: final.returnValue ?? xdr.ScVal.scvVoid(),
  };
}

// ─── READ-ONLY (simulação) ─────────────────────────────────────────────

/**
 * Lê estado público do contrato simulando a chamada (sem custo nem tx).
 * Para métodos como `get_state`, `get_agreement`, `balance`, etc.
 */
export async function readState<T = unknown>(
  contractAddress: string,
  method: string,
  args: ScValPayload[] = [],
  network: SorobanNetwork = 'testnet',
): Promise<T> {
  const rpc = rpcServer(network);
  const net = passphrase(network);

  // Conta dummy para construir a tx (não precisa existir on-chain p/ simulação)
  const dummyAccount = new Account('GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ', '0');

  const contract = new Contract(contractAddress);
  const scArgs = args.map(payloadToScVal);

  const tx = new TransactionBuilder(dummyAccount, {
    fee: BASE_FEE,
    networkPassphrase: net,
  })
    .addOperation(contract.call(method, ...scArgs))
    .setTimeout(60)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (sorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulação falhou: ${sim.error}`);
  }
  if (!sim.result?.retval) {
    throw new Error('Simulação não retornou valor');
  }
  return scValToJs(sim.result.retval) as T;
}

// ─── EVENTS ────────────────────────────────────────────────────────────

export interface ContractEvent {
  ledger: number;
  txHash: string;
  topics: unknown[];
  value: unknown;
  ts: number;
}

/**
 * Lê eventos emitidos pelo contrato desde um ledger específico.
 * O RPC Soroban mantém eventos por ~24h.
 */
export async function fetchEvents(
  contractAddress: string,
  fromLedger?: number,
  network: SorobanNetwork = 'testnet',
): Promise<ContractEvent[]> {
  const rpc = rpcServer(network);

  const latest = await rpc.getLatestLedger();
  const startLedger = fromLedger ?? Math.max(1, latest.sequence - 5_000);

  const resp = await rpc.getEvents({
    startLedger,
    filters: [
      {
        type: 'contract',
        contractIds: [contractAddress],
      },
    ],
    limit: 200,
  });

  return resp.events.map((e) => ({
    ledger: e.ledger,
    txHash: e.txHash ?? '',
    topics: e.topic.map((t) => scValToJs(t)),
    value: scValToJs(e.value),
    ts: e.ledgerClosedAt ? new Date(e.ledgerClosedAt).getTime() : Date.now(),
  }));
}

// ─── EXPLORER LINKS ────────────────────────────────────────────────────

export function explorerContractUrl(
  contractAddress: string,
  network: SorobanNetwork = 'testnet',
): string {
  const base =
    network === 'testnet'
      ? 'https://stellar.expert/explorer/testnet'
      : 'https://stellar.expert/explorer/public';
  return `${base}/contract/${contractAddress}`;
}

export function explorerTxUrl(txHash: string, network: SorobanNetwork = 'testnet'): string {
  const base =
    network === 'testnet'
      ? 'https://stellar.expert/explorer/testnet'
      : 'https://stellar.expert/explorer/public';
  return `${base}/tx/${txHash}`;
}

// ─── INTERNOS ──────────────────────────────────────────────────────────

function payloadToScVal(p: ScValPayload): xdr.ScVal {
  switch (p.type) {
    case 'address':
      return Address.fromString(p.value).toScVal();
    case 'i128':
      return nativeToScVal(BigInt(p.value), { type: 'i128' });
    case 'u32':
      return xdr.ScVal.scvU32(p.value);
    case 'u64':
      return nativeToScVal(BigInt(p.value), { type: 'u64' });
    case 'bool':
      return xdr.ScVal.scvBool(p.value);
    case 'string':
      return xdr.ScVal.scvString(p.value);
    case 'bytes':
      return xdr.ScVal.scvBytes(Buffer.from(p.value, 'hex'));
    case 'option':
      return p.value === null ? xdr.ScVal.scvVoid() : payloadToScVal(p.value);
    case 'vec':
      return xdr.ScVal.scvVec(p.value.map(payloadToScVal));
    case 'struct': {
      const entries = Object.entries(p.value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(
          ([k, v]) =>
            new xdr.ScMapEntry({
              key: xdr.ScVal.scvSymbol(k),
              val: payloadToScVal(v),
            }),
        );
      return xdr.ScVal.scvMap(entries);
    }
  }
}

function scValToJs(value: xdr.ScVal): unknown {
  // scValToNative cobre a maioria dos tipos; enums customizados que ele
  // não entende caem no fallback XDR base64.
  try {
    return scValToNative(value);
  } catch {
    return value.toXDR('base64');
  }
}

async function waitForTx(rpc: sorobanRpc.Server, hash: string, maxAttempts = 30) {
  // Soroban RPC responde NOT_FOUND enquanto a tx não entra num ledger;
  // os estados terminais são SUCCESS e FAILED.
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const tx = await rpc.getTransaction(hash);
    if (tx.status !== 'NOT_FOUND') return tx;
  }
  throw new Error(`Timeout aguardando tx ${hash}`);
}

async function safeReadError(err: unknown): Promise<{ code?: string; stage?: string; message: string }> {
  try {
    const e = err as { message?: string; context?: { body?: ReadableStream } };
    if (e?.context?.body) {
      const text = await new Response(e.context.body).text();
      try {
        const json = JSON.parse(text);
        return { code: json.error, stage: json.stage, message: text };
      } catch {
        return { message: text };
      }
    }
    return { message: e.message ?? 'erro desconhecido' };
  } catch {
    return { message: 'erro ao parsear erro' };
  }
}

// ─── EXPORT (helper de URL para reuso em UI) ──────────────────────────

export { TESTNET_RPC, MAINNET_RPC, TESTNET_HORIZON_PUBLIC };
