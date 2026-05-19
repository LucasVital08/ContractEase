import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores';

const MONTH_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export default function AnalyticsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const user = useAuthStore(s => s.user);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      setLoading(true);
      const data = await api.analytics.getUserStats();
      setStats(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  const handleExportReport = () => {
    if (!stats?.contracts) return;
    const rows = [
      ['ID', 'Título', 'Status', 'Data de Criação', 'Ancorado na Stellar'],
      ...stats.contracts.map((c: any) => [
        c.id,
        `"${c.title}"`,
        c.status,
        new Date(c.created_at).toLocaleDateString('pt-BR'),
        c.stellar_tx_hash ? 'Sim' : 'Não',
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-contractease-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Contratos expirando nos próximos 45 dias
  const expiringContracts = useMemo(() => {
    if (!stats?.contracts) return [];
    const now = new Date();
    const deadline = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);
    return stats.contracts.filter((c: any) => {
      if (!c.expires_at || c.status === 'completed' || c.status === 'cancelled') return false;
      const exp = new Date(c.expires_at);
      return exp > now && exp <= deadline;
    });
  }, [stats]);

  const monthlyData = useMemo(() => {
    if (!stats?.contracts) return Array(12).fill(0);
    const months = Array(12).fill(0);
    stats.contracts.forEach((c: any) => {
      const date = new Date(c.created_at);
      if (date.getFullYear() === currentYear) {
        months[date.getMonth()]++;
      }
    });
    return months;
  }, [stats, currentYear]);

  const maxContracts = Math.max(...monthlyData, 1);

  const statusDist = useMemo(() => {
    if (!stats?.contracts) return { active: 0, pending: 0, completed: 0, other: 0 };
    const total = stats.contracts.length || 1;
    const active = stats.contracts.filter((c: any) => c.status === 'active').length;
    const pending = stats.contracts.filter((c: any) => c.status === 'pending').length;
    const completed = stats.contracts.filter((c: any) => c.status === 'completed' || c.status === 'signed').length;
    
    return {
      active: Math.round((active / total) * 100),
      pending: Math.round((pending / total) * 100),
      completed: Math.round((completed / total) * 100),
      other: Math.max(0, 100 - Math.round((active / total) * 100) - Math.round((pending / total) * 100) - Math.round((completed / total) * 100))
    };
  }, [stats]);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold font-bricolage text-white flex items-center gap-2">
            Analytics & Inteligência <iconify-icon icon="solar:magic-stick-3-bold" class="text-fuchsia-500" />
          </h2>
          <p className="text-neutral-400 mt-1">Métricas, predições e insights dos seus documentos gerados por IA.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportReport} disabled={!stats} className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-medium text-white hover:bg-white/10 transition-colors disabled:opacity-40 flex items-center gap-2">
            <iconify-icon icon="solar:download-minimalistic-bold" /> Exportar CSV
          </button>
        </div>
      </div>
      
      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-neutral-900 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <iconify-icon icon="solar:document-text-bold" />
            </div>
            <p className="text-sm font-medium text-neutral-400">Documentos Totais</p>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{stats?.total || 0}</h3>
          <p className="text-xs text-emerald-400 flex items-center gap-1">
            <iconify-icon icon="solar:history-bold" /> No último ano
          </p>
        </div>
        <div className="bg-neutral-900 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-fuchsia-500/10 flex items-center justify-center text-fuchsia-400">
              <iconify-icon icon="solar:shield-check-bold" />
            </div>
            <p className="text-sm font-medium text-neutral-400">Ancorados On-chain</p>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{stats?.anchored || 0}</h3>
          <p className="text-xs text-emerald-400 flex items-center gap-1">
            <iconify-icon icon="solar:verified-check-bold" /> Integridade Garantida
          </p>
        </div>
        <div className="bg-neutral-900 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <iconify-icon icon="solar:pen-bold" />
            </div>
            <p className="text-sm font-medium text-neutral-400">Assinaturas Coletadas</p>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{stats?.totalSignatures || 0}</h3>
          <p className="text-xs text-neutral-400 flex items-center gap-1">
            Média de 2.4/doc
          </p>
        </div>
        <div className="bg-neutral-900 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
              <iconify-icon icon="solar:clock-circle-bold" />
            </div>
            <p className="text-sm font-medium text-neutral-400">Pendentes</p>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{stats?.pending || 0}</h3>
          <p className="text-xs text-amber-400 flex items-center gap-1">
            Aguardando interação
          </p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart (Contratos por Mês) */}
        <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6 lg:col-span-2 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-white font-bricolage">Documentos Registrados ({currentYear})</h3>
            <div className="text-xs text-neutral-500">Filtrado por: Ano Atual</div>
          </div>
          <div className="flex-1 flex items-end gap-2 h-48 mt-auto">
            {monthlyData.map((val, i) => (
              <div key={i} className="flex-1 flex flex-col justify-end group">
                <div className="w-full bg-emerald-500/20 hover:bg-emerald-500/40 rounded-t-sm transition-all relative" style={{ height: `${(val / maxContracts) * 100}%` }}>
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-xs text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                    {val}
                  </div>
                </div>
                <div className="text-[10px] text-neutral-500 text-center mt-2 font-mono">
                  {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][i]}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6 flex flex-col">
          <h3 className="text-lg font-bold text-white font-bricolage mb-6">Distribuição por Status</h3>
          <div className="flex-1 flex flex-col justify-center">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-emerald-400 font-bold">Ativos</span>
                  <span className="text-white">{statusDist.active}%</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${statusDist.active}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-blue-400 font-bold">Concluídos</span>
                  <span className="text-white">{statusDist.completed}%</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${statusDist.completed}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-amber-400 font-bold">Pendentes</span>
                  <span className="text-white">{statusDist.pending}%</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 transition-all duration-1000" style={{ width: `${statusDist.pending}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Insights Section — dados reais */}
        <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <iconify-icon icon="solar:lightbulb-bolt-bold" class="text-fuchsia-500" />
            Resumo da Conta
          </h3>
          <div className="space-y-3">
            <div className="p-4 bg-white/[0.03] border border-white/5 rounded-xl">
              <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Blockchain</h4>
              <p className="text-sm text-neutral-300">
                {stats?.anchored > 0
                  ? `${stats.anchored} de ${stats.total} contratos estão ancorados na Stellar (${Math.round((stats.anchored / Math.max(stats.total, 1)) * 100)}% de taxa de ancoragem).`
                  : 'Nenhum contrato foi ancorado ainda. A ancoragem acontece automaticamente quando todos os signatários assinam.'}
              </p>
            </div>
            <div className="p-4 bg-white/[0.03] border border-white/5 rounded-xl">
              <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Assinaturas</h4>
              <p className="text-sm text-neutral-300">
                {stats?.totalSignatures > 0
                  ? `${stats.totalSignatures} assinaturas coletadas em ${stats.total} contratos (média de ${(stats.totalSignatures / Math.max(stats.total, 1)).toFixed(1)} por contrato).`
                  : 'Ainda não há assinaturas registradas.'}
              </p>
            </div>
            <div className="p-4 bg-fuchsia-500/5 border border-fuchsia-500/10 rounded-xl flex items-center gap-3">
              <iconify-icon icon="solar:magic-stick-3-bold" class="text-fuchsia-400 text-xl shrink-0" />
              <p className="text-xs text-neutral-400">
                Análise de IA por contrato disponível na página de detalhes de cada documento.
              </p>
            </div>
          </div>
        </div>

        {/* Alertas reais de vencimento */}
        <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <iconify-icon icon="solar:radar-bold" class="text-emerald-500" />
            Alertas de Vencimento (próximos 45 dias)
          </h3>
          {expiringContracts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-neutral-500">
              <iconify-icon icon="solar:check-circle-bold" class="text-3xl text-emerald-500 mb-2" />
              <p className="text-sm">Nenhum contrato vencendo nos próximos 45 dias.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {expiringContracts.slice(0, 4).map((c: any) => {
                const daysLeft = Math.ceil((new Date(c.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={c.id} className="flex items-start gap-3 p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl">
                    <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0">
                      <iconify-icon icon="solar:calendar-date-bold" class="text-lg" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-white truncate">{c.title}</h4>
                      <p className="text-xs text-amber-400 mt-0.5">Vence em {daysLeft} dia{daysLeft !== 1 ? 's' : ''} — {new Date(c.expires_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                );
              })}
              {expiringContracts.length > 4 && (
                <p className="text-xs text-neutral-500 text-center">+ {expiringContracts.length - 4} outros</p>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
