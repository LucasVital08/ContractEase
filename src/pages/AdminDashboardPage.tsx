import { motion } from 'motion/react';
import { useAuthStore } from '@/stores';
import { Navigate } from 'react-router-dom';

export default function AdminDashboardPage() {
  const user = useAuthStore(s => s.user);

  // No sistema real, faríamos um check se user.isSuperAdmin === true.
  // Como estamos mockando, permitimos ver para fins de demonstração,
  // ou poderíamos redirecionar se não fosse.

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white font-bricolage mb-2">Painel Super-Admin</h1>
        <p className="text-neutral-400">Visão global da plataforma ContractEase (SaaS).</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl">
              <iconify-icon icon="solar:buildings-bold-duotone" class="text-2xl text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-400">Workspaces Ativos</p>
              <h3 className="text-2xl font-bold text-white">142</h3>
            </div>
          </div>
          <p className="text-xs text-emerald-400 font-medium">+12 nesta semana</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-500/10 rounded-xl">
              <iconify-icon icon="solar:users-group-two-rounded-bold-duotone" class="text-2xl text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-400">Usuários Totais</p>
              <h3 className="text-2xl font-bold text-white">3.450</h3>
            </div>
          </div>
          <p className="text-xs text-blue-400 font-medium">+150 nesta semana</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-fuchsia-500/10 rounded-xl">
              <iconify-icon icon="solar:document-text-bold-duotone" class="text-2xl text-fuchsia-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-400">Documentos Ancorados</p>
              <h3 className="text-2xl font-bold text-white">12.840</h3>
            </div>
          </div>
          <p className="text-xs text-fuchsia-400 font-medium">+840 nesta semana</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-neutral-900 border border-white/5 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent z-0" />
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-emerald-500/20 rounded-xl">
                <iconify-icon icon="solar:wad-of-money-bold-duotone" class="text-2xl text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-400">MRR (Receita Recorrente)</p>
                <h3 className="text-2xl font-bold text-white">R$ 145.200</h3>
              </div>
            </div>
            <p className="text-xs text-emerald-400 font-medium">+R$ 12.000 (8.5%)</p>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico Fake */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-6">Receita Mensal (Últimos 6 meses)</h3>
          <div className="h-64 flex items-end justify-between gap-2">
            {[40, 55, 45, 70, 85, 100].map((height, i) => (
              <div key={i} className="w-1/6 flex flex-col items-center gap-2">
                <div className="w-full bg-emerald-500/20 rounded-t-lg relative group transition-all hover:bg-emerald-500/40" style={{ height: `${height}%` }}>
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-xs text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    R$ {height * 1.5}k
                  </div>
                </div>
                <span className="text-xs text-neutral-500">Mês {i + 1}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Últimas Organizações */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-6">Últimas Organizações Registradas</h3>
          <div className="space-y-4">
            {[
              { nome: 'TechCorp Solutions', plano: 'Enterprise', data: 'Hoje, 14:30', creditos: 500 },
              { nome: 'Advogados Associados', plano: 'Business', data: 'Hoje, 10:15', creditos: 150 },
              { nome: 'Startup X', plano: 'Starter', data: 'Ontem, 16:45', creditos: 50 },
              { nome: 'Construtora Y', plano: 'Business', data: 'Ontem, 09:20', creditos: 150 },
            ].map((org, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-black/30 rounded-xl border border-white/5 hover:bg-white/5 transition-colors">
                <div>
                  <h4 className="text-sm font-bold text-white">{org.nome}</h4>
                  <p className="text-xs text-neutral-500">Cadastrado {org.data}</p>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${
                    org.plano === 'Enterprise' ? 'bg-fuchsia-500/20 text-fuchsia-400' :
                    org.plano === 'Business' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-neutral-500/20 text-neutral-400'
                  }`}>
                    {org.plano}
                  </span>
                  <p className="text-xs text-emerald-400 mt-1">{org.creditos} crs comprados</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
