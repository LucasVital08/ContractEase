import { create } from 'zustand';
import {
  connectWallet,
  disconnectWallet,
  getWalletState,
  type WalletState,
} from '@/services/stellarWallet';
import {
  getAccountStatus,
  fundTestnetAccount,
  WALLET_PROVIDERS,
  type StellarNetwork,
  type WalletProviderId,
} from '@/services/wallet';
import { getActiveNetwork } from '@/services/wallet/active';

export interface DetectedWallet {
  id: WalletProviderId;
  installed: boolean;
  reason?: string;
}

interface WalletStore extends WalletState {
  connecting: boolean;
  /** Saldo em XLM da conta ativa — `null` enquanto não foi lido. */
  xlm: string | null;
  /** A conta existe na rede? Em Stellar, uma conta só passa a existir com saldo. */
  accountExists: boolean;
  /** Quais carteiras estão presentes neste navegador. */
  detected: DetectedWallet[];

  /** Relê tudo sem abrir popup. */
  refresh: () => Promise<void>;
  /** Descobre quais carteiras estão instaladas. */
  detect: () => Promise<DetectedWallet[]>;
  /** Conecta uma carteira específica (abre popup). */
  connect: (provider?: WalletProviderId, network?: StellarNetwork) => Promise<WalletState>;
  /** Libera saldo de teste (só testnet). */
  fund: () => Promise<void>;
  disconnect: () => void;
}

const EMPTY: WalletState = {
  isInstalled: false,
  isConnected: false,
  address: null,
  network: null,
  provider: null,
};

export const useWalletStore = create<WalletStore>()((set, get) => ({
  ...EMPTY,
  connecting: false,
  xlm: null,
  accountExists: false,
  detected: [],

  detect: async () => {
    const detected = await Promise.all(
      WALLET_PROVIDERS.map(async (p) => {
        const availability = await p.detect().catch(() => ({ installed: false, reason: 'Falha ao detectar' }));
        return { id: p.meta.id, installed: availability.installed, reason: availability.reason };
      }),
    );
    set({ detected });
    return detected;
  },

  refresh: async () => {
    const [state] = await Promise.all([getWalletState(), get().detect()]);
    set(state);

    if (state.address) {
      try {
        const status = await getAccountStatus(state.address, (state.network as StellarNetwork) ?? getActiveNetwork());
        set({ xlm: status.xlm, accountExists: status.exists });
      } catch {
        set({ xlm: null, accountExists: false });
      }
    } else {
      set({ xlm: null, accountExists: false });
    }
  },

  connect: async (provider, network) => {
    set({ connecting: true });
    try {
      const state = await connectWallet(provider, network);
      set({ ...state, connecting: false });
      // Saldo é informativo: a conexão não deve falhar se o Horizon estiver lento.
      void get().refresh();
      return state;
    } catch (err) {
      set({ connecting: false });
      throw err;
    }
  },

  fund: async () => {
    const { address } = get();
    if (!address) throw new Error('Conecte uma carteira antes de pedir saldo de teste.');
    await fundTestnetAccount(address);
    await get().refresh();
  },

  disconnect: () => {
    disconnectWallet();
    set({ ...EMPTY, xlm: null, accountExists: false });
  },
}));
