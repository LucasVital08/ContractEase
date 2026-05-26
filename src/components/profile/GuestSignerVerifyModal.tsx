/**
 * GuestSignerVerifyModal
 *
 * Modal mostrado quando o solicitante do contrato NÃO tem perfil
 * registrado na plataforma — apenas email. Apresenta o que sabemos
 * sobre o convite e força o convidado a confirmar o email antes
 * de prosseguir com a assinatura.
 *
 * Fluxo:
 *   1. Mostra dados do convite (email do remetente, contrato, prazo).
 *   2. Pede para o usuário digitar/confirmar o email dele.
 *   3. Envia OTP via Supabase Edge Function 'signing-otp'.
 *   4. Após verificar OTP, libera para a próxima etapa.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '@/lib/supabase';

interface Props {
  isOpen: boolean;
  requesterEmail: string;
  requesterName?: string;
  contractTitle?: string;
  expiresAt?: string;
  /** Email pré-preenchido do convidado (do contract_parties). */
  inviteeEmail?: string;
  onVerified: (email: string) => void;
  onCancel: () => void;
}

type Step = 'intro' | 'email' | 'otp' | 'done';

export default function GuestSignerVerifyModal({
  isOpen,
  requesterEmail,
  requesterName,
  contractTitle,
  expiresAt,
  inviteeEmail,
  onVerified,
  onCancel,
}: Props) {
  const [step, setStep] = useState<Step>('intro');
  const [email, setEmail] = useState(inviteeEmail ?? '');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  async function sendOtp() {
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Informe um email válido.');
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await supabase.functions.invoke('signing-otp', {
        body: { action: 'send', email, purpose: 'guest_signing' },
      });
      if (err) throw err;
      setStep('otp');
    } catch (e: any) {
      setError(e?.message || 'Falha ao enviar código. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setError(null);
    if (otp.length !== 6) {
      setError('O código tem 6 dígitos.');
      return;
    }
    setLoading(true);
    try {
      const { data, error: err } = await supabase.functions.invoke('signing-otp', {
        body: { action: 'verify', email, purpose: 'guest_signing', code: otp },
      });
      if (err || !data?.valid) throw new Error(data?.error || 'Código inválido');
      setStep('done');
      setTimeout(() => onVerified(email), 600);
    } catch (e: any) {
      setError(e?.message || 'Código inválido ou expirado.');
    } finally {
      setLoading(false);
    }
  }

  const requesterInitial = (requesterName || requesterEmail)[0]?.toUpperCase() || '?';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-md"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 28 }}
          className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/8 bg-neutral-950/95 shadow-[0_24px_90px_rgba(0,0,0,0.45)]"
        >
          <div className="relative h-20 bg-gradient-to-br from-cyan-500/30 via-blue-500/20 to-fuchsia-500/30">
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent" />
            <button
              onClick={onCancel}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/40 text-neutral-200 hover:bg-black/60"
              aria-label="Fechar"
            >
              <iconify-icon icon="solar:close-circle-bold" />
            </button>
          </div>

          <div className="-mt-10 px-6 pb-6">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/20 text-cyan-200">
                <iconify-icon icon="solar:user-id-bold-duotone" class="text-3xl" />
              </div>
              <h2 className="mt-3 text-lg font-bold text-white font-bricolage">
                {step === 'done' ? 'Identidade confirmada!' : 'Confirme sua identidade'}
              </h2>
              <p className="mt-1 max-w-sm text-xs text-neutral-400">
                {step === 'intro' && 'Você foi convidado a assinar um contrato. Antes de continuar, vamos confirmar quem está te enviando e seu email.'}
                {step === 'email' && 'Confirme o email que receberá o código de verificação.'}
                {step === 'otp' && `Enviamos um código de 6 dígitos para ${email}.`}
                {step === 'done' && 'Tudo certo. Você pode prosseguir com a leitura e assinatura do contrato.'}
              </p>
            </div>

            {/* Solicitante */}
            {step === 'intro' && (
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-white/8 bg-black/30 p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                    Solicitante
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/8 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-base font-bold text-white">
                      {requesterInitial}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-white">{requesterName || 'Sem nome cadastrado'}</p>
                      <p className="text-xs text-neutral-400">{requesterEmail}</p>
                    </div>
                  </div>
                </div>

                {(contractTitle || expiresAt) && (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                    {contractTitle && (
                      <p className="flex items-center gap-2 text-sm text-emerald-100">
                        <iconify-icon icon="solar:document-bold" />
                        {contractTitle}
                      </p>
                    )}
                    {expiresAt && (
                      <p className="mt-1 text-[11px] text-emerald-300/70">
                        Prazo para assinar: {new Date(expiresAt).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                )}

                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">
                  <p className="flex items-center gap-1 font-semibold">
                    <iconify-icon icon="solar:info-circle-bold" />
                    Você ainda não tem conta no ContractEase.
                  </p>
                  <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-amber-100/80">
                    <li>Enviamos um código para o seu email.</li>
                    <li>Você confirma sua identidade.</li>
                    <li>Lê e assina o contrato com segurança.</li>
                    <li>(Opcional) cria seu @ depois para ter histórico.</li>
                  </ol>
                </div>

                <button
                  type="button"
                  onClick={() => setStep('email')}
                  className="w-full rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-bold text-black transition hover:bg-emerald-400"
                >
                  Continuar
                </button>
              </div>
            )}

            {step === 'email' && (
              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="text-xs font-medium text-neutral-400">Seu email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@email.com"
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/40"
                  />
                </label>
                {error && (
                  <p className="text-xs text-red-300">{error}</p>
                )}
                <button
                  type="button"
                  disabled={loading || !email}
                  onClick={sendOtp}
                  className="w-full rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-bold text-black transition hover:bg-emerald-400 disabled:opacity-60"
                >
                  {loading ? 'Enviando…' : 'Enviar código'}
                </button>
              </div>
            )}

            {step === 'otp' && (
              <div className="mt-4 space-y-3">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-center text-2xl font-mono tracking-[0.6em] text-white outline-none focus:border-emerald-500/40"
                />
                {error && (
                  <p className="text-xs text-red-300">{error}</p>
                )}
                <button
                  type="button"
                  disabled={loading || otp.length !== 6}
                  onClick={verifyOtp}
                  className="w-full rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-bold text-black transition hover:bg-emerald-400 disabled:opacity-60"
                >
                  {loading ? 'Verificando…' : 'Confirmar código'}
                </button>
                <button
                  type="button"
                  onClick={() => setStep('email')}
                  className="w-full text-center text-xs text-neutral-400 hover:text-neutral-200"
                >
                  Trocar email
                </button>
              </div>
            )}

            {step === 'done' && (
              <div className="mt-4 flex flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/20 text-emerald-200">
                  <iconify-icon icon="solar:check-circle-bold-duotone" class="text-3xl" />
                </div>
                <p className="mt-2 text-sm text-neutral-300">Redirecionando…</p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
