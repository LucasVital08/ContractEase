/**
 * Freighter — carteira nativa de Stellar (extensão de navegador).
 *
 * É a opção mais direta pra quem já vive no ecossistema Stellar: não precisa
 * de complemento nenhum, entende Soroban de fábrica.
 */

import * as freighter from '@stellar/freighter-api';
import * as StellarSdk from '@stellar/stellar-sdk';
import type {
  StellarNetwork,
  WalletAccount,
  WalletAvailability,
  WalletProvider,
} from './types';
import { WalletError } from './types';

const INSTALL_URL = 'https://www.freighter.app/';

function passphraseFor(network: StellarNetwork) {
  return network === 'testnet' ? StellarSdk.Networks.TESTNET : StellarSdk.Networks.PUBLIC;
}

function normalizeNetwork(raw: string | null | undefined): StellarNetwork {
  return (raw ?? '').toLowerCase().includes('test') ? 'testnet' : 'mainnet';
}

export const freighterProvider: WalletProvider = {
  meta: {
    id: 'freighter',
    name: 'Freighter',
    tagline: 'Carteira feita especificamente para Stellar. Sem complementos, sem etapas extras.',
    icon: 'solar:rocket-2-bold-duotone',
    installUrl: INSTALL_URL,
    steps: [
      'Instale a extensão Freighter (link no botão) e crie sua carteira.',
      'Nas configurações da Freighter, selecione a rede "Test Net".',
      'Volte aqui e clique em "Conectar Freighter".',
    ],
  },

  async detect(): Promise<WalletAvailability> {
    try {
      const res = await freighter.isConnected();
      if (!res?.isConnected) {
        return {
          installed: false,
          installUrl: INSTALL_URL,
          reason: 'Extensão Freighter não encontrada neste navegador.',
        };
      }
      return { installed: true };
    } catch {
      return { installed: false, installUrl: INSTALL_URL };
    }
  },

  async getAccount(): Promise<WalletAccount | null> {
    try {
      const installed = await freighter.isConnected();
      if (!installed?.isConnected) return null;

      const allowed = await freighter.isAllowed();
      if (!allowed?.isAllowed) return null;

      const addr = await freighter.getAddress();
      if (!addr?.address) return null;

      const net = await freighter.getNetwork();
      return { address: addr.address, network: normalizeNetwork(net?.network) };
    } catch {
      return null;
    }
  },

  async connect(): Promise<WalletAccount> {
    const installed = await freighter.isConnected();
    if (!installed?.isConnected) {
      throw new WalletError(
        'freighter',
        'Freighter não está instalada.',
        `Instale em ${INSTALL_URL} e recarregue a página.`,
      );
    }
    const access = await freighter.requestAccess();
    if (!access?.address) {
      throw new WalletError(
        'freighter',
        'Você recusou a permissão na Freighter.',
        'Clique em "Conectar Freighter" e aprove a janela da extensão.',
      );
    }
    const net = await freighter.getNetwork();
    return { address: access.address, network: normalizeNetwork(net?.network) };
  },

  async signXdr(xdr: string, network: StellarNetwork): Promise<string> {
    const account = await freighterProvider.getAccount(network);
    if (!account) {
      throw new WalletError(
        'freighter',
        'Freighter não está conectada.',
        'Conecte a carteira antes de assinar.',
      );
    }
    if (account.network !== network) {
      throw new WalletError(
        'freighter',
        `A Freighter está na rede ${account.network === 'testnet' ? 'Test Net' : 'Main Net'}, mas esta operação é na ${network === 'testnet' ? 'Test Net' : 'Main Net'}.`,
        'Abra a Freighter, troque a rede nas configurações e tente de novo.',
      );
    }

    const signed = await freighter.signTransaction(xdr, {
      networkPassphrase: passphraseFor(network),
      address: account.address,
    });

    if (typeof signed === 'string') return signed;
    const value = (signed as { signedTxXdr?: string })?.signedTxXdr;
    if (!value) {
      throw new WalletError(
        'freighter',
        'A Freighter não devolveu a transação assinada.',
        'Confirme que você aprovou a assinatura na extensão.',
      );
    }
    return value;
  },
};
