/**
 * SignerVerificationModal
 *
 * Aparece SEMPRE antes de qualquer ato de assinatura. Mostra o perfil do
 * solicitante (quem criou/enviou o contrato) e força o usuário a confirmar
 * que reconhece a pessoa antes de prosseguir.
 *
 * - Carrega o perfil público via profileService (cobertura, badges, trust score)
 * - Resume os "pontos verdes" e "pontos amarelos" do perfil
 * - Exige checkbox de confirmação
 * - Permite "Ver perfil completo" abrindo em nova aba
 * - Permite "Reportar suspeito"
 */

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { profileService, type PublicProfile, classifyTrustScore } from '@/services/profileService';
import { VerificationBadgePill, VerificationLevelPill, VerifiedDot } from './VerificationBadge';
import TrustScoreBadge from './TrustScoreBadge';
import { shortenAddress } from '@/services/stellarWallet';

interface Props {
  isOpen: boolean;
  /** Handle, userId ou email do solicitante. Se vazio, usa `email` */
  requesterHandle?: string;
  /** Caso o solicitante não esteja na plataforma — só email */
  requesterEmail?: string;
  /** Título do contrato a ser assinado (mostrado no modal) */
  contractTitle?: string;
  /** Timestamp do envio para assinatura */
  requestedAt?: string;
  onConfirm: () => void;
  onCancel: () => void;
  onReport?: () => void;
}

