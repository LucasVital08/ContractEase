import { useState, useCallback } from 'react';
import { 
  generateContractHash, 
  serializeContract, 
  anchorOnStellar, 
  anchorWithFreighter, 
  verifyOnStellar,
  getStellarExplorerUrl,
  type AnchorResult 
} from '@/services/stellar';
import { isConnected as checkFreighterConnected, requestAccess, getPublicKey } from '@stellar/freighter-api';
import type { Contract } from '@/types';

export interface UseStellarReturn {
  isAnchoring: boolean;
  isVerifying: boolean;
  isConnected: boolean;
  address: string | null;
  lastResult: AnchorResult | null;
  connectWallet: () => Promise<void>;
  generateHash: (contract: Contract) => Promise<string>;
  anchorContract: (contract: Contract, useFreighter?: boolean) => Promise<AnchorResult>;
  verifyTransaction: (txHash: string) => Promise<{ verified: boolean; ledger?: number; timestamp?: string }>;
  getExplorerUrl: (txHash: string) => string;
}

export function useStellar(): UseStellarReturn {
  const [isAnchoring, setIsAnchoring] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<AnchorResult | null>(null);

  const connectWallet = useCallback(async () => {
    try {
      const isFreighterConnected = await checkFreighterConnected();
      if (!isFreighterConnected) {
        alert('Por favor, instale a extensão Freighter Wallet.');
        return;
      }
      
      const access = await requestAccess();
      if (access) {
        const pubKey = await getPublicKey();
        setAddress(pubKey);
        setIsConnected(true);
      }
    } catch (e) {
      console.error('Falha ao conectar wallet', e);
    }
  }, []);

  const generateHash = useCallback(async (contract: Contract): Promise<string> => {
    const serialized = serializeContract(contract);
    return generateContractHash(serialized);
  }, []);

  const anchorContract = useCallback(async (contract: Contract, useFreighter = false): Promise<AnchorResult> => {
    setIsAnchoring(true);
    try {
      const serialized = serializeContract(contract);
      const hash = await generateContractHash(serialized);
      
      const result = useFreighter 
        ? await anchorWithFreighter(hash)
        : await anchorOnStellar(hash);
      
      setLastResult(result);
      return result;
    } catch (error: any) {
      const result: AnchorResult = { success: false, error: error?.message || 'Erro desconhecido' };
      setLastResult(result);
      return result;
    } finally {
      setIsAnchoring(false);
    }
  }, []);

  const verifyTransaction = useCallback(async (txHash: string) => {
    setIsVerifying(true);
    try {
      return await verifyOnStellar(txHash);
    } finally {
      setIsVerifying(false);
    }
  }, []);

  const getExplorerUrl = useCallback((txHash: string) => {
    return getStellarExplorerUrl(txHash);
  }, []);

  return {
    isAnchoring,
    isVerifying,
    isConnected,
    address,
    lastResult,
    connectWallet,
    generateHash,
    anchorContract,
    verifyTransaction,
    getExplorerUrl,
  };
}
