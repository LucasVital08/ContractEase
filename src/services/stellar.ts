/**
 * Stellar Blockchain Service
 * Serviço para ancoragem de contratos na Stellar Network (Testnet).
 * 
 * Fluxo:
 * 1. Gera hash SHA-256 do conteúdo do contrato
 * 2. Submete uma transação na Stellar Testnet com o hash como Memo
 * 3. Retorna o stellarTxHash para rastreabilidade
 * 
 * Em produção, conecte-se ao Horizon da Mainnet e utilize chaves reais.
 */

import * as StellarSdk from '@stellar/stellar-sdk';

// Configuração Testnet
const TESTNET_HORIZON = 'https://horizon-testnet.stellar.org';
const TESTNET_PASSPHRASE = StellarSdk.Networks.TESTNET;

// Keypair de demonstração (Testnet-only). Em produção, use Freighter ou um cofre seguro.
const DEMO_SECRET = 'S...TESTNET-DEMO-KEY-REDACTED';

export interface AnchorResult {
  success: boolean;
  txHash?: string;
  ledger?: number;
  error?: string;
}

/**
 * Gera o hash SHA-256 de um contrato para prova de existência.
 */
export async function generateContractHash(contractContent: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(contractContent);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Serializa o conteúdo de um contrato para hashing determinístico.
 */
export function serializeContract(contract: {
  title: string;
  description: string;
  clauses: { title: string; content: string; order: number }[];
  parties: { name: string; email: string }[];
}): string {
  const normalized = {
    title: contract.title,
    description: contract.description,
    clauses: contract.clauses
      .sort((a, b) => a.order - b.order)
      .map(c => ({ title: c.title, content: c.content })),
    parties: contract.parties
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(p => ({ name: p.name, email: p.email })),
  };
  return JSON.stringify(normalized);
}

/**
 * Ancora o hash de um contrato na Stellar Testnet via Memo.
 * 
 * NOTA: Esta função usa um par de chaves de demonstração.
 * Em produção, utilize a Freighter Wallet para assinar a transação
 * e a rede principal (Mainnet) da Stellar.
 */
export async function anchorOnStellar(contractHash: string): Promise<AnchorResult> {
  try {
    const server = new StellarSdk.Horizon.Server(TESTNET_HORIZON);
    const keypair = StellarSdk.Keypair.fromSecret(DEMO_SECRET);
    const publicKey = keypair.publicKey();

    // Carregar conta do remetente
    const account = await server.loadAccount(publicKey);

    // Converter hex para Uint8Array (browser-safe, sem Buffer)
    const hex = contractHash.slice(0, 56);
    const memoHash = new Uint8Array(28);
    for (let i = 0; i < 28; i++) memoHash[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);

    // Construir transação
    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: TESTNET_PASSPHRASE,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: publicKey, // self-payment (0.0000001 XLM)
          asset: StellarSdk.Asset.native(),
          amount: '0.0000001',
        })
      )
      .addMemo(StellarSdk.Memo.hash(memoHash))
      .setTimeout(30)
      .build();

    tx.sign(keypair);

    const result = await server.submitTransaction(tx);
    return {
      success: true,
      txHash: (result as any).hash,
      ledger: (result as any).ledger,
    };
  } catch (error: any) {
    console.error('Stellar anchor error:', error);
    return {
      success: false,
      error: error?.message || 'Falha ao ancorar na Stellar',
    };
  }
}

/**
 * Ancora via Freighter Wallet (requer extensão instalada).
 * A transação é construída mas assinada pela carteira do usuário.
 */
