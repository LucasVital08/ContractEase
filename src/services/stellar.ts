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

// NOTA: O keypair de ancoragem custodial NÃO fica mais no cliente.
// A ancoragem padrão é delegada ao Edge Function `anchor-on-stellar`,
// que mantém a chave privada em variável de ambiente segura no servidor.

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
 * Delega ao Edge Function `anchor-on-stellar`, que assina a transação
 * com o keypair custodial mantido em variável de ambiente segura no servidor.
 */
export async function anchorOnStellar(contractHash: string, contractId?: string): Promise<AnchorResult> {
  try {
    const { supabase } = await import('@/lib/supabase');
    const { data, error } = await supabase.functions.invoke('anchor-on-stellar', {
      body: { contractHash, contractId, network: 'testnet' },
    });
    if (error) throw error;
    if (!data?.success) return { success: false, error: data?.error || 'Falha ao ancorar' };
    return { success: true, txHash: data.txHash, ledger: data.ledger };
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
      .addMemo(StellarSdk.Memo.hash(contractHash))
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
 * Multi-Sig na Stellar — Fase 2 (não implementado)
 */
export async function createMultiSig(_signers: string[], _threshold: number): Promise<never> {
  throw new Error('Contas Multi-Sig ainda não estão disponíveis. Previsto para a Fase 2.');
}

/**
 * NFT de contrato na Stellar — Fase 3 (não implementado)
 */
export async function mintContractNFT(_contractId: string, _ownerAddress: string): Promise<never> {
  throw new Error('NFT de contratos ainda não está disponível. Previsto para a Fase 3.');
}

/**
 * Escrow (Claimable Balance) na Stellar — Fase 2 (não implementado)
 */
export async function createEscrow(_amount: string, _releaseConditions: string): Promise<never> {
  throw new Error('Escrow via Stellar ainda não está disponível. Previsto para a Fase 2.');
}

/**
 * Link do explorer da Stellar para uma transação
 */
export function getStellarExplorerUrl(txHash: string, network: 'testnet' | 'mainnet' = 'testnet'): string {
  return `https://stellar.expert/explorer/${network}/tx/${txHash}`;
}
