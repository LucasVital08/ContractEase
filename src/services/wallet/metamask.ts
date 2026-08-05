/**
 * MetaMask → Stellar, via MetaMask Snap `npm:stellar-snap`.
 *
 * A MetaMask sozinha não entende Stellar (ela é EVM). O Snap é uma extensão
 * oficial do próprio ecossistema MetaMask que adiciona suporte a Stellar +
 * Soroban dentro da MetaMask que o usuário já tem. Do ponto de vista dele, o
 * fluxo é: clicar em "Conectar MetaMask" → aprovar a instalação do Snap uma
 * única vez → usar normalmente.
 *
 * API do Snap: https://github.com/paulfears/StellarSnap
 *   wallet_requestSnaps  → instala/autoriza
 *   getAddress           → endereço Stellar (G...)
 *   signTransaction      → assina XDR
 */

import type {
  StellarNetwork,
  WalletAccount,
  WalletAvailability,
  WalletProvider,
} from './types';
import { WalletError } from './types';

const SNAP_ID = 'npm:stellar-snap';
const INSTALL_URL = 'https://metamask.io/download/';

type Eip1193 = {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown }) => Promise<unknown>;
  providers?: Eip1193[];
};

/**
 * Encontra a MetaMask mesmo quando outras extensões disputam `window.ethereum`
 * (Coinbase Wallet, Brave, Rabby...). Sem isso, "conectar" pode cair na
 * carteira errada e o usuário nunca entende o motivo.
 */
function getMetaMask(): Eip1193 | null {
  const eth = (globalThis as { ethereum?: Eip1193 }).ethereum;
  if (!eth) return null;
  if (Array.isArray(eth.providers)) {
    return eth.providers.find((p) => p.isMetaMask) ?? null;
  }
  return eth.isMetaMask ? eth : null;
}

async function invokeSnap<T>(method: string, params?: Record<string, unknown>): Promise<T> {
  const mm = getMetaMask();
  if (!mm) {
    throw new WalletError(
      'metamask',
      'MetaMask não encontrada neste navegador.',
      'Instale a extensão MetaMask e recarregue a página.',
    );
  }
  return (await mm.request({
    method: 'wallet_invokeSnap',
    params: { snapId: SNAP_ID, request: { method, params: params ?? {} } },
  })) as T;
}

async function requestSnap(): Promise<void> {
  const mm = getMetaMask();
  if (!mm) {
    throw new WalletError(
      'metamask',
      'MetaMask não encontrada neste navegador.',
      'Instale a extensão MetaMask e recarregue a página.',
    );
  }
  try {
    await mm.request({ method: 'wallet_requestSnaps', params: { [SNAP_ID]: {} } });
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code === 4001) {
      throw new WalletError(
        'metamask',
        'Você recusou a conexão na MetaMask.',
        'Clique em "Conectar MetaMask" de novo e aprove a janela que aparecer.',
      );
    }
    throw new WalletError(
      'metamask',
      `Não deu para instalar o complemento Stellar na MetaMask: ${(err as Error)?.message ?? err}`,
      'Atualize a MetaMask para a versão mais recente e tente de novo.',
    );
  }
}

/** O Snap já está instalado e autorizado neste site? */
async function isSnapConnected(): Promise<boolean> {
  const mm = getMetaMask();
  if (!mm) return false;
  try {
    const snaps = (await mm.request({ method: 'wallet_getSnaps' })) as Record<string, unknown>;
    return Boolean(snaps && snaps[SNAP_ID]);
  } catch {
    return false;
  }
}

export const metamaskProvider: WalletProvider = {
  meta: {
    id: 'metamask',
    name: 'MetaMask',
    tagline: 'A carteira que você provavelmente já tem. Funciona com Stellar através de um complemento oficial.',
    icon: 'logos:metamask-icon',
    installUrl: INSTALL_URL,
    recommended: true,
    steps: [
      'Clique em "Conectar MetaMask".',
      'A MetaMask vai pedir para instalar o complemento Stellar. Clique em "Conectar" e depois em "Instalar".',
      'Confirme. Pronto — o endereço Stellar aparece aqui na tela.',
    ],
    caveat:
      'A MetaMask não fala Stellar de fábrica. O complemento (Snap) é instalado uma única vez, dentro da própria MetaMask, e você continua guardando sua chave lá.',
  },

  async detect(): Promise<WalletAvailability> {
    const mm = getMetaMask();
    if (!mm) {
      return {
        installed: false,
        installUrl: INSTALL_URL,
        reason: 'Extensão MetaMask não encontrada neste navegador.',
      };
    }
    return { installed: true };
  },

  async getAccount(network: StellarNetwork): Promise<WalletAccount | null> {
    if (!(await isSnapConnected())) return null;
    try {
      const address = await invokeSnap<string>('getAddress', { testnet: network === 'testnet' });
      return address ? { address, network } : null;
    } catch {
      return null;
    }
  },

  async connect(network: StellarNetwork): Promise<WalletAccount> {
    await requestSnap();
    const address = await invokeSnap<string>('getAddress', { testnet: network === 'testnet' });
    if (!address) {
      throw new WalletError(
        'metamask',
        'O complemento Stellar não devolveu nenhum endereço.',
        'Abra a MetaMask, confirme que o Snap "Stellar" está ativo e tente de novo.',
      );
    }
    return { address, network };
  },

  async signXdr(xdr: string, network: StellarNetwork): Promise<string> {
    const signed = await invokeSnap<string | { signedTxXdr?: string; transaction?: string }>(
      'signTransaction',
      { transaction: xdr, testnet: network === 'testnet' },
    );
    if (typeof signed === 'string') return signed;
    const value = signed?.signedTxXdr ?? signed?.transaction;
    if (!value) {
      throw new WalletError(
        'metamask',
        'A MetaMask não devolveu a transação assinada.',
        'Verifique se você aprovou a assinatura na janela da MetaMask.',
      );
    }
    return value;
  },
};

export { SNAP_ID as STELLAR_SNAP_ID };
