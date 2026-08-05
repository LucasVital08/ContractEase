/**
 * Camada de compatibilidade.
 *
 * Antes este arquivo falava direto com a Freighter. Agora ele apenas delega
 * para a carteira ativa (`services/wallet`), que pode ser MetaMask, Freighter
 * ou a carteira de teste do app. As assinaturas das funções foram mantidas
 * para não quebrar as telas que já as consomem.
 */

import {
  anchorDocumentHash,
  getAccountStatus,
  getProvider,
  signDocumentOnChain,
  WALLET_PROVIDERS,
  WalletError,
} from '@/services/wallet';
import {
  clearActiveWallet,
  getActiveAddress,
  getActiveNetwork,
  getActiveProviderId,
  setActiveWallet,
} from '@/services/wallet/active';
import type { StellarNetwork, WalletProviderId } from '@/services/wallet/types';

export { friendbotUrl, shortenAddress, explorerAccountUrl, explorerTxUrl } from '@/services/wallet';

export interface WalletState {
  isInstalled: boolean;
  isConnected: boolean;
  address: string | null;
  network: string | null;
  provider: WalletProviderId | null;
}

export interface SignedTxResult {
  success: boolean;
  txHash?: string;
  ledger?: number;
  error?: string;
  /** O que o usuário deve fazer para destravar. */
  fix?: string;
}

/** Lê o estado da carteira ativa sem abrir nenhum popup. */
export async function getWalletState(): Promise<WalletState> {
  const providerId = getActiveProviderId();
  const network = getActiveNetwork();

  if (!providerId) {
    // Nenhuma carteira escolhida ainda — informamos se ao menos existe alguma
    // disponível, para a UI decidir entre "conectar" e "instalar".
    const detections = await Promise.all(WALLET_PROVIDERS.map((p) => p.detect().catch(() => ({ installed: false }))));
    return {
      isInstalled: detections.some((d) => d.installed),
      isConnected: false,
      address: null,
      network: null,
      provider: null,
    };
  }

  try {
    const provider = getProvider(providerId);
    const availability = await provider.detect();
    const account = availability.installed ? await provider.getAccount(network) : null;
    return {
      isInstalled: availability.installed,
      isConnected: Boolean(account),
      address: account?.address ?? null,
      network: account?.network ?? null,
      provider: providerId,
    };
  } catch {
    return { isInstalled: false, isConnected: false, address: null, network: null, provider: providerId };
  }
}

/**
 * Conecta uma carteira. Sem argumento, reconecta a que já estava ativa;
 * se não houver nenhuma, tenta a recomendada (MetaMask).
 */
export async function connectWallet(
  providerId?: WalletProviderId,
  network: StellarNetwork = getActiveNetwork(),
): Promise<WalletState> {
  const id = providerId ?? getActiveProviderId() ?? 'metamask';
  const provider = getProvider(id);
  const account = await provider.connect(network);
  setActiveWallet(id, account.address, account.network);
  return {
    isInstalled: true,
    isConnected: true,
    address: account.address,
    network: account.network,
    provider: id,
  };
}

export function disconnectWallet() {
  clearActiveWallet();
}

function requireActive(): { providerId: WalletProviderId; address: string; network: StellarNetwork } {
  const providerId = getActiveProviderId();
  const address = getActiveAddress();
  if (!providerId || !address) {
    throw new WalletError('metamask', 'Nenhuma carteira conectada.', 'Abra "Carteira" no menu e conecte uma carteira.');
  }
  return { providerId, address, network: getActiveNetwork() };
}

function toResult(err: unknown): SignedTxResult {
  if (err instanceof WalletError) {
    return { success: false, error: err.message, fix: err.fix };
  }
  return { success: false, error: (err as Error)?.message ?? String(err) };
}

/** Grava o hash do contrato na blockchain usando a carteira ativa. */
export async function anchorContractHashWithWallet(contractHash: string): Promise<SignedTxResult> {
  try {
    const { providerId, address, network } = requireActive();
    const { hash, ledger } = await anchorDocumentHash(providerId, address, contractHash, network);
    return { success: true, txHash: hash, ledger };
  } catch (err) {
    return toResult(err);
  }
}

/** Registra on-chain que a carteira ativa assinou o documento. */
export async function signAsContractParty(
  contractHash: string,
  role: 'signer' | 'witness' = 'signer',
): Promise<SignedTxResult> {
  try {
    const { providerId, address, network } = requireActive();
    const { hash, ledger } = await signDocumentOnChain(providerId, address, contractHash, role, network);
    return { success: true, txHash: hash, ledger };
  } catch (err) {
    return toResult(err);
  }
}

// ─── Helpers usados pelo sorobanDeploy ─────────────────────────────────

/** Endereço da carteira ativa (qualquer provedor). */
export async function getWalletPublicKey(): Promise<string> {
  const { address } = requireActive();
  const status = await getAccountStatus(address, getActiveNetwork()).catch(() => null);
  if (status && !status.exists) {
    throw new WalletError(
      getActiveProviderId() ?? 'metamask',
      'A conta desta carteira ainda não existe na blockchain.',
      'Abra "Carteira" e libere o saldo de teste — isso cria a conta na rede.',
    );
  }
  return address;
}

/** Assina um XDR com a carteira ativa. */
export async function signTransactionWithWallet(
  txXdr: string,
  _networkPassphrase?: string,
): Promise<string> {
  const { providerId, network } = requireActive();
  return getProvider(providerId).signXdr(txXdr, network);
}

/** @deprecated use `getWalletPublicKey` — mantido para compatibilidade. */
export const getFreighterPublicKey = getWalletPublicKey;
/** @deprecated use `signTransactionWithWallet` — mantido para compatibilidade. */
export const signTransactionWithFreighter = signTransactionWithWallet;
