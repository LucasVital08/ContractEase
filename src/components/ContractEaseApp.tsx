import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { getContracts, createContract, type Contract } from '../data/mockContractEase';
import ContractList from './ContractList';
import CreateContractForm from './CreateContractForm';
import ContractStats from './ContractStats';

export default function ContractEaseApp() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    loadContracts();
  }, []);

  const loadContracts = async () => {
    setLoading(true);
    try {
      const data = await getContracts();
      setContracts(data);
    } catch (err) {
      console.error(err);
      showToast('Erro ao carregar contratos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data: Omit<Contract, 'id' | 'createdAt' | 'status'>) => {
    try {
      const newContract = await createContract(data);
      setContracts([newContract, ...contracts]);
      setShowCreateForm(false);
      showToast('Contrato criado com sucesso!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Erro ao criar contrato', 'error');
    }
  };

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="min-h-screen bg-black text-white py-24 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-500">
                <iconify-icon icon="solar:document-text-bold-duotone" class="text-2xl"></iconify-icon>
              </div>
              <h1 className="text-4xl font-bold font-bricolage bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
                ContractEase
              </h1>
              <span className="px-2 py-1 rounded-md bg-white/10 text-xs font-bold text-neutral-300 border border-white/20">MVP</span>
            </div>
            <p className="text-neutral-400 text-lg">Gerenciamento simplificado de contratos inteligentes na Stellar.</p>
          </div>
          
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-6 py-3 bg-white text-black font-bold rounded-full hover:bg-neutral-200 transition-colors flex items-center gap-2"
          >
            <iconify-icon icon="solar:add-circle-bold" class="text-xl"></iconify-icon>
            Novo Contrato
          </button>
        </header>

        {/* Notificações Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`fixed top-24 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full flex items-center gap-3 font-medium shadow-2xl ${
                toast.type === 'success' ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'
              }`}
            >
              <iconify-icon icon={toast.type === 'success' ? 'solar:check-circle-bold' : 'solar:danger-circle-bold'} class="text-xl"></iconify-icon>
              {toast.msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal/Formulário de Criação */}
        <AnimatePresence>
          {showCreateForm && (
            <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={() => setShowCreateForm(false)}
              />
              <div className="relative z-50 w-full max-w-2xl">
                <CreateContractForm 
                  onSubmit={handleCreate} 
                  onCancel={() => setShowCreateForm(false)} 
                />
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* Conteúdo Principal */}
        <main>
          <ContractStats contracts={contracts} />
          
          <div className="flex justify-between items-end mb-6">
            <h2 className="text-2xl font-bold font-bricolage">Contratos Recentes</h2>
            <button 
              onClick={loadContracts}
              className="text-emerald-500 hover:text-emerald-400 flex items-center gap-2 text-sm font-medium transition-colors"
            >
              <iconify-icon icon="solar:refresh-bold" class={loading ? 'animate-spin' : ''}></iconify-icon>
              Atualizar
            </button>
          </div>
          
          <ContractList contracts={contracts} loading={loading} />
        </main>
      </div>
    </div>
  );
}
