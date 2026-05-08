
import { motion } from 'motion/react';
import type { Contract } from '../data/mockContractEase';

interface Props {
  contracts: Contract[];
}

export default function ContractStats({ contracts }: Props) {
  const activeCount = contracts.filter(c => c.status === 'active').length;
  const pendingCount = contracts.filter(c => c.status === 'pending').length;
  
  const totalValue = contracts.reduce((acc, curr) => {
    // Convertendo simbolicamente tudo para um valor numérico base para visualização
    // Em uma aplicação real, converteríamos com taxas de câmbio
    return acc + curr.value;
  }, 0);

  const stats = [
    {
      title: 'Contratos Ativos',
      value: activeCount.toString(),
      icon: 'solar:document-text-bold-duotone',
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10'
    },
    {
      title: 'Aguardando Assinatura',
      value: pendingCount.toString(),
      icon: 'solar:pen-bold-duotone',
      color: 'text-amber-500',
      bg: 'bg-amber-500/10'
    },
    {
      title: 'Volume Total (Mix)',
      value: totalValue.toLocaleString('pt-BR'),
      icon: 'solar:wallet-money-bold-duotone',
      color: 'text-blue-500',
      bg: 'bg-blue-500/10'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="bg-neutral-900 border border-white/5 rounded-2xl p-6 relative overflow-hidden"
        >
          <div className="flex items-center justify-between z-10 relative">
            <div>
              <p className="text-neutral-400 text-sm font-medium mb-1">{stat.title}</p>
              <h4 className="text-3xl font-bold text-white font-bricolage">{stat.value}</h4>
            </div>
            <div className={`p-4 rounded-xl ${stat.bg}`}>
              <iconify-icon icon={stat.icon} class={`text-3xl ${stat.color}`}></iconify-icon>
            </div>
          </div>
          
          {/* Decoração de fundo */}
          <div className="absolute -bottom-4 -right-4 opacity-5">
            <iconify-icon icon={stat.icon} class="text-8xl"></iconify-icon>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
