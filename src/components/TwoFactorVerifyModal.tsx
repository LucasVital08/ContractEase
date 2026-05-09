import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { api } from '@/services/api';
import { useNotificationStore } from '@/stores';

interface TwoFactorVerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  factorId: string;
}

export function TwoFactorVerifyModal({ isOpen, onClose, onSuccess, factorId }: TwoFactorVerifyModalProps) {
  const [verifyCode, setVerifyCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const notify = useNotificationStore(s => s.add);

  useEffect(() => {
    if (!isOpen) {
      setVerifyCode('');
      setIsLoading(false);
    }
  }, [isOpen]);

  const handleVerify = async () => {
    if (verifyCode.length !== 6) return;
    setIsLoading(true);
    try {
      const challenge = await api.auth.mfa.challenge(factorId);
      await api.auth.mfa.verify(factorId, challenge.id, verifyCode);
      notify({ type: 'success', title: 'Acesso Liberado', message: 'Verificação em duas etapas concluída.' });
      onSuccess();
      onClose();
    } catch (e: any) {
      notify({ type: 'error', title: 'Código inválido', message: 'O código inserido está incorreto ou expirou.' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-neutral-900 border border-white/10 rounded-[2.5rem] w-full max-w-sm p-8 premium-shadow text-center"
      >
        <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <iconify-icon icon="solar:shield-keyhole-bold-duotone" class="text-3xl text-emerald-500" />
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-2">Segunda Etapa</h2>
        <p className="text-sm text-neutral-400 mb-8">Insira o código de 6 dígitos do seu aplicativo de autenticação.</p>

        <div className="space-y-6">
          <input
            type="text"
            maxLength={6}
            placeholder="000 000"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
            className="w-full bg-black/50 border border-white/10 rounded-2xl px-6 py-4 text-3xl font-mono text-center text-emerald-500 focus:outline-none focus:border-emerald-500/50 tracking-[0.3em] placeholder:text-white/5"
            autoFocus
          />

          <button
            onClick={handleVerify}
            disabled={isLoading || verifyCode.length !== 6}
            className="w-full py-4 bg-emerald-500 text-black font-bold rounded-2xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <iconify-icon icon="svg-spinners:ring-resize" />
            ) : (
              <>
                <iconify-icon icon="solar:lock-unlock-bold" />
                Verificar e Entrar
              </>
            )}
          </button>
          
          <button
            onClick={onClose}
            className="text-xs text-neutral-600 hover:text-neutral-400"
          >
            Cancelar e Voltar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
