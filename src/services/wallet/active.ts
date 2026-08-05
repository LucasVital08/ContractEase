/**
 * Qual carteira está ativa agora.
 *
 * Fica fora do store Zustand de propósito: serviços (deploy Soroban, assinatura
 * de documento) precisam dessa informação sem importar a camada de UI, o que
 * criaria dependência circular.
 */

import type { StellarNetwork, WalletProviderId } from './types';

const PROVIDER_KEY = 'contractease.wallet.provider';
const ADDRESS_KEY = 'contractease.wallet.address';
const NETWORK_KEY = 'contractease.wallet.network';

let activeProviderId: WalletProviderId | null = null;
let activeAddress: string | null = null;
let activeNetwork: StellarNetwork = 'testnet';

function readStorage(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) globalThis.localStorage?.removeItem(key);
    else globalThis.localStorage?.setItem(key, value);
  } catch {
    /* modo privado / storage bloqueado — seguimos só em memória */
  }
}

// Hidrata na primeira importação para sobreviver a um F5.
activeProviderId = (readStorage(PROVIDER_KEY) as WalletProviderId | null) ?? null;
activeAddress = readStorage(ADDRESS_KEY);
activeNetwork = (readStorage(NETWORK_KEY) as StellarNetwork | null) ?? 'testnet';

export function getActiveProviderId(): WalletProviderId | null {
  return activeProviderId;
}

export function getActiveAddress(): string | null {
  return activeAddress;
}

export function getActiveNetwork(): StellarNetwork {
  return activeNetwork;
}

export function setActiveWallet(
  providerId: WalletProviderId,
  address: string,
  network: StellarNetwork,
) {
  activeProviderId = providerId;
  activeAddress = address;
  activeNetwork = network;
  writeStorage(PROVIDER_KEY, providerId);
  writeStorage(ADDRESS_KEY, address);
  writeStorage(NETWORK_KEY, network);
}

export function clearActiveWallet() {
  activeProviderId = null;
  activeAddress = null;
  writeStorage(PROVIDER_KEY, null);
  writeStorage(ADDRESS_KEY, null);
}