export async function anchorWithFreighter(contractHash: string): Promise<AnchorResult> {
  try {
    const freighter = await import('@stellar/freighter-api');
    const { isConnected, getAddress, signTransaction } = freighter;

    const connected = await isConnected();
    if (!connected) {
      return { success: false, error: 'Freighter não está instalado ou conectado.' };
    }

    const addressResult = await getAddress();
    if (!addressResult.address) {
      return { success: false, error: 'Não foi possível obter o endereço da carteira.' };
    }
    const publicKey = addressResult.address;

    const server = new StellarSdk.Horizon.Server(TESTNET_HORIZON);
    const account = await server.loadAccount(publicKey);
    const hexFr = contractHash.slice(0, 56);
    const memoHash = new Uint8Array(28);
    for (let i = 0; i < 28; i++) memoHash[i] = parseInt(hexFr.slice(i * 2, i * 2 + 2), 16);

    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: TESTNET_PASSPHRASE,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: publicKey,
          asset: StellarSdk.Asset.native(),
          amount: '0.0000001',
        })
      )
      .addMemo(StellarSdk.Memo.hash(memoHash))
      .setTimeout(30)
      .build();

    const signedXdr = await signTransaction(tx.toXDR(), {
      networkPassphrase: TESTNET_PASSPHRASE,
    });

    if (!signedXdr) {
      return { success: false, error: 'Transação rejeitada pelo usuário.' };
    }

    const signedTx = StellarSdk.TransactionBuilder.fromXDR(
      typeof signedXdr === 'string' ? signedXdr : (signedXdr as any).signedTxXdr,
      TESTNET_PASSPHRASE
    );
    const result = await server.submitTransaction(signedTx);

    return {
      success: true,
      txHash: (result as any).hash,
      ledger: (result as any).ledger,
    };
  } catch (error: any) {
    console.error('Freighter anchor error:', error);
    return {
      success: false,
      error: error?.message || 'Falha na ancoragem via Freighter',
    };
  }
}

/**
 * Verifica se um hash de contrato existe na Stellar Testnet
 * consultando a transação pelo seu hash.
 */
export async function verifyOnStellar(txHash: string): Promise<{
  verified: boolean;
  ledger?: number;
  timestamp?: string;
  memo?: string;
}> {
  try {
    const server = new StellarSdk.Horizon.Server(TESTNET_HORIZON);
    const tx = await server.transactions().transaction(txHash).call();
    
    return {
      verified: true,
      ledger: tx.ledger_attr as any,
      timestamp: tx.created_at,
      memo: tx.memo,
    };
  } catch {
    return { verified: false };
  }
}

/**
 * Cria uma conta Multi-Sig na Stellar (Simulação)
 */
export async function createMultiSig(signers: string[], threshold: number) {
  await new Promise(r => setTimeout(r, 2000));
  return {
    success: true,
    address: 'GA...' + Math.random().toString(36).substring(7).toUpperCase(),
    signers: signers,
    threshold: threshold,
    txHash: 'multi_sig_' + Date.now()
  };
}

/**
 * Emite um NFT representando a propriedade de um contrato (Simulação)
 */
export async function mintContractNFT(contractId: string, ownerAddress: string) {
  await new Promise(r => setTimeout(r, 2500));
  return {
    success: true,
    assetCode: 'CTRT' + contractId.substring(0, 4),
    issuer: 'GA_ISSUER...',
    txHash: 'nft_mint_' + Date.now()
  };
}

/**
 * Cria um contrato de Escrow (Smart Clause) na Stellar (Simulação)
 */
export async function createEscrow(amount: string, releaseConditions: string) {
  await new Promise(r => setTimeout(r, 3000));
  return {
    success: true,
    escrowAddress: 'GE...' + Math.random().toString(36).substring(7).toUpperCase(),
    lockedAmount: amount,
    conditions: releaseConditions,
    txHash: 'escrow_tx_' + Date.now()
  };
}

/**
 * Link do explorer da Stellar para uma transação
 */
export function getStellarExplorerUrl(txHash: string, network: 'testnet' | 'mainnet' = 'testnet'): string {
  return `https://stellar.expert/explorer/${network}/tx/${txHash}`;
}
