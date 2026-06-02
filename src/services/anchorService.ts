/**
 * Cliente Stellar Anchor (SEP-10 + SEP-24).
 *
 * Implementa o fluxo padrão de depósito interativo contra qualquer anchor
 * compatível. Pra MVP usamos a Stellar Test Anchor da SDF (testnet),
 * mas o mesmo cliente serve pra Transfero (BRZ) em mainnet — só trocar
 * o domínio e o asset.
 */

import { Keypair, Networks, TransactionBuilder } from '@stellar/stellar-sdk';

export interface AnchorTomlData {
  TRANSFER_SERVER_SEP0024?: string;
  WEB_AUTH_ENDPOINT?: string;
  SIGNING_KEY?: string;
  NETWORK_PASSPHRASE?: string;
}

/** Lê e parseia o stellar.toml de uma anchor (parser TOML minimalista). */
export async function fetchAnchorToml(domain: string): Promise<AnchorTomlData> {
  const url = `https://${domain}/.well-known/stellar.toml`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao carregar TOML da anchor ${domain}: ${res.status}`);
  const text = await res.text();

  const data: AnchorTomlData = {};
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line || line.startsWith('[')) continue;
    const match = line.match(/^(\w+)\s*=\s*"([^"]+)"/);
    if (match) (data as any)[match[1]] = match[2];
  }
  return data;
}

/**
 * SEP-10 — Web Authentication.
 * Troca a chave Stellar do user por um JWT que a anchor reconhece.
 * Fluxo: GET challenge → assina → POST tx assinada → recebe JWT.
 */
export async function getAnchorAuthToken(
  authEndpoint: string,
  publicKey: string,
  secret: string,
): Promise<string> {
  // 1. Pedir challenge
  const challengeUrl = `${authEndpoint}?account=${encodeURIComponent(publicKey)}`;
  const challengeRes = await fetch(challengeUrl);
  if (!challengeRes.ok) {
    const txt = await challengeRes.text();
    throw new Error(`SEP-10 challenge falhou (${challengeRes.status}): ${txt.slice(0, 200)}`);
  }
  const { transaction, network_passphrase } = await challengeRes.json();
  if (!transaction) throw new Error('SEP-10 challenge sem transaction no body');

  // 2. Assinar
  const passphrase = network_passphrase || Networks.TESTNET;
  const tx = TransactionBuilder.fromXDR(transaction, passphrase);
  tx.sign(Keypair.fromSecret(secret));

  // 3. Enviar tx assinada → ganhar JWT
  const tokenRes = await fetch(authEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction: tx.toXDR() }),
  });
  if (!tokenRes.ok) {
    const txt = await tokenRes.text();
    throw new Error(`SEP-10 token exchange falhou (${tokenRes.status}): ${txt.slice(0, 200)}`);
  }
  const { token } = await tokenRes.json();
  if (!token) throw new Error('SEP-10 não retornou token');
  return token as string;
}

export interface DepositInitResult {
  id: string;
  interactiveUrl: string;
  type: string;
}

/**
 * SEP-24 — inicia um depósito interativo.
 * Retorna a URL que o user precisa abrir (popup) pra completar o flow.
 */
export async function initiateDeposit(
  transferServer: string,
  jwt: string,
  publicKey: string,
  assetCode: string,
): Promise<DepositInitResult> {
  const base = transferServer.replace(/\/$/, '');
  const url = `${base}/transactions/deposit/interactive`;

  const body = new URLSearchParams();
  body.append('asset_code', assetCode);
  body.append('account', publicKey);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`SEP-24 deposit init falhou (${res.status}): ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  return {
    id: data.id,
    interactiveUrl: data.url,
    type: data.type,
  };
}

export type AnchorTxStatus =
  | 'incomplete'
  | 'pending_user_transfer_start'
  | 'pending_user_transfer_complete'
  | 'pending_anchor'
  | 'pending_external'
  | 'pending_stellar'
  | 'pending_trust'
  | 'completed'
  | 'refunded'
  | 'expired'
  | 'no_market'
  | 'too_small'
  | 'too_large'
  | 'error';

export interface AnchorTransaction {
  id: string;
  kind: 'deposit' | 'withdrawal';
  status: AnchorTxStatus;
  amount_in?: string;
  amount_out?: string;
  amount_fee?: string;
  started_at?: string;
  completed_at?: string;
  stellar_transaction_id?: string;
  external_transaction_id?: string;
  message?: string;
  more_info_url?: string;
}

/** Consulta o status atual de uma transação na anchor. */
export async function getAnchorTransaction(
  transferServer: string,
  jwt: string,
  id: string,
): Promise<AnchorTransaction> {
  const base = transferServer.replace(/\/$/, '');
  const url = `${base}/transaction?id=${encodeURIComponent(id)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } });
  if (!res.ok) throw new Error(`Falha ao buscar transação ${id}: ${res.status}`);
  const data = await res.json();
  return data.transaction as AnchorTransaction;
}

/** Status que indicam que o fluxo acabou (sucesso ou falha terminal). */
export function isTerminalStatus(status: AnchorTxStatus): boolean {
  return ['completed', 'refunded', 'expired', 'error', 'no_market', 'too_small', 'too_large'].includes(
    status,
  );
}
