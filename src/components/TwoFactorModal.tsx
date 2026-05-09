import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '@/services/api';
import { useNotificationStore } from '@/stores';

interface TwoFactorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function TwoFactorModal({ isOpen, onClose, onSuccess }: TwoFactorModalProps) {
  const [step, setStep] = useState<'intro' | 'qr' | 'verify' | 'success'>('intro');
  const [enrollData, setEnrollData] = useState<any>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const notify = useNotificationStore(s => s.add);

  useEffect(() => {
    if (!isOpen) {
      setStep('intro');
      setEnrollData(null);
      setVerifyCode('');
      setIsLoading(false);
    }
  }, [isOpen]);

  const handleStartEnroll = async () => {
    setIsLoading(true);
    try {
      const data = await api.auth.mfa.enroll();
      setEnrollData(data);
      setStep('qr');
    } catch (e: any) {
      notify({ type: 'error', title: 'Erro ao iniciar 2FA', message: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (verifyCode.length !== 6) return;
    setIsLoading(true);
    try {
      const challenge = await api.auth.mfa.challenge(enrollData.id);
      await api.auth.mfa.verify(enrollData.id, challenge.id, verifyCode);
      setStep('success');
      onSuccess();
    } catch (e: any) {
      notify({ type: 'error', title: 'Código inválido', message: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-neutral-900 border border-white/10 rounded-3xl w-full max-w-md overflow-hidden premium-shadow"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <iconify-icon icon="solar:shield-check-bold-duotone" class="text-2xl text-emerald-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Autenticação 2FA</h2>
                <p className="text-xs text-neutral-400">Segurança de dois fatores (TOTP)</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-neutral-400 hover:text-white transition-colors">
              <iconify-icon icon="solar:close-circle-bold" />
            </button>
          </div>

          <AnimatePresence mode="wait">
            {step === 'intro' && (
              <motion.div
                key="intro"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4">
                  <p className="text-sm text-neutral-300 leading-relaxed">
                    A autenticação de dois fatores adiciona uma camada extra de segurança. Você precisará de um aplicativo como 
                    <span className="text-white font-bold"> Google Authenticator</span> ou 
                    <span className="text-white font-bold"> Microsoft Authenticator</span>.
                  </p>
                </div>
                <button
                  onClick={handleStartEnroll}
                  disabled={isLoading}
                  className="w-full py-4 bg-emerald-500 text-black font-bold rounded-2xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? <iconify-icon icon="svg-spinners:ring-resize" /> : <iconify-icon icon="solar:bolt-bold" />}
                  Configurar Agora
                </button>
              </motion.div>
            )}

            {step === 'qr' && (
              <motion.div
                key="qr"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="text-center space-y-6"
              >
                <p className="text-sm text-neutral-400">Escaneie o QR Code abaixo com seu app de autenticação:</p>
                
                <div className="bg-white p-2 rounded-[2rem] mx-auto shadow-2xl shadow-emerald-500/10 border-4 border-emerald-500/5 w-64 h-64 flex items-center justify-center overflow-hidden">
                  {enrollData?.totp?.qr_code ? (
                    enrollData.totp.qr_code.startsWith('<svg') ? (
                      <div 
                        dangerouslySetInnerHTML={{ __html: enrollData.totp.qr_code }} 
                        className="w-full h-full flex items-center justify-center [&>svg]:max-w-full [&>svg]:max-h-full [&>svg]:w-full [&>svg]:h-full [&>svg]:block"
                      />
                    ) : (
                      <img 
                        src={enrollData.totp.qr_code} 
                        alt="QR Code" 
                        className="w-full h-full object-contain p-4"
                      />
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-neutral-100 rounded-2xl">
                      <iconify-icon icon="svg-spinners:ring-resize" class="text-3xl text-neutral-400" />
                    </div>
                  )}
                </div>

                <div className="text-left space-y-2">
                  <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Ou insira o código manualmente:</p>
                  <code className="block bg-black/50 border border-white/5 p-3 rounded-xl text-xs text-emerald-400 font-mono break-all select-all">
                    {enrollData?.totp?.secret}
                  </code>
                </div>

                <button
                  onClick={() => setStep('verify')}
                  className="w-full py-4 bg-white/5 border border-white/10 text-white font-bold rounded-2xl hover:bg-white/10 transition-all"
                >
                  Já escaneei, continuar
                </button>
              </motion.div>
            )}

            {step === 'verify' && (
              <motion.div
                key="verify"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <label className="block text-sm font-bold text-white mb-2 text-center">Digite o código de 6 dígitos</label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-black/50 border border-white/10 rounded-2xl px-6 py-4 text-3xl font-mono text-center text-emerald-500 focus:outline-none focus:border-emerald-500/50 tracking-[0.5em]"
                    autoFocus
                  />
                </div>
                <button
                  onClick={handleVerify}
                  disabled={isLoading || verifyCode.length !== 6}
                  className="w-full py-4 bg-emerald-500 text-black font-bold rounded-2xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? <iconify-icon icon="svg-spinners:ring-resize" /> : <iconify-icon icon="solar:check-read-bold" />}
                  Verificar e Ativar
                </button>
                <button
                  onClick={() => setStep('qr')}
                  className="w-full text-xs text-neutral-500 hover:text-white"
                >
                  Voltar para o QR Code
                </button>
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8 space-y-6"
              >
                <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                  <iconify-icon icon="solar:check-circle-bold" class="text-5xl text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">2FA Ativado com Sucesso!</h3>
                  <p className="text-sm text-neutral-400">Sua conta agora está protegida com autenticação de dois fatores.</p>
                </div>
                <button
                  onClick={onClose}
                  className="w-full py-4 bg-white/5 border border-white/10 text-white font-bold rounded-2xl hover:bg-white/10 transition-all"
                >
                  Fechar
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
