/**
 * Stellar Wallet Service — Freighter integration
 *
 * Abstrai a comunicação com a Freighter Wallet (extensão do browser).
 * Quando o usuário conecta a wallet, ele passa a poder:
 *   - Assinar a transação de deploy do contrato (em vez de usar a custodial)
 *   - Assinar como parte (Lucas/Gabriel) com sua própria carteira
 *   - Pagar parcelas em USDC/BRZ direto do navegador
 *
 * Toda a chave privada permanece na extensão — só XDR vai e volta.
 */

import * as freighter from '@stellar/freighter-api';
import * as StellarSdk from '@stellar/stellar-sdk';

const TESTNET_HORIZON = 'https://horizon-testnet.stellar.org';
const TESTNET_PASSPHRASE = StellarSdk.Networks.TESTNET;

export interface WalletState {
  isInstalled: boolean;
  isConnected: boolean;
  address: string | null;
  network: string | null;
}

export interface SignedTxResult {
  success: boolean;
  txHash?: string;
  ledger?: number;
  error?: string;
}

/**
 * Lê o estado atual da Freighter. Não dispara prompt de permissão.
 */
export async function getWalletState(): Promise<WalletState> {
  try {
    const installed = await freighter.isConnected();
    const isInstalled = !!installed?.isConnected;
    if (!isInstalled) {
      return { isInstalled: false, isConnected: false, address: null, network: null };
    }

    // isAllowed = usuário já autorizou este origin
    const allowed = await freighter.isAllowed();
    if (!allowed?.isAllowed) {
      return { isInstalled: true, isConnected: false, address: null, network: null };
    }

    const addr = await freighter.getAddress();
    const net = await freighter.getNetwork();
    return {
      isInstalled: true,
      isConnected: !!addr?.address,
      address: addr?.address ?? null,
      network: net?.network ?? null,
    };
  } catch (err) {
    console.error('[stellarWallet] getWalletState error:', err);
    return { isInstalled: false, isConnected: false, address: null, network: null };
  }
}

/**
 * Pede ao usuário para conectar a Freighter (dispara prompt).
 */
export async function connectWallet(): Promise<WalletState> {
  const installed = await freighter.isConnected();
  if (!installed?.isConnected) {
    throw new Error(
      'Freighter não está instalada. Instale em https://freighter.app/ para continuar.',
    );
  }
  // Pede permissão (abre prompt se ainda não autorizou)
  const access = await freighter.requestAccess();
  if (!access?.address) {
    throw new Error('Permissão de carteira negada pelo usuário.');
  }
  const net = await freighter.getNetwork();
  return {
    isInstalled: true,
    isConnected: true,
    address: access.address,
    network: net?.network ?? null,
  };
}

/**
 * Assina e submete uma transação de "ancoragem" do hash do contrato
 * usando a carteira do usuário (não a custodial).
 *
 * O usuário precisa ter saldo de XLM na testnet — friendbot resolve.
 */
export async function anchorContractHashWithWallet(contractHash: string): Promise<SignedTxResult> {
  try {
    const state = await getWalletState();
    if (!state.isConnected || !state.address) {
      return { success: false, error: 'Conecte sua carteira Freighter primeiro.' };
    }

    // Network mismatch guard — Freighter must be on Testnet
    const walletNet = (state.network ?? '').toLowerCase();
    const onTestnet = walletNet.includes('test') || walletNet === 'testnet';
    if (!onTestnet) {
      return {
        success: false,
        error: `Sua carteira Freighter está na ${state.network ?? 'Main Net'}. Troque para Test Net nas configurações do Freighter e tente novamente.`,
      };
    }

    const server = new StellarSdk.Horizon.Server(TESTNET_HORIZON);
    let account;
    try {
      account = await server.loadAccount(state.address);
    } catch {
      return {
        success: false,
        error: `Conta ${state.address.slice(0, 8)}...${state.address.slice(-4)} não existe na testnet. Faça friendbot: https://friendbot.stellar.org/?addr=${state.address}`,
      };
    }

    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: TESTNET_PASSPHRASE,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: state.address,
          asset: StellarSdk.Asset.native(),
          amount: '0.0000001',
        }),
      )
      .addMemo(StellarSdk.Memo.hash(contractHash))
      .setTimeout(120)
      .build();

    const signed = await freighter.signTransaction(tx.toXDR(), {
      networkPassphrase: TESTNET_PASSPHRASE,
      address: state.address,
    });

    const signedXdr = typeof signed === 'string' ? signed : (signed as any)?.signedTxXdr;
    if (!signedXdr) {
      return { success: false, error: 'Transação rejeitada na carteira.' };
    }

    const signedTx = StellarSdk.TransactionBuilder.fromXDR(signedXdr, TESTNET_PASSPHRASE);
    const result = await server.submitTransaction(signedTx);

    return {
      success: true,
      txHash: (result as any).hash,
      ledger: (result as any).ledger,
    };
  } catch (err: any) {
    const horizonError = err?.response?.data;
    const codes = horizonError?.extras?.result_codes;
    const detail = codes ? JSON.stringify(codes) : err?.message ?? String(err);
    return { success: false, error: `Falha ao assinar transação: ${detail}` };
  }
}

