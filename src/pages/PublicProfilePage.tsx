import { useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  usePublicProfile,
  useProfileStats,
  useProfileActivity,
  useProfileFollowers,
  useProfileFollowing,
  useFollowToggle,
} from '@/hooks/useProfileQueries';
import { useAuthStore, useNotificationStore } from '@/stores';
import { VerifiedDot, VerificationBadgePill, VerificationLevelPill } from '@/components/profile/VerificationBadge';
import TrustScoreBadge from '@/components/profile/TrustScoreBadge';
import ProfileStats from '@/components/profile/ProfileStats';
import { shortenAddress } from '@/services/stellarWallet';

type Tab = 'activity' | 'badges' | 'network' | 'about';

const ACTIVITY_ICONS: Record<string, { icon: string; tone: string; label: string }> = {
  signed_contract: { icon: 'solar:pen-bold', tone: 'text-emerald-300', label: 'Assinou um contrato' },
  created_contract: { icon: 'solar:document-add-bold', tone: 'text-blue-300', label: 'Criou um contrato' },
  completed_contract: { icon: 'solar:diploma-verified-bold', tone: 'text-amber-300', label: 'Contrato concluído' },
  verified_email: { icon: 'solar:letter-unread-bold', tone: 'text-blue-300', label: 'Verificou email' },
  verified_phone: { icon: 'solar:phone-bold', tone: 'text-cyan-300', label: 'Verificou telefone' },
  verified_wallet: { icon: 'solar:wallet-money-bold', tone: 'text-emerald-300', label: 'Conectou carteira' },
  verified_kyc: { icon: 'solar:shield-user-bold', tone: 'text-amber-300', label: 'Verificou KYC' },
  earned_badge: { icon: 'solar:medal-star-bold', tone: 'text-fuchsia-300', label: 'Conquistou selo' },
  joined_platform: { icon: 'solar:user-plus-rounded-bold', tone: 'text-neutral-300', label: 'Entrou na plataforma' },
  published_template: { icon: 'solar:widget-add-bold', tone: 'text-blue-300', label: 'Publicou template' },
};

