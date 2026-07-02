import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { connectWallet, getWalletState, type WalletState } from '@/services/stellarWallet';

interface WalletStore extends WalletState {
  /** True enquanto a conexão está acontecendo (prompt aberto) */
  connecting: boolean;
  /** Carrega o estado atual da extensão (sem disparar prompt) */
  refresh: () => Promise<void>;
  /** Pede conexão à carteira (dispara prompt) */
  connect: () => Promise<WalletState>;
  /** Desconecta apenas no app — a Freighter mantém a permissão */
  disconnect: () => void;
}

export const useWalletStore = create<WalletStore>()(
  persist(
    (set) => ({
      isInstalled: false,
      isConnected: false,
      address: null,
      network: null,
      connecting: false,

      refresh: async () => {
        const state = await getWalletState();
        set(state);
      },

      connect: async () => {
        set({ connecting: true });
        try {
          const state = await connectWallet();
          set({ ...state, connecting: false });
          return state;
        } catch (err) {
          set({ connecting: false });
          throw err;
        }
      },

      disconnect: () => {
        set({ isConnected: false, address: null, network: null });
      },
    }),
    {
      name: 'contractease-wallet',
      // Não persistimos isInstalled/connecting — sempre re-verificar na inicialização
      partialize: (s) => ({ isConnected: s.isConnected, address: s.address, network: s.network }),
      // O estado persistido pode estar obsoleto (extensão removida/trocada de
      // conta). Revalida contra a Freighter assim que o store hidrata, para a
      // UI não mostrar "conectado" com uma carteira que não está mais lá.
      onRehydrateStorage: () => (state) => {
        state?.refresh().catch(() => {
          state.disconnect();
        });
      },
    },
  ),
);
