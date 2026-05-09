import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '@/services/api';
import { useAuthStore, useNotificationStore } from '@/stores';

interface OTPModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  purpose: string;
  email?: string;
  digits?: 4 | 6;
}

export function OTPModal({ isOpen, onClose, onSuccess, purpose, email, digits = 4 }: OTPModalProps) {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const user = useAuthStore(s => s.user);
  const notify = useNotificationStore(s => s.add);

  useEffect(() => {
    if (isOpen && (user || email)) {
      if (purpose !== 'supabase_auth') {
        handleGenerate();
      }
    }
  }, [isOpen, user, email]);

  const handleGenerate = async () => {
    if (!user && !email) return;
    try {
      const generatedCode = await api.otp.generate({ 
        userId: user?.id, 
        email: email, 
        purpose 
      });
      console.log('OTP Gerado (Simulação de e-mail):', generatedCode);
      notify({ type: 'info', title: 'Código enviado', message: `Um código de ${digits} dígitos foi enviado para ${email || 'seu e-mail'}.` });
    } catch (e: any) {
      notify({ type: 'error', title: 'Erro ao gerar código', message: e.message });
    }
  };

  const handleVerify = async () => {
    if ((!user && !email) || code.length !== digits) return;
    setIsLoading(true);
    try {
      if (purpose === 'supabase_auth') {
        // Lógica específica para Supabase Auth (Magic Link/OTP)
        const response = await api.auth.verifyOtp(email!, code);
        // O onSuccess do LoginPage vai lidar com o login no store
        onSuccess();
        onClose();
        return;
      }

      const isValid = await api.otp.verify({ 
        userId: user?.id, 
        email: email, 
        code, 
        purpose 
      });
      if (isValid) {
        notify({ type: 'success', title: 'Verificado!', message: 'Código confirmado com sucesso.' });
        onSuccess();
        onClose();
      } else {
        notify({ type: 'error', title: 'Código incorreto', message: 'O código inserido é inválido ou expirou.' });
      }
    } catch (e: any) {
      notify({ type: 'error', title: 'Erro na verificação', message: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-neutral-900 border border-white/10 rounded-[2.5rem] w-full max-w-sm p-8 premium-shadow text-center"
      >
        <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <iconify-icon icon="solar:key-minimalistic-bold-duotone" class="text-3xl text-emerald-500" />
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-2">Verificação OTP</h2>
        <p className="text-sm text-neutral-400 mb-8">Digite o código de {digits} dígitos enviado para {email || 'seu e-mail'}.</p>

        <div className="flex justify-center gap-2 mb-8">
          {Array.from({ length: digits }).map((_, i) => (
            <div key={i} className={`${digits === 6 ? 'w-10 h-12 text-2xl' : 'w-14 h-16 text-3xl'} bg-black/40 border border-white/10 rounded-2xl flex items-center justify-center font-mono text-emerald-500`}>
              {code[i] || ''}
            </div>
          ))}
        </div>

        <input
          type="text"
          maxLength={digits}
          autoFocus
          className="sr-only"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        />

        <div className="grid grid-cols-3 gap-3 mb-8">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '←'].map((key) => (
            <button
              key={key}
              onClick={() => {
                if (key === 'C') setCode('');
                else if (key === '←') setCode(prev => prev.slice(0, -1));
                else if (code.length < digits) setCode(prev => prev + key);
              }}
              className="h-14 bg-white/5 hover:bg-white/10 rounded-xl text-lg font-bold text-white transition-colors"
            >
              {key}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleVerify}
            disabled={isLoading || code.length !== digits}
            className="w-full py-4 bg-emerald-500 text-black font-bold rounded-2xl hover:bg-emerald-400 transition-all disabled:opacity-50"
          >
            {isLoading ? 'Verificando...' : 'Confirmar Código'}
          </button>
          {purpose !== 'supabase_auth' && (
            <button
              onClick={handleGenerate}
              className="text-xs text-neutral-500 hover:text-white"
            >
              Não recebeu? Reenviar código
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs text-neutral-600 hover:text-neutral-400"
          >
            Cancelar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
