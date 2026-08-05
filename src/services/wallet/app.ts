/**
 * Carteira do próprio app (somente testnet).
 *
 * Existe por um motivo de produto: alguém que nunca usou blockchain não deveria
 * precisar instalar uma extensão só pra ver o produto funcionando. Esta carteira
 * é gerada no navegador, financiada com dinheiro de teste e serve pra percorrer
 * o fluxo inteiro em segundos.
 *
 * ⚠️ Não serve para dinheiro real — a chave fica em localStorage sem criptografia.
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import { ensureWallet, getWallet } from '@/services/embeddedWallet';
import type {
  StellarNetwork,
  WalletAccount,
  WalletAvailability,
  WalletProvider,
} from './types';
import { WalletError } from './types';

export const appWalletProvider: WalletProvider = {
  meta: {
    id: 'app',
    name: 'Carteira de teste do ContractEase',
    tagline: 'Criada aqui mesmo, em um clique. Ideal para experimentar antes de instalar qualquer extensão.',
    icon: 'solar:test-tube-bold-duotone',
    installUrl: '',
    steps: [
      'Clique em "Criar carteira de teste" — ela é gerada no navegador.',
      'Libere o saldo de teste gratuito.',
      'Pronto: dá para percorrer o fluxo inteiro sem instalar nada.',
    ],
    caveat: 'Só para testes: a chave fica neste navegador sem criptografia. Nunca use com dinheiro real.',
  },

  async detect(): Promise<WalletAvailability> {
    return { installed: true };
  },

  async getAccount(network: StellarNetwork): Promise<WalletAccount | null> {
    const wallet = getWallet();
    if (!wallet) return null;
    return { address: wallet.publicKey, network };
  },

  async connect(network: StellarNetwork): Promise<WalletAccount> {
    if (network !== 'testnet') {
      throw new WalletError(
        'app',
        'A carteira de teste só funciona na rede de testes.',
        'Para a rede real, conecte MetaMask ou Freighter.',
      );
    }
    const wallet = ensureWallet();
    return { address: wallet.publicKey, network };
  },

  async signXdr(xdr: string, network: StellarNetwork): Promise<string> {
    if (network !== 'testnet') {
      throw new WalletError(
        'app',
        'A carteira de teste não assina na rede real.',
        'Conecte MetaMask ou Freighter para operar com valores reais.',
      );
    }
    const wallet = getWallet();
    if (!wallet) {
      throw new WalletError('app', 'Nenhuma carteira de teste criada ainda.', 'Clique em "Criar carteira de teste".');
    }
    const tx = StellarSdk.TransactionBuilder.fromXDR(xdr, StellarSdk.Networks.TESTNET);
    tx.sign(StellarSdk.Keypair.fromSecret(wallet.secret));
    return tx.toXDR();
  },
};
