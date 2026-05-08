import { useState } from 'react';
import type { FormEvent } from 'react';
import { motion } from 'motion/react';
import type { Contract } from '../data/mockContractEase';

interface Props {
  onSubmit: (data: Omit<Contract, 'id' | 'createdAt' | 'status'>) => Promise<void>;
  onCancel: () => void;
}

export default function CreateContractForm({ onSubmit, onCancel }: Props) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    party1: '',
    party2: '',
    value: '',
    currency: 'USDC',
    expiresAt: ''
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        title: formData.title,
        parties: [formData.party1, formData.party2],
        value: Number(formData.value),
        currency: formData.currency,
        expiresAt: new Date(formData.expiresAt).toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-neutral-900 border border-white/10 rounded-2xl p-8 shadow-2xl"
    >
      <h2 className="text-2xl font-bold text-white mb-6 font-bricolage">Novo Contrato Inteligente</h2>
      
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-neutral-400 mb-1">Título do Contrato</label>
          <input
            required
            type="text"
            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
            placeholder="Ex: Pagamento de Fornecedor"
            value={formData.title}
            onChange={(e) => setFormData({...formData, title: e.target.value})}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Parte 1 (Sua Empresa)</label>
            <input
              required
              type="text"
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="Nome da Parte 1"
              value={formData.party1}
              onChange={(e) => setFormData({...formData, party1: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Parte 2 (Contraparte)</label>
            <input
              required
              type="text"
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="Nome da Parte 2"
              value={formData.party2}
              onChange={(e) => setFormData({...formData, party2: e.target.value})}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-neutral-400 mb-1">Valor</label>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="0.00"
              value={formData.value}
              onChange={(e) => setFormData({...formData, value: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Moeda</label>
            <select
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors appearance-none"
              value={formData.currency}
              onChange={(e) => setFormData({...formData, currency: e.target.value})}
            >
              <option value="USDC">USDC</option>
              <option value="XLM">XLM</option>
              <option value="BRL">BRL</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-400 mb-1">Data de Expiração</label>
          <input
            required
            type="date"
            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
            value={formData.expiresAt}
            onChange={(e) => setFormData({...formData, expiresAt: e.target.value})}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 rounded-lg text-neutral-400 hover:text-white transition-colors"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <div className="animate-spin h-5 w-5 border-2 border-black border-t-transparent rounded-full" />
            ) : (
              <iconify-icon icon="solar:document-add-bold" />
            )}
            Criar Contrato
          </button>
        </div>
      </form>
    </motion.div>
  );
}
