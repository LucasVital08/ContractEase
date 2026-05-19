import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores';
import { api } from '@/services/api';

export default function AdminDashboardPage() {
  const user = useAuthStore(s => s.user);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  if (user && user.role !== 'admin' && user.role !== 'owner') {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    api.analytics.getAdminStats()
      .then(data => setStats(data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  const kpis = [
    { label: 'Workspaces Ativos', value: stats?.total_workspaces ?? '—', sub: `+${stats?.users_this_week ?? 0} usuários esta semana`, icon: 'solar:buildings-bold-duotone', color: 'emerald' },
    { label: 'Usuários Totais', value: stats?.total_users ?? '—', sub: `+${stats?.users_this_week ?? 0} esta semana`, icon: 'solar:users-group-two-rounded-bold-duotone', color: 'blue' },
    { label: 'Documentos Ancorados', value: stats?.anchored_contracts ?? '—', sub: `de ${stats?.total_contracts ?? '—'} contratos totais`, icon: 'solar:document-text-bold-duotone', color: 'fuchsia' },
    { label: 'Receita Total', value: stats?.total_revenue != null ? `R$ ${Number(stats.total_revenue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—', sub: 'Pagamentos confirmados', icon: 'solar:wad-of-money-bold-duotone', color: 'emerald' },
  ];

  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-500',
    blue: 'bg-blue-500/10 text-blue-500',
    fuchsia: 'bg-fuchsia-500/10 text-fuchsia-500',
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white font-bricolage mb-2">Painel Super-Admin</h1>
        <p className="text-neutral-400">Visão global da plataforma ContractEase (dados em tempo real).</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className={`p-3 rounded-xl ${colorMap[kpi.color]}`}>
                <iconify-icon icon={kpi.icon} class="text-2xl" />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-400">{kpi.label}</p>
                <h3 className="text-2xl font-bold text-white">
                  {loading ? <span className="animate-pulse text-neutral-600">—</span> : kpi.value}
                </h3>
              </div>
            </div>
            <p className="text-xs text-neutral-500">{loading ? 'Carregando...' : kpi.sub}</p>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-6">Últimas Organizações Registradas</h3>
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-14 bg-white/[0.03] rounded-xl animate-pulse" />)}</div>
        ) : stats?.recent_organizations?.length > 0 ? (
          <div className="space-y-3">
            {stats.recent_organizations.map((org: any) => (
              <div key={org.id} className="flex items-center justify-between p-4 bg-black/30 rounded-xl border border-white/5 hover:bg-white/5 transition-colors">
                <div>
                  <h4 className="text-sm font-bold text-white">{org.name}</h4>
                  <p className="text-xs text-neutral-500">Cadastrado {new Date(org.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${org.type === 'business' ? 'bg-blue-500/20 text-blue-400' : 'bg-neutral-500/20 text-neutral-400'}`}>
                    {org.type === 'business' ? 'Empresa' : 'Equipe'}
                  </span>
                  <p className="text-xs text-emerald-400 mt-1">{org.member_count} membro{org.member_count !== 1 ? 's' : ''}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-neutral-500 text-sm text-center py-6">Nenhuma organização registrada ainda.</p>
        )}
      </motion.div>
    </div>
  );
}
