import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { useContracts } from '@/hooks/useContractQueries';
import { useAuthStore } from '@/stores';
import type { Contract } from '@/types';

function StatCard({ title, value, icon, color, bg, delay = 0 }: { title: string; value: string; icon: string; color: string; bg: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-neutral-900 border border-white/5 rounded-2xl p-6 relative overflow-hidden"
    >
      <div className="flex items-center justify-between relative z-10">
        <div>
          <p className="text-neutral-400 text-sm font-medium mb-1">{title}</p>
          <h4 className="text-3xl font-bold text-white font-bricolage">{value}</h4>
        </div>
        <div className={`p-4 rounded-xl ${bg}`}>
          <iconify-icon icon={icon} class={`text-3xl ${color}`} />
        </div>
      </div>
      <div className="absolute -bottom-4 -right-4 opacity-[0.03]">
        <iconify-icon icon={icon} class="text-[120px]" />
      </div>
    </motion.div>
  );
}

function RecentRow({ contract }: { contract: Contract }) {
  const statusMap: Record<string, { label: string; cls: string }> = {
    active: { label: 'Ativo', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    pending: { label: 'Pendente', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    completed: { label: 'Concluído', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    draft: { label: 'Rascunho', cls: 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30' },
    cancelled: { label: 'Cancelado', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
    archived: { label: 'Arquivado', cls: 'bg-neutral-600/20 text-neutral-500 border-neutral-600/30' },
  };
  const s = statusMap[contract.status] ?? statusMap.draft;

  return (
    <Link to={`/contracts/${contract.id}`} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] px-2 -mx-2 rounded-lg transition-colors">
      <div className="flex items-center gap-3">
        <span className="text-emerald-500 font-mono text-xs">{contract.id}</span>
        <span className="text-white text-sm font-medium">{contract.title}</span>
        {contract.stellarTxHash && (
          <iconify-icon icon="solar:shield-check-bold" class="text-emerald-500 text-sm" />
        )}
      </div>
      <div className="flex items-center gap-4">
        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${s.cls}`}>
          {s.label}
        </span>
      </div>
    </Link>
  );
}

const DEFAULT_WIDGETS = {
  stats: true,
  blockchain: true,
  expirations: true,
  activity: true
};

export default function DashboardPage() {
  const { data: contracts = [], isLoading } = useContracts();
  const { user, organization } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [visibleWidgets, setVisibleWidgets] = useState(() => {
    const saved = localStorage.getItem('dashboard_widgets');
    return saved ? JSON.parse(saved) : DEFAULT_WIDGETS;
  });

  const toggleWidget = (id: keyof typeof DEFAULT_WIDGETS) => {
    const next = { ...visibleWidgets, [id]: !visibleWidgets[id] };
    setVisibleWidgets(next);
    localStorage.setItem('dashboard_widgets', JSON.stringify(next));
  };

  const active = contracts.filter((c) => c.status === 'active').length;
  const pending = contracts.filter((c) => c.status === 'pending').length;
  const anchored = contracts.filter((c) => c.stellarTxHash).length;
  const totalSignatures = contracts.reduce((sum, c) => sum + c.parties.filter(p => p.signedAt).length, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white font-bricolage">Dashboard</h1>
          <p className="text-neutral-400 text-sm">Bem-vindo de volta, {user?.name.split(' ')[0]}!</p>
        </div>
        <button 
          onClick={() => setIsEditing(!isEditing)}
          className={`px-3 py-1.5 rounded-lg border transition-all flex items-center gap-2 text-xs font-bold ${
            isEditing 
              ? 'bg-emerald-500 border-emerald-400 text-black' 
              : 'bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10'
          }`}
        >
          <iconify-icon icon={isEditing ? 'solar:check-read-bold' : 'solar:widget-add-bold'} />
          {isEditing ? 'Salvar Layout' : 'Customizar Painel'}
        </button>
      </div>

      <AnimatePresence>
        {isEditing && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-8"
          >
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-wrap gap-4 items-center">
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mr-2">Widgets Disponíveis:</p>
              {Object.keys(DEFAULT_WIDGETS).map((id) => (
                <button
                  key={id}
                  onClick={() => toggleWidget(id as any)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${
                    visibleWidgets[id as keyof typeof DEFAULT_WIDGETS]
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-white/5 border-white/10 text-neutral-500 opacity-50'
                  }`}
                >
                  <iconify-icon icon={
                    id === 'stats' ? 'solar:chart-2-bold' :
                    id === 'blockchain' ? 'solar:shield-check-bold' :
                    id === 'expirations' ? 'solar:calendar-bold' : 'solar:list-bold'
                  } />
                  {id.charAt(0).toUpperCase() + id.slice(1)}
                  {visibleWidgets[id as keyof typeof DEFAULT_WIDGETS] && <iconify-icon icon="solar:check-circle-bold" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      {visibleWidgets.stats && (
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 transition-all ${isEditing ? 'opacity-50 scale-[0.98]' : ''}`}>
          <StatCard title="Total de Documentos" value={contracts.length.toString()} icon="solar:document-text-bold-duotone" color="text-emerald-500" bg="bg-emerald-500/10" delay={0} />
          <StatCard title="Documentos Ativos" value={active.toString()} icon="solar:check-circle-bold-duotone" color="text-blue-500" bg="bg-blue-500/10" delay={0.05} />
          <StatCard title="Aguardando Assinatura" value={pending.toString()} icon="solar:pen-bold-duotone" color="text-amber-500" bg="bg-amber-500/10" delay={0.1} />
          <div className="block">
            <StatCard title="Eficiência de Fechamento" value={`${contracts.length > 0 ? Math.round((active / contracts.length) * 100) : 0}%`} icon="solar:bolt-circle-bold-duotone" color="text-violet-500" bg="bg-violet-500/10" delay={0.15} />
          </div>
        </div>
      )}

      {/* Blockchain Stats */}
      {visibleWidgets.blockchain && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className={`bg-gradient-to-r from-emerald-500/5 to-cyan-500/5 border border-emerald-500/10 rounded-2xl p-6 ${isEditing ? 'opacity-50 scale-[0.98]' : ''}`}>
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-emerald-500/10 rounded-xl">
              <iconify-icon icon="solar:shield-network-bold-duotone" class="text-2xl text-emerald-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-bricolage">Stellar Blockchain</h3>
              <p className="text-xs text-neutral-400">Testnet · Proof of Existence</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-black/30 rounded-xl p-4 border border-white/5">
              <p className="text-xs text-neutral-500 mb-1">Documentos Ancorados</p>
              <p className="text-2xl font-bold text-emerald-400 font-bricolage">{anchored}</p>
            </div>
            <div className="bg-black/30 rounded-xl p-4 border border-white/5">
              <p className="text-xs text-neutral-500 mb-1">Assinaturas Coletadas</p>
              <p className="text-2xl font-bold text-blue-400 font-bricolage">{totalSignatures}</p>
            </div>
            <div className="bg-black/30 rounded-xl p-4 border border-white/5">
              <p className="text-xs text-neutral-500 mb-1">Taxa de Ancoragem</p>
              <p className="text-2xl font-bold text-amber-400 font-bricolage">
                {contracts.length > 0 ? Math.round((anchored / contracts.length) * 100) : 0}%
              </p>
            </div>
            <div className="bg-black/30 rounded-xl p-4 border border-white/5">
              <p className="text-xs text-neutral-500 mb-1">Rede</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-sm font-semibold text-emerald-400">Testnet Ativa</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent contracts */}
        {visibleWidgets.activity && (
          <div className={`bg-neutral-900 border border-white/5 rounded-2xl p-6 lg:col-span-2 ${isEditing ? 'opacity-50 scale-[0.98]' : ''}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white font-bricolage">Documentos Recentes</h3>
              <Link to="/contracts" className="text-xs text-emerald-400 hover:underline">Ver todos</Link>
            </div>
            {contracts.length === 0 ? (
              <p className="text-neutral-500 text-sm">Nenhum documento encontrado.</p>
            ) : (
              <div>
                {contracts.slice(0, 5).map((c) => (
                  <RecentRow key={c.id} contract={c} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Next Expirations Widget */}
        {visibleWidgets.expirations && (
          <div className={`bg-neutral-900 border border-white/5 rounded-2xl p-6 ${isEditing ? 'opacity-50 scale-[0.98]' : ''}`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white font-bricolage flex items-center gap-2">
                <iconify-icon icon="solar:alarm-bold" class="text-amber-500" /> Próximos Vencimentos
              </h3>
              <span className="text-[10px] text-neutral-500 uppercase font-bold">30 dias</span>
            </div>
            <div className="space-y-4">
              {contracts.filter(c => c.status === 'active').slice(0, 3).map(c => (
                <div key={c.id} className="p-3 bg-black/30 border border-white/5 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-white truncate max-w-[120px]">{c.title}</p>
                    <p className="text-[10px] text-neutral-500">{new Date(c.expiresAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">Em breve</span>
                  </div>
                </div>
              ))}
              {contracts.filter(c => c.status === 'active').length === 0 && (
                <p className="text-center text-neutral-500 py-10 text-sm">Nenhum vencimento próximo.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
