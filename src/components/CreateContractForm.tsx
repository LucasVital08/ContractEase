import { useState } from 'react';
import type { FormEvent } from 'react';
import { motion } from 'motion/react';
import type { Contract } from '../data/mockContractEase';
import { animations } from '@/tokens';

interface Props {
  onSubmit: (data: Omit<Contract, 'id' | 'createdAt' | 'status'>) => Promise<void>;
  onCancel: () => void;
}

type FormStep = 'info' | 'parties' | 'details' | 'review';

export default function CreateContractForm({ onSubmit, onCancel }: Props) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<FormStep>('info');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    title: '',
    party1: '',
    party2: '',
    value: '',
    currency: 'USDC',
    expiresAt: ''
  });

  const steps: { id: FormStep; label: string; icon: string }[] = [
    { id: 'info', label: 'Informações', icon: 'solar:document-bold' },
    { id: 'parties', label: 'Partes', icon: 'solar:users-group-rounded-bold' },
    { id: 'details', label: 'Detalhes', icon: 'solar:settings-bold' },
    { id: 'review', label: 'Revisar', icon: 'solar:check-circle-bold' },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === step);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const validateStep = (stepId: FormStep) => {
    const newErrors: Record<string, string> = {};

    if (stepId === 'info' && !formData.title.trim()) {
      newErrors.title = 'Título é obrigatório';
    }
    if (stepId === 'parties') {
      if (!formData.party1.trim()) newErrors.party1 = 'Parte 1 é obrigatória';
      if (!formData.party2.trim()) newErrors.party2 = 'Parte 2 é obrigatória';
      if (formData.party1 === formData.party2) {
        newErrors.party2 = 'As partes não podem ser iguais';
      }
    }
    if (stepId === 'details') {
      if (!formData.value || Number(formData.value) <= 0) {
        newErrors.value = 'Valor deve ser maior que 0';
      }
      if (!formData.expiresAt) {
        newErrors.expiresAt = 'Data de expiração é obrigatória';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep(step)) {
      const nextIndex = currentStepIndex + 1;
      if (nextIndex < steps.length) {
        setStep(steps[nextIndex].id);
      }
    }
  };

  const handlePrevStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(steps[prevIndex].id);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateStep('review')) return;

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

  const renderFormField = (label: string, key: keyof typeof formData, type: string = 'text', placeholder = '') => (
    <div>
      <label className="flex items-center gap-1 text-sm font-medium text-neutral-300 mb-2">
        {label}
        <span className="text-red-500">*</span>
      </label>
      <input
        required
        type={type}
        className={`w-full bg-black/50 border rounded-lg px-4 py-3 text-white focus:outline-none transition-all ${
          errors[key]
            ? 'border-red-500/50 focus:border-red-500 focus:ring-1 focus:ring-red-500/30'
            : 'border-white/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30'
        }`}
        placeholder={placeholder}
        value={formData[key]}
        onChange={(e) => {
          setFormData({ ...formData, [key]: e.target.value });
          if (errors[key]) setErrors({ ...errors, [key]: '' });
        }}
      />
      {errors[key] && (
        <motion.p className="text-xs text-red-400 mt-1 flex items-center gap-1">
          <iconify-icon icon="solar:danger-triangle-bold" class="text-sm" />
          {errors[key]}
        </motion.p>
      )}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-neutral-900 border border-white/10 rounded-2xl p-8 shadow-2xl max-w-2xl w-full"
    >
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-2 font-bricolage">Novo Contrato Inteligente</h2>
        <p className="text-sm text-neutral-400">Passo {currentStepIndex + 1} de {steps.length}</p>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>

        {/* Steps indicator */}
        <div className="flex justify-between gap-2 mt-6">
          {steps.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                if (i < currentStepIndex || (i === currentStepIndex + 1 && validateStep(step))) {
                  setStep(s.id);
                }
              }}
              disabled={i > currentStepIndex + 1}
              className="flex-1"
            >
              <motion.div
                className={`flex items-center gap-2 p-3 rounded-lg transition-all ${
                  i < currentStepIndex
                    ? 'bg-emerald-500/20 border border-emerald-500/30'
                    : i === currentStepIndex
                    ? 'bg-emerald-500/30 border border-emerald-500/50'
                    : 'bg-white/5 border border-white/10 opacity-50'
                }`}
              >
                <iconify-icon icon={s.icon} class="text-lg" />
                <span className="text-xs font-medium truncate">{s.label}</span>
                {i < currentStepIndex && (
                  <iconify-icon icon="solar:check-circle-bold" class="text-emerald-500 ml-auto" />
                )}
              </motion.div>
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Info Step */}
        <motion.div
          hidden={step !== 'info'}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          {step === 'info' && (
            <div className="space-y-4">
              {renderFormField('Título do Contrato', 'title', 'text', 'Ex: Pagamento de Fornecedor')}
              <p className="text-xs text-neutral-500">Use um nome descritivo para identificar este contrato</p>
            </div>
          )}
        </motion.div>

        {/* Parties Step */}
        <motion.div
          hidden={step !== 'parties'}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          {step === 'parties' && (
            <div className="space-y-4">
              {renderFormField('Parte 1 (Sua Empresa)', 'party1', 'text', 'Nome da sua empresa')}
              {renderFormField('Parte 2 (Contraparte)', 'party2', 'text', 'Nome da contraparte')}
            </div>
          )}
        </motion.div>

        {/* Details Step */}
        <motion.div
          hidden={step !== 'details'}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          {step === 'details' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  {renderFormField('Valor', 'value', 'number', '0.00')}
                </div>
                <div>
                  <label className="flex items-center gap-1 text-sm font-medium text-neutral-300 mb-2">
                    Moeda <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-all appearance-none"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  >
                    <option value="USDC">USDC</option>
                    <option value="XLM">XLM</option>
                    <option value="BRL">BRL</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>
              {renderFormField('Data de Expiração', 'expiresAt', 'date')}
            </div>
          )}
        </motion.div>

        {/* Review Step */}
        <motion.div
          hidden={step !== 'review'}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          {step === 'review' && (
            <div className="space-y-4">
              <div className="glass-panel rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-xs text-neutral-500 uppercase tracking-wider">Título</p>
                  <p className="text-sm font-medium text-white mt-1">{formData.title}</p>
                </div>
                <div className="h-px bg-white/5" />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-neutral-500 uppercase tracking-wider">Parte 1</p>
                    <p className="text-sm font-medium text-white mt-1">{formData.party1}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 uppercase tracking-wider">Parte 2</p>
                    <p className="text-sm font-medium text-white mt-1">{formData.party2}</p>
                  </div>
                </div>
                <div className="h-px bg-white/5" />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-neutral-500 uppercase tracking-wider">Valor</p>
                    <p className="text-sm font-medium text-white mt-1">{formData.value} {formData.currency}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 uppercase tracking-wider">Expiração</p>
                    <p className="text-sm font-medium text-white mt-1">{new Date(formData.expiresAt).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-neutral-500">Verifique os dados antes de criar o contrato</p>
            </div>
          )}
        </motion.div>

        {/* Actions */}
        <div className="flex justify-between gap-3 pt-8 border-t border-white/5">
          <motion.button
            type="button"
            onClick={currentStepIndex === 0 ? onCancel : handlePrevStep}
            className="px-6 py-3 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-all"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {currentStepIndex === 0 ? 'Cancelar' : 'Voltar'}
          </motion.button>

          <motion.button
            type={step === 'review' ? 'submit' : 'button'}
            onClick={step === 'review' ? undefined : handleNextStep}
            disabled={loading}
            className={`px-8 py-3 font-bold rounded-lg transition-all flex items-center gap-2 ${
              step === 'review'
                ? 'bg-emerald-500 hover:bg-emerald-400 text-black disabled:opacity-50'
                : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30'
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }}>
                <iconify-icon icon="solar:refresh-bold" />
              </motion.div>
            ) : (
              <iconify-icon icon={step === 'review' ? 'solar:check-circle-bold' : 'solar:alt-arrow-right-bold'} />
            )}
            {step === 'review' ? 'Criar Contrato' : 'Próximo'}
          </motion.button>
        </div>
      </form>
    </motion.div>
  );
}
