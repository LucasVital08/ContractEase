
import { motion } from 'motion/react';
import type { Contract } from '../data/mockContractEase';

interface Props {
  contracts: Contract[];
  loading: boolean;
}

export default function ContractList({ contracts, loading }: Props) {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'pending': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'completed': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'failed': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'pending': return 'Pendente';
      case 'completed': return 'Concluído';
      case 'failed': return 'Falhou';
      default: return status;
    }
  };

  return (
    <div className="space-y-4">
      {contracts.map((contract, index) => (
        <motion.div
          key={contract.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="bg-neutral-900/50 border border-white/5 rounded-xl p-6 hover:bg-neutral-800/50 transition-colors"
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-emerald-500 font-mono text-sm">{contract.id}</span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(contract.status)}`}>
                  {getStatusText(contract.status)}
                </span>
              </div>
              <h3 className="text-xl font-bold text-white mb-1">{contract.title}</h3>
              <p className="text-neutral-400 text-sm">
                Partes: {contract.parties.join(' ↔ ')}
              </p>
            </div>
            
            <div className="text-left md:text-right">
              <p className="text-neutral-500 text-xs mt-1">
                Expira em: {new Date(contract.expiresAt).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
        </motion.div>
      ))}
      {contracts.length === 0 && (
        <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
          <iconify-icon icon="solar:document-add-linear" class="text-4xl text-neutral-500 mb-3"></iconify-icon>
          <p className="text-neutral-400">Nenhum contrato encontrado.</p>
        </div>
      )}
    </div>
  );
}