export default function PublicProfilePage() {
  const { handle: rawHandle } = useParams<{ handle: string }>();
  const handle = rawHandle?.replace(/^@/, '');
  const navigate = useNavigate();
  const notify = useNotificationStore((s) => s.add);
  const { user: currentUser } = useAuthStore();

  const [tab, setTab] = useState<Tab>('activity');
  const [copied, setCopied] = useState<string | null>(null);

  const { data: profile, isLoading, error } = usePublicProfile(handle);
  const { data: stats } = useProfileStats(handle);
  const { data: activity = [] } = useProfileActivity(handle);
  const { data: followers = [] } = useProfileFollowers(handle);
  const { data: following = [] } = useProfileFollowing(handle);

  const followMutation = useFollowToggle(handle);

  const isMyProfile = useMemo(
    () => currentUser?.id === profile?.id || currentUser?.handle === profile?.handle,
    [currentUser, profile],
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <div className="h-48 animate-pulse rounded-3xl bg-white/5" />
        <div className="h-32 animate-pulse rounded-3xl bg-white/5" />
        <div className="h-64 animate-pulse rounded-3xl bg-white/5" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-500/10 text-amber-300">
          <iconify-icon icon="solar:user-cross-bold-duotone" class="text-3xl" />
        </div>
        <h2 className="text-xl font-bold text-white font-bricolage">Perfil não encontrado</h2>
        <p className="text-sm text-neutral-400">
          O usuário @{handle} não existe ou definiu o perfil como privado.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-medium text-neutral-200 hover:bg-white/10"
        >
          Voltar
        </button>
      </div>
    );
  }

  const initials =
    profile.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || 'CE';

  const handleFollow = async () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    try {
      await followMutation.mutateAsync(profile.isFollowedByMe);
      notify({
        type: 'success',
        title: profile.isFollowedByMe ? 'Você deixou de seguir' : 'Você está seguindo',
        message: `@${profile.handle}`,
      });
    } catch (e: any) {
      notify({ type: 'error', title: 'Falha ao atualizar', message: e?.message || 'Tente novamente' });
    }
  };

  const handleCopy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1800);
    } catch { /* ignore */ }
  };

  const externalLinks = [
    profile.website && { label: 'Site', icon: 'solar:global-bold-duotone', href: profile.website },
    profile.linkedinUrl && { label: 'LinkedIn', icon: 'solar:case-bold-duotone', href: profile.linkedinUrl },
    profile.githubUrl && { label: 'GitHub', icon: 'solar:code-square-bold-duotone', href: profile.githubUrl },
    profile.twitterUrl && { label: 'Twitter', icon: 'solar:planet-bold-duotone', href: profile.twitterUrl },
  ].filter(Boolean) as { label: string; icon: string; href: string }[];

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      {/* ─── HERO ───────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[28px] border border-white/8 bg-neutral-900/70 shadow-[0_24px_90px_rgba(0,0,0,0.28)]"
      >
        {/* Cover */}
        <div className="relative h-44 sm:h-56 lg:h-64">
          {profile.coverUrl ? (
            <img src={profile.coverUrl} alt="Capa" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/30 via-cyan-500/20 to-fuchsia-500/30" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/95 via-neutral-900/40 to-transparent" />
        </div>

        {/* Avatar + identidade */}
        <div className="relative px-6 pb-6">
          <div className="relative -mt-14 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <div className="relative h-28 w-28 overflow-hidden rounded-[26px] border-4 border-neutral-900 bg-gradient-to-br from-emerald-500/30 to-cyan-500/30 shadow-[0_18px_45px_rgba(0,0,0,0.35)]">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={profile.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-white">
                    {initials}
                  </div>
                )}
              </div>

              <div className="mb-1 flex flex-col">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold text-white font-bricolage sm:text-3xl">{profile.name}</h1>
                  <VerifiedDot level={profile.verificationLevel} />
                </div>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-0.5 text-sm font-semibold text-cyan-300">
                    @{profile.handle}
                  </span>
                  {profile.jobTitle && (
                    <span className="text-sm text-neutral-300">{profile.jobTitle}</span>
                  )}
                </div>
                {profile.location && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-neutral-400">
                    <iconify-icon icon="solar:map-point-bold-duotone" />
                    {profile.location}
                  </p>
                )}
              </div>
            </div>

            {/* Ações */}
            <div className="flex items-center gap-2 flex-wrap">
              {!isMyProfile && currentUser && (
                <button
                  onClick={handleFollow}
                  disabled={followMutation.isPending}
                  className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold transition-all ${
                    profile.isFollowedByMe
                      ? 'border border-white/10 bg-white/[0.04] text-neutral-200 hover:bg-white/10'
                      : 'border border-emerald-400/40 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
                  }`}
                >
                  <iconify-icon icon={profile.isFollowedByMe ? 'solar:user-check-bold' : 'solar:user-plus-bold'} />
                  {profile.isFollowedByMe ? 'Seguindo' : 'Seguir'}
                </button>
              )}

              {isMyProfile && (
                <Link
                  to="/settings"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 py-2 text-sm font-medium text-neutral-200 hover:bg-white/10"
                >
                  <iconify-icon icon="solar:pen-2-bold" />
                  Editar perfil
                </Link>
              )}

              <button
                onClick={() =>
                  handleCopy('link', `${window.location.origin}/@${profile.handle}`)
                }
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-neutral-200 hover:bg-white/10"
                title="Compartilhar perfil"
              >
                <iconify-icon icon={copied === 'link' ? 'solar:check-circle-bold' : 'solar:share-bold'} />
                {copied === 'link' ? 'Copiado' : 'Compartilhar'}
              </button>
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="mt-5 max-w-2xl text-sm leading-7 text-neutral-300 whitespace-pre-line">
              {profile.bio}
            </p>
          )}

          {/* Links externos */}
          {externalLinks.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {externalLinks.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-xs text-neutral-300 transition hover:border-white/15 hover:text-white"
                >
                  <iconify-icon icon={l.icon} class="text-sm" />
                  {l.label}
                </a>
              ))}
            </div>
          )}

          {/* Trust + Level */}
          <div className="mt-5 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <TrustScoreBadge score={profile.trustScore} size={72} />
              <VerificationLevelPill level={profile.verificationLevel} size="lg" />
            </div>

            {profile.walletAddress && (
              <button
                onClick={() => handleCopy('wallet', profile.walletAddress!)}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200 transition hover:bg-emerald-500/15"
                title="Copiar endereço Stellar"
              >
                <iconify-icon icon={copied === 'wallet' ? 'solar:check-circle-bold' : 'solar:wallet-money-bold'} />
                {copied === 'wallet' ? 'Copiado' : shortenAddress(profile.walletAddress)}
              </button>
            )}
          </div>

          {/* Badges */}
          {profile.verificationBadges.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.verificationBadges.map((b) => (
                <VerificationBadgePill key={b} badge={b} size="sm" />
              ))}
            </div>
          )}
        </div>
      </motion.section>

      {/* ─── STATS ──────────────────────────────────────────────── */}
      {stats && (
        <ProfileStats
          stats={stats}
          followers={profile.followersCount}
          following={profile.followingCount}
        />
      )}

      {/* ─── TABS ───────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-white/8 bg-neutral-900/60 p-2">
        <div className="flex gap-1 overflow-x-auto">
          {(
            [
              { id: 'activity', label: 'Atividade', icon: 'solar:history-bold-duotone' },
              { id: 'badges', label: 'Selos', icon: 'solar:medal-star-bold-duotone' },
              { id: 'network', label: 'Rede', icon: 'solar:users-group-rounded-bold-duotone' },
              { id: 'about', label: 'Sobre', icon: 'solar:info-circle-bold-duotone' },
            ] as { id: Tab; label: string; icon: string }[]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 min-w-fit flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all ${
                tab === t.id
                  ? 'bg-white/8 text-white'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <iconify-icon icon={t.icon} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── CONTENT ────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {tab === 'activity' && (
            <div className="rounded-3xl border border-white/8 bg-neutral-900/60 p-6">
              {activity.length === 0 ? (
                <p className="py-8 text-center text-sm text-neutral-500">
                  Sem atividade pública por aqui ainda.
                </p>
              ) : (
                <ol className="space-y-3">
                  {activity.map((a) => {
                    const meta = ACTIVITY_ICONS[a.activityType] ?? {
                      icon: 'solar:bell-bold',
                      tone: 'text-neutral-300',
                      label: a.activityType,
                    };
                    return (
                      <li
                        key={a.id}
                        className="flex items-start gap-3 rounded-2xl border border-white/5 bg-black/20 p-3"
                      >
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] ${meta.tone}`}
                        >
                          <iconify-icon icon={meta.icon} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-white">{a.message || meta.label}</p>
                          <p className="mt-0.5 text-xs text-neutral-500">
                            {new Date(a.createdAt).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          )}

          {tab === 'badges' && (
            <div className="rounded-3xl border border-white/8 bg-neutral-900/60 p-6">
              {profile.verificationBadges.length === 0 ? (
                <p className="py-8 text-center text-sm text-neutral-500">
                  Ainda não conquistou selos. Comece confirmando o email e o telefone nas
                  configurações.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {profile.verificationBadges.map((b) => (
                    <div
                      key={b}
                      className="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/20 p-4"
                    >
                      <VerificationBadgePill badge={b} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'network' && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-3xl border border-white/8 bg-neutral-900/60 p-5">
                <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-neutral-400">
                  Seguidores ({profile.followersCount})
                </h3>
                {followers.length === 0 ? (
                  <p className="text-sm text-neutral-500">Sem seguidores ainda.</p>
                ) : (
                  <ul className="space-y-2">
                    {followers.map((f: any) => (
                      <ProfileRow key={f.follower?.id} p={f.follower} />
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-3xl border border-white/8 bg-neutral-900/60 p-5">
                <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-neutral-400">
                  Seguindo ({profile.followingCount})
                </h3>
                {following.length === 0 ? (
                  <p className="text-sm text-neutral-500">Ainda não segue ninguém.</p>
                ) : (
                  <ul className="space-y-2">
                    {following.map((f: any) => (
                      <ProfileRow key={f.following?.id} p={f.following} />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {tab === 'about' && (
            <div className="rounded-3xl border border-white/8 bg-neutral-900/60 p-6">
              <dl className="grid gap-4 sm:grid-cols-2">
                <AboutRow label="Nome" value={profile.name} />
                <AboutRow label="@usuário" value={`@${profile.handle}`} />
                {profile.jobTitle && <AboutRow label="Cargo" value={profile.jobTitle} />}
                {profile.location && <AboutRow label="Localização" value={profile.location} />}
                <AboutRow label="Plano" value={profile.plan ?? 'Free'} />
                <AboutRow
                  label="Entrou em"
                  value={new Date(profile.createdAt).toLocaleDateString('pt-BR')}
                />
                {profile.email && <AboutRow label="Email" value={profile.email} />}
                {profile.phone && <AboutRow label="Telefone" value={profile.phone} />}
              </dl>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function ProfileRow({ p }: { p: any }) {
  if (!p) return null;
  return (
    <li>
      <Link
        to={`/@${p.handle}`}
        className="flex items-center gap-3 rounded-2xl border border-white/5 bg-black/20 p-3 transition hover:border-white/10 hover:bg-white/[0.03]"
      >
        <div className="h-9 w-9 overflow-hidden rounded-xl border border-white/8 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20">
          {p.avatar_url ? (
            <img src={p.avatar_url} alt={p.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-bold text-white">
              {(p.name || '?').slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-sm text-white">
            {p.name}
            <VerifiedDot level={p.verification_level ?? 'none'} />
          </p>
          <p className="text-xs text-neutral-500">@{p.handle}</p>
        </div>
      </Link>
    </li>
  );
}

function AboutRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
      <dt className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">{label}</dt>
      <dd className="mt-1 text-sm text-white break-words">{value}</dd>
    </div>
  );
}
