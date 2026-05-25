import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useWalletStore, useNotificationStore } from '@/stores';
import { friendbotUrl, shortenAddress } from '@/services/stellarWallet';

/**
 * Botão de conectar Freighter — colocado no Topbar.
 * Mostra estado: instalada / conectada / endereço / network.
 */
export default function WalletConnectButton() {
  const { isInstalled, isConnected, address, network, connecting, connect, refresh, disconnect } =
    useWalletStore();
  const notify = useNotificationStore((s) => s.add);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleConnect() {
    try {
      const state = await connect();
      notify({
        type: 'success',
        title: 'Carteira conectada',
        message: `${shortenAddress(state.address ?? '')} · ${state.network ?? 'testnet'}`,
      });
    } catch (err: any) {
      notify({
        type: 'error',
        title: 'Falha ao conectar carteira',
        message: err?.message || 'Verifique se a extensão Freighter está instalada',
      });
    }
  }

  // Estado: extensão não instalada
  if (!isInstalled) {
    return (
      <button
        onClick={() => window.open('https://freighter.app/', '_blank', 'noopener,noreferrer')}
        className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/40 transition-colors"
        title="Conectar carteira. Se a Freighter não estiver instalada, abriremos a página de instalação."
      >
        <iconify-icon icon="solar:wallet-2-bold-duotone" class="text-base" />
        Conectar carteira
      </button>
    );
  }

  // Estado: instalada mas não conectada
  if (!isConnected || !address) {
    return (
      <button
        onClick={handleConnect}
        disabled={connecting}
        className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/40 transition-colors disabled:opacity-50"
      >
        <iconify-icon icon="solar:wallet-2-bold-duotone" class="text-base" />
        {connecting ? 'Conectando...' : 'Conectar carteira'}
      </button>
    );
  }

  // Estado: conectada
  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300 hover:bg-emerald-500/10 transition-colors"
      >
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <iconify-icon icon="solar:wallet-2-bold-duotone" class="text-base" />
        <span className="font-mono">{shortenAddress(address)}</span>
        <iconify-icon
          icon={menuOpen ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
          class="text-xs"
        />
      </button>

      <AnimatePresence>
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 z-50 w-80 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="p-4 border-b border-white/5">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold mb-1">
                  Carteira conectada
                </div>
                <div className="font-mono text-sm text-white break-all leading-snug">
                  {address}
                </div>
                <div className="flex items-center gap-2 mt-2 text-[11px]">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                    {network ?? 'TESTNET'}
                  </span>
                  <a
                    href={`https://stellar.expert/explorer/${
                      network?.toLowerCase().includes('public') ? 'public' : 'testnet'
                    }/account/${address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neutral-400 hover:text-emerald-400 flex items-center gap-1"
                  >
                    Explorer
                    <iconify-icon icon="solar:square-arrow-right-up-linear" />
                  </a>
                </div>
              </div>

              <div className="p-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(address);
                    notify({ type: 'success', title: 'Endereço copiado', message: '' });
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-neutral-300 hover:bg-white/5 rounded-md flex items-center gap-2"
                >
                  <iconify-icon icon="solar:copy-linear" />
                  Copiar endereço
                </button>
                <a
                  href={friendbotUrl(address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full text-left px-3 py-2 text-xs text-neutral-300 hover:bg-white/5 rounded-md flex items-center gap-2"
                >
                  <iconify-icon icon="solar:test-tube-bold-duotone" />
                  Fundar com testnet (friendbot)
                </a>
                <button
                  onClick={() => {
                    disconnect();
                    setMenuOpen(false);
                    notify({ type: 'info', title: 'Carteira desconectada', message: '' });
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-md flex items-center gap-2"
                >
                  <iconify-icon icon="solar:logout-2-linear" />
                  Desconectar do app
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
