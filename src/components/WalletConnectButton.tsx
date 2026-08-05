/**
 * Indicador de carteira no topo.
 *
 * Deliberadamente NÃO abre popup de conexão. Um botão no cabeçalho que dispara
 * uma janela de extensão é imprevisível — o usuário clica sem saber o que vem.
 * Aqui ele só informa o estado e leva para a tela de Carteira, onde a conexão
 * acontece com contexto e explicação.
 */

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useWalletStore } from '@/stores';
import { shortenAddress } from '@/services/wallet';

export default function WalletConnectButton() {
  const { isConnected, address, network, accountExists, refresh } = useWalletStore();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!isConnected || !address) {
    return (
      <Link
        to="/carteira"
        className="flex items-center gap-2 rounded-xl border border-white/12 px-3 py-2 text-xs font-semibold text-neutral-300 transition-colors hover:border-emerald-400/40 hover:text-white"
      >
        <iconify-icon icon="solar:wallet-2-linear" class="text-base" />
        Conectar carteira
      </Link>
    );
  }

  const healthy = accountExists;

  return (
    <Link
      to="/carteira"
      title={`${address} · ${network === 'mainnet' ? 'rede real' : 'rede de testes'}`}
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
        healthy
          ? 'border-emerald-400/30 bg-emerald-500/[0.06] text-emerald-200 hover:bg-emerald-500/10'
          : 'border-amber-400/30 bg-amber-500/[0.06] text-amber-200 hover:bg-amber-500/10'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${healthy ? 'bg-emerald-400' : 'bg-amber-400'}`} />
      <span className="font-mono">{shortenAddress(address)}</span>
      {network !== 'mainnet' && <span className="text-[10px] uppercase tracking-wider opacity-70">teste</span>}
    </Link>
  );
}