export default function SignerVerificationModal({
  isOpen,
  requesterHandle,
  requesterEmail,
  contractTitle,
  requestedAt,
  onConfirm,
  onCancel,
  onReport,
}: Props) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setProfile(null);
      setConfirmed(false);
      setError(null);
      return;
    }
    const lookup = requesterHandle?.replace(/^@/, '') || requesterEmail;
    if (!lookup) return;

    setLoading(true);
    profileService
      .getPublicProfile(lookup)
      .then((p) => {
        setProfile(p);
        setError(null);
      })
      .catch((e) => setError(e?.message || 'Falha ao carregar perfil do solicitante.'))
      .finally(() => setLoading(false));
  }, [isOpen, requesterHandle, requesterEmail]);

  const trustClass = useMemo(
    () => classifyTrustScore(profile?.trustScore ?? 0),
    [profile?.trustScore],
  );

  const positives = useMemo(() => {
    if (!profile) return [];
    const items: { ok: boolean; text: string; icon: string }[] = [];
    items.push({
      ok: profile.verificationBadges.includes('email'),
      text: 'Email confirmado',
      icon: 'solar:letter-unread-bold',
    });
    items.push({
      ok: profile.verificationBadges.includes('phone'),
      text: 'Telefone verificado',
      icon: 'solar:phone-bold',
    });
    items.push({
      ok: profile.verificationBadges.includes('wallet'),
      text: 'Carteira Stellar ativa',
      icon: 'solar:wallet-money-bold',
    });
    items.push({
      ok: profile.verificationBadges.includes('kyc'),
      text: 'KYC completo (documento + selfie)',
      icon: 'solar:shield-user-bold',
    });
    return items;
  }, [profile]);

  const warnings = useMemo(() => {
    if (!profile) return [];
    const msgs: string[] = [];
    const monthsActive =
      (Date.now() - new Date(profile.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (monthsActive < 0.5) {
      msgs.push('Conta criada há menos de 15 dias');
    }
    if (profile.trustScore < 40) {
      msgs.push('Trust score baixo — pouca atividade verificada');
    }
    if (profile.verificationLevel === 'none') {
      msgs.push('Identidade ainda não verificada');
    }
    return msgs;
  }, [profile]);

  if (!isOpen) return null;

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
          className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/8 bg-neutral-950/95 shadow-[0_24px_90px_rgba(0,0,0,0.45)]"
        >
          {/* Header */}
          <div className="relative h-24 bg-gradient-to-br from-amber-500/30 via-emerald-500/20 to-cyan-500/30">
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent" />
            <button
              onClick={onCancel}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/40 text-neutral-200 hover:bg-black/60"
              aria-label="Fechar"
            >
              <iconify-icon icon="solar:close-circle-bold" />
            </button>
          </div>

          <div className="-mt-12 px-6 pb-6">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/20 text-amber-200 shadow-lg">
                <iconify-icon icon="solar:shield-check-bold-duotone" class="text-3xl" />
              </div>
              <h2 className="mt-3 text-lg font-bold text-white font-bricolage">
                Verifique quem está te pedindo para assinar
              </h2>
              <p className="mt-1 max-w-sm text-xs text-neutral-400">
                Confirme a identidade do solicitante antes de prosseguir. Esta etapa
                protege você contra fraudes.
              </p>
            </div>

            {/* Loading */}
            {loading && (
              <div className="my-6 flex items-center justify-center gap-3 rounded-2xl border border-white/8 bg-black/30 px-4 py-6 text-sm text-neutral-400">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-transparent" />
                Carregando perfil do solicitante…
              </div>
            )}

            {/* Erro */}
            {error && (
              <div className="my-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                {error}
              </div>
            )}

            {/* Perfil encontrado */}
            {!loading && profile && (
              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/30 p-3">
                  <div className="h-12 w-12 overflow-hidden rounded-xl border border-white/8 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20">
                    {profile.avatarUrl ? (
                      <img src={profile.avatarUrl} alt={profile.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-base font-bold text-white">
                        {(profile.name || '?').slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 text-sm font-semibold text-white">
                      {profile.name}
                      <VerifiedDot level={profile.verificationLevel} />
                    </p>
                    <p className="text-xs text-cyan-300">@{profile.handle}</p>
                    {profile.jobTitle && (
                      <p className="text-[11px] text-neutral-500">{profile.jobTitle}</p>
                    )}
                  </div>
                  <VerificationLevelPill level={profile.verificationLevel} />
                </div>

                {/* Checklist */}
                <div className="rounded-2xl border border-white/8 bg-black/30 p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">
                    Verificações
                  </p>
                  <ul className="mt-3 space-y-2">
                    {positives.map((p) => (
                      <li key={p.text} className="flex items-center gap-2 text-sm">
                        <iconify-icon
                          icon={p.ok ? 'solar:check-circle-bold' : 'solar:close-circle-bold'}
                          class={p.ok ? 'text-emerald-300' : 'text-neutral-500'}
                        />
                        <span className={p.ok ? 'text-neutral-200' : 'text-neutral-500 line-through'}>
                          {p.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Warnings */}
                {warnings.length > 0 && (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3">
                    <p className="flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-amber-300">
                      <iconify-icon icon="solar:danger-triangle-bold" />
                      Atenção
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-amber-200">
                      {warnings.map((w) => (
                        <li key={w}>• {w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Trust */}
                <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/30 p-4">
                  <TrustScoreBadge score={profile.trustScore} size={72} />
                  <div className="text-right">
                    <p className={`text-base font-bold ${trustClass.tone}`}>{trustClass.label}</p>
                    <p className="text-[11px] text-neutral-500">
                      {profile.followersCount} seguidores
                    </p>
                    {profile.walletAddress && (
                      <p className="mt-1 text-[10px] font-mono text-emerald-300">
                        {shortenAddress(profile.walletAddress)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Contrato */}
                {(contractTitle || requestedAt) && (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                    {contractTitle && (
                      <p className="flex items-center gap-2 text-sm text-emerald-100">
                        <iconify-icon icon="solar:document-bold" />
                        {contractTitle}
                      </p>
                    )}
                    {requestedAt && (
                      <p className="mt-1 text-[11px] text-emerald-300/70">
                        Enviado em {new Date(requestedAt).toLocaleString('pt-BR')}
                      </p>
                    )}
                  </div>
                )}

                {/* Badges */}
                {profile.verificationBadges.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {profile.verificationBadges.map((b) => (
                      <VerificationBadgePill key={b} badge={b} size="sm" />
                    ))}
                  </div>
                )}

                <Link
                  to={`/@${profile.handle}`}
                  target="_blank"
                  className="block w-full rounded-xl border border-white/8 bg-white/[0.03] py-2 text-center text-xs font-medium text-neutral-300 transition hover:bg-white/[0.06]"
                >
                  Ver perfil completo
                </Link>
              </div>
            )}

            {/* Confirmação */}
            <label className="mt-5 flex items-start gap-3 rounded-2xl border border-white/8 bg-black/30 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-black/40 text-emerald-500"
              />
              <span className="text-xs leading-relaxed text-neutral-300">
                Reconheço o solicitante e confirmo que desejo prosseguir com a
                assinatura. Estou ciente de que essa ação é registrada com data,
                hora e dados de auditoria.
              </span>
            </label>

            {/* Ações */}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              {onReport && (
                <button
                  type="button"
                  onClick={onReport}
                  className="rounded-full border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs font-medium text-red-200 hover:bg-red-500/15"
                >
                  Reportar suspeito
                </button>
              )}
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-neutral-200 hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!confirmed}
                onClick={onConfirm}
                className={`flex-1 rounded-full px-4 py-2 text-sm font-bold transition ${
                  confirmed
                    ? 'border border-emerald-400/40 bg-emerald-500 text-black hover:bg-emerald-400'
                    : 'cursor-not-allowed border border-white/8 bg-white/[0.03] text-neutral-500'
                }`}
              >
                Prosseguir
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
