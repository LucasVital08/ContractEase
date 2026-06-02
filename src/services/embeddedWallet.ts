/**
 * Embedded Wallet (testnet apenas — MVP de demo).
 *
 * ⚠️ A secret key é guardada em localStorage SEM criptografia.
 *    Isso é aceitável APENAS pra testnet com dinheiro de mentira.
 *    Antes de mainnet, ver [[mainnet-readiness-checklist]] item 1:
 *    criptografar com senha do user (WebCrypto/PBKDF2+AES-GCM) +
 *    mecanismo de recuperação (passkey / social / export).
 */

import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk';

const STORAGE_KEY = 'contractease.testnet.wallet.v1';
const HORIZON_URL = 'https://horizon-testnet.stellar.org';
// Endpoints de friendbot — tentamos o do Horizon primeiro (CORS aberto, canônico)
// e caímos pro friendbot.stellar.org como fallback. Alguns ambientes/edge nodes
// bloqueiam um ou outro.
const FRIENDBOT_URLS = [
  'https://horizon-testnet.stellar.org/friendbot',
  'https://friendbot.stellar.org',
] as const;

/** Stellar Reference Anchor da SDF — pública, testnet, fluxo simulado de PIX. */
export const TEST_ANCHOR = {
  domain: 'testanchor.stellar.org',
  tomlUrl: 'https://testanchor.stellar.org/.well-known/stellar.toml',
  asset: {
    code: 'SRT',
    issuer: 'GCDNJUBQSX7AJWLJACMJ7I4BC3Z47BQUTMHEICZLE6MU4KQBRYG5JY6B',
  },
} as const;

export interface EmbeddedWallet {
  publicKey: string;
  secret: string;
  createdAt: string;
}

export interface WalletBalance {
  assetCode: string;
  assetIssuer: string | null;
  balance: string;
  isNative: boolean;
}

/** Lê a carteira do localStorage (null se não existir). */
export function getWallet(): EmbeddedWallet | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as EmbeddedWallet;
  } catch {
    return null;
  }
}

/** Gera uma carteira Ed25519 e salva no localStorage. */
export function createWallet(): EmbeddedWallet {
  const kp = Keypair.random();
  const wallet: EmbeddedWallet = {
    publicKey: kp.publicKey(),
    secret: kp.secret(),
    createdAt: new Date().toISOString(),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(wallet));
  return wallet;
}

/** Garante que existe carteira (cria se não tiver). */
export function ensureWallet(): EmbeddedWallet {
  return getWallet() ?? createWallet();
}

/** Remove a carteira (útil pra recriar). */
export function clearWallet(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

/** Fundamenta a conta com XLM via friendbot da testnet (10k XLM). */
export async function fundWithFriendbot(publicKey: string): Promise<void> {
  const errors: string[] = [];
  for (const base of FRIENDBOT_URLS) {
    try {
      const res = await fetch(`${base}?addr=${encodeURIComponent(publicKey)}`);
      if (res.ok) return;
      const text = await res.text();
      // "createAccountAlreadyExist" / "op_already_exists" — conta já estava criada
      if (/createAccountAlreadyExist|op_already_exists/i.test(text)) return;
      errors.push(`${base} → ${res.status} ${text.slice(0, 160)}`);
    } catch (err: any) {
      // erros de rede/CORS caem aqui — registra e tenta o próximo endpoint
      errors.push(`${base} → ${err?.message || 'network error'}`);
    }
  }
  throw new Error(`Friendbot falhou em todos os endpoints. ${errors.join(' | ')}`);
}

/** Lê os saldos da conta na testnet. Retorna [] se conta ainda não existe. */
export async function getBalances(publicKey: string): Promise<WalletBalance[]> {
  const server = new Horizon.Server(HORIZON_URL);
  try {
    const account = await server.loadAccount(publicKey);
    return account.balances.map((b: any) => ({
      assetCode: b.asset_type === 'native' ? 'XLM' : b.asset_code,
      assetIssuer: b.asset_type === 'native' ? null : b.asset_issuer,
      balance: b.balance,
      isNative: b.asset_type === 'native',
    }));
  } catch (err: any) {
    if (err?.response?.status === 404 || /not found/i.test(err?.message || '')) return [];
    throw err;
  }
}

/** Adiciona trustline pra um asset (se ainda não houver). */
export async function ensureTrustline(
  secret: string,
  asset: { code: string; issuer: string },
): Promise<{ added: boolean }> {
  const kp = Keypair.fromSecret(secret);
  const server = new Horizon.Server(HORIZON_URL);
  const account = await server.loadAccount(kp.publicKey());

  const exists = account.balances.some(
    (b: any) =>
      b.asset_type !== 'native' &&
      b.asset_code === asset.code &&
      b.asset_issuer === asset.issuer,
  );
  if (exists) return { added: false };

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.changeTrust({ asset: new Asset(asset.code, asset.issuer) }))
    .setTimeout(30)
    .build();
  tx.sign(kp);
  await server.submitTransaction(tx);
  return { added: true };
}

/** Link pro Stellar Expert na testnet (auditoria pública). */
export function explorerAccountUrl(publicKey: string): string {
  return `https://stellar.expert/explorer/testnet/account/${publicKey}`;
}

export function explorerTxUrl(hash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}