/**
 * Assina apenas a "intenção" de aprovar o contrato como parte signatária.
 * Faz uma transação manage-data com o hash do contrato no key — leve e
 * suficiente para registrar on-chain "carteira X assinou hash Y em data Z".
 */
export async function signAsContractParty(contractHash: string, role: 'signer' | 'witness' = 'signer'): Promise<SignedTxResult> {
  try {
    const state = await getWalletState();
    if (!state.isConnected || !state.address) {
      return { success: false, error: 'Conecte sua carteira Freighter primeiro.' };
    }

    const walletNet = (state.network ?? '').toLowerCase();
    const onTestnet = walletNet.includes('test') || walletNet === 'testnet';
    if (!onTestnet) {
      return {
        success: false,
        error: `Freighter está na ${state.network ?? 'Main Net'}. Troque para Test Net nas configurações e tente novamente.`,
      };
    }

    const server = new StellarSdk.Horizon.Server(TESTNET_HORIZON);
    let account;
    try {
      account = await server.loadAccount(state.address);
    } catch {
      return {
        success: false,
        error: `Sua conta Stellar ainda não está ativa na testnet. Fund via friendbot: https://friendbot.stellar.org/?addr=${state.address}`,
      };
    }

    // ManageData operation: key = "ce:<role>", value = primeiros 32 bytes do hash
    const valueBytes = new Uint8Array(
      contractHash
        .slice(0, 64)
        .match(/.{1,2}/g)
        ?.map((b) => parseInt(b, 16)) ?? [],
    );

    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: TESTNET_PASSPHRASE,
    })
      .addOperation(
        StellarSdk.Operation.manageData({
          name: `ce:${role}:${Date.now().toString(36)}`,
          value: Buffer.from(valueBytes),
        }),
      )
      .addMemo(StellarSdk.Memo.text(`ContractEase:sign:${role}`))
      .setTimeout(120)
      .build();

    const signed = await freighter.signTransaction(tx.toXDR(), {
      networkPassphrase: TESTNET_PASSPHRASE,
      address: state.address,
    });

    const signedXdr = typeof signed === 'string' ? signed : (signed as any)?.signedTxXdr;
    if (!signedXdr) {
      return { success: false, error: 'Assinatura cancelada pelo usuário.' };
    }

    const signedTx = StellarSdk.TransactionBuilder.fromXDR(signedXdr, TESTNET_PASSPHRASE);
    const result = await server.submitTransaction(signedTx);

    return {
      success: true,
      txHash: (result as any).hash,
      ledger: (result as any).ledger,
    };
  } catch (err: any) {
    const horizonError = err?.response?.data;
    const codes = horizonError?.extras?.result_codes;
    const detail = codes ? JSON.stringify(codes) : err?.message ?? String(err);
    return { success: false, error: `Falha ao registrar assinatura: ${detail}` };
  }
}

/**
 * Atalho para abrir o friendbot da testnet com o endereço do usuário pronto.
 */
export function friendbotUrl(address: string): string {
  return `https://friendbot.stellar.org/?addr=${address}`;
}

/**
 * Encurta um endereço Stellar para exibição (GA1B...XYZ4).
 */
export function shortenAddress(address: string, prefix = 4, suffix = 4): string {
  if (!address || address.length <= prefix + suffix + 3) return address;
  return `${address.slice(0, prefix)}...${address.slice(-suffix)}`;
}

// ─────────────────────────────────────────────────────────────────────
// Helpers de baixo nível (usados pelo sorobanDeploy.ts)
// ─────────────────────────────────────────────────────────────────────

/**
 * Retorna o publicKey da Freighter se a wallet estiver conectada e autorizada.
 * Lança erro caso contrário (mensagem em português).
 */
export async function getFreighterPublicKey(): Promise<string> {
  const state = await getWalletState();
  if (!state.isInstalled) {
    throw new Error('Freighter Wallet não está instalada. Instale em https://www.freighter.app/');
  }
  if (!state.isConnected || !state.address) {
    throw new Error('Conecte sua carteira Freighter antes de invocar o contrato.');
  }
  return state.address;
}

/**
 * Pede à Freighter para assinar uma transação Soroban serializada em XDR.
 * Retorna o XDR assinado, pronto para `sendTransaction`.
 */
export async function signTransactionWithFreighter(
  txXdr: string,
  networkPassphrase: string,
): Promise<string> {
  const state = await getWalletState();
  if (!state.isConnected || !state.address) {
    throw new Error('Carteira Freighter não conectada.');
  }
  const signed = await freighter.signTransaction(txXdr, {
    networkPassphrase,
    address: state.address,
  });
  // freighter v3 retorna objeto { signedTxXdr, signerAddress }; v2 retorna string
  if (typeof signed === 'string') return signed;
  if (typeof (signed as { signedTxXdr?: string }).signedTxXdr === 'string') {
    return (signed as { signedTxXdr: string }).signedTxXdr;
  }
  throw new Error('Freighter retornou formato inesperado ao assinar transação.');
}
