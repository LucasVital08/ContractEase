import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { api } from '@/services/api';

export default function AnalyticsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  const monthlyData = useMemo(() => {
    if (!stats?.contracts) return Array(12).fill(0);
    const months = Array(12).fill(0);
    stats.contracts.forEach((c: any) => {
      const date = new Date(c.created_at);
      if (date.getFullYear() === 2025) {
        months[date.getMonth()]++;
      }
    });
    return months;
  }, [stats]);

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
          <button className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-medium text-white hover:bg-white/10 transition-colors">Exportar Relatório</button>
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
            <h3 className="text-lg font-bold text-white font-bricolage">Documentos Registrados (2025)</h3>
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
        {/* Insights Section */}
        <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <iconify-icon icon="solar:lightbulb-bolt-bold" class="text-fuchsia-500" /> 
            Insights Gerados por IA
          </h3>
          <div className="space-y-4">
            <div className="p-4 bg-fuchsia-500/5 border border-fuchsia-500/10 rounded-xl">
              <h4 className="text-sm font-bold text-fuchsia-400 mb-1">Padrão de Rescisão Desfavorável</h4>
              <p className="text-sm text-neutral-400">Notamos que 68% dos seus contratos de "Prestação de Serviços" assinados nos últimos 30 dias não incluem cláusula clara de multa compensatória. Sugerimos atualizar o template padrão.</p>
              <button className="mt-3 text-xs bg-fuchsia-500/20 text-fuchsia-300 px-3 py-1.5 rounded-lg font-medium hover:bg-fuchsia-500/30 transition-colors">
                Revisar Templates Afetados
              </button>
            </div>
            <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl">
              <h4 className="text-sm font-bold text-blue-400 mb-1">Eficiência de Assinatura</h4>
              <p className="text-sm text-neutral-400">A maioria das assinaturas está ocorrendo dentro de 24h após o envio. Documentos enviados entre 09:00 e 11:00 têm uma taxa de conversão 40% mais rápida.</p>
            </div>
          </div>
        </div>

        {/* Predictive & Alerts */}
        <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <iconify-icon icon="solar:radar-bold" class="text-emerald-500" /> 
            Previsões & Alertas
          </h3>
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-3 hover:bg-white/5 rounded-xl transition-colors cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 shrink-0">
                <iconify-icon icon="solar:danger-triangle-bold" class="text-xl" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Alto Risco de Disputa Detectado</h4>
                <p className="text-xs text-neutral-400 mt-1">O documento "Contrato_Fornecimento_TechCorp" (Score: 42) possui termos ambíguos na cláusula de entrega.</p>
                <p className="text-xs text-neutral-500 mt-2">Hoje, 10:30</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4 p-3 hover:bg-white/5 rounded-xl transition-colors cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0">
                <iconify-icon icon="solar:calendar-date-bold" class="text-xl" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Renovações Próximas</h4>
                <p className="text-xs text-neutral-400 mt-1">A IA identificou 5 contratos que devem ser renegociados nos próximos 45 dias com base em cláusulas de vigência extraídas.</p>
                <p className="text-xs text-neutral-500 mt-2">Ontem, 16:45</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-3 hover:bg-white/5 rounded-xl transition-colors cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                <iconify-icon icon="solar:shield-check-bold" class="text-xl" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Análise em Lote Concluída</h4>
                <p className="text-xs text-neutral-400 mt-1">125 documentos históricos foram escaneados via OCR. Nenhuma anomalia crítica foi encontrada.</p>
                <p className="text-xs text-neutral-500 mt-2">Segunda-feira, 09:00</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
