/**
 * Profile Service — rede social profissional
 *
 * Consome as RPCs criadas em 20260526150000_expand_profiles_social.sql:
 *  - get_public_profile(handle_or_id)
 *  - get_profile_stats(handle_or_id)
 *  - follow_profile(handle)
 *  - unfollow_profile(handle)
 *  - compute_trust_score(uid)
 *  - refresh_trust_metrics(uid)
 */

import { supabase } from '@/lib/supabase';

// ─── TIPOS ────────────────────────────────────────────────────────────

export type VerificationLevel = 'none' | 'basic' | 'kyc' | 'notarial';
export type VerificationBadge =
  | 'email'
  | 'phone'
  | 'wallet'
  | 'kyc'
  | 'builder'
  | 'notarial';

export interface PublicProfile {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  twitterUrl: string | null;
  jobTitle: string | null;
  verificationLevel: VerificationLevel;
  verificationBadges: VerificationBadge[];
  trustScore: number;
  followersCount: number;
  followingCount: number;
  walletAddress: string | null;
  email: string | null;
  phone: string | null;
  plan: string | null;
  createdAt: string;
  isFollowedByMe: boolean;
}

export interface ProfileStats {
  totalSigned: number;
  totalCreated: number;
  totalCompleted: number;
  totalOnChain: number;
}

export interface ProfileActivity {
  id: string;
  userId: string;
  activityType: string;
  refId: string | null;
  refType: string | null;
  message: string | null;
  metadata: Record<string, unknown>;
  isPublic: boolean;
  createdAt: string;
}

export interface PrivacySettings {
  show_contracts: boolean;
  show_wallet: boolean;
  show_email: boolean;
  show_phone: boolean;
  show_stats: boolean;
  show_activity: boolean;
  show_followers: boolean;
}

export const DEFAULT_PRIVACY: PrivacySettings = {
  show_contracts: true,
  show_wallet: true,
  show_email: false,
  show_phone: false,
  show_stats: true,
  show_activity: true,
  show_followers: true,
};

// ─── HELPERS DE NORMALIZAÇÃO ──────────────────────────────────────────

function normalizeRow(row: Record<string, any>): PublicProfile {
  return {
    id: row.id,
    name: row.name,
    handle: row.handle,
    avatarUrl: row.avatar_url ?? null,
    coverUrl: row.cover_url ?? null,
    bio: row.bio ?? null,
    location: row.location ?? null,
    website: row.website ?? null,
    linkedinUrl: row.linkedin_url ?? null,
    githubUrl: row.github_url ?? null,
    twitterUrl: row.twitter_url ?? null,
    jobTitle: row.job_title ?? null,
    verificationLevel: (row.verification_level as VerificationLevel) ?? 'none',
    verificationBadges: Array.isArray(row.verification_badges)
      ? (row.verification_badges as VerificationBadge[])
      : [],
    trustScore: row.trust_score ?? 0,
    followersCount: row.followers_count ?? 0,
    followingCount: row.following_count ?? 0,
    walletAddress: row.wallet_address ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    plan: row.plan ?? null,
    createdAt: row.created_at,
    isFollowedByMe: Boolean(row.is_followed_by_me),
  };
}

function cleanHandle(input: string): string {
  return input.replace(/^@/, '').trim().toLowerCase();
}

// ─── API ──────────────────────────────────────────────────────────────

export const profileService = {
  /**
   * Busca o perfil público respeitando privacy_settings do dono.
   * Aceita @handle ou UUID.
   */
  async getPublicProfile(handleOrId: string): Promise<PublicProfile | null> {
    const { data, error } = await supabase.rpc('get_public_profile', {
      handle_or_id: cleanHandle(handleOrId),
    });
    if (error) {
      console.error('[profileService.getPublicProfile]', error);
      return null;
    }
    if (!data || (Array.isArray(data) && data.length === 0)) return null;
    const row = Array.isArray(data) ? data[0] : data;
    return normalizeRow(row);
  },

  async getStats(handleOrId: string): Promise<ProfileStats> {
    const { data, error } = await supabase.rpc('get_profile_stats', {
      handle_or_id: cleanHandle(handleOrId),
    });
    if (error) {
      console.warn('[profileService.getStats]', error);
      return { totalSigned: 0, totalCreated: 0, totalCompleted: 0, totalOnChain: 0 };
    }
    const row = Array.isArray(data) ? data[0] : data;
    return {
      totalSigned: row?.total_signed ?? 0,
      totalCreated: row?.total_created ?? 0,
      totalCompleted: row?.total_completed ?? 0,
      totalOnChain: row?.total_on_chain ?? 0,
    };
  },

  async getActivity(handleOrId: string, limit = 20): Promise<ProfileActivity[]> {
    const handle = cleanHandle(handleOrId);
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .ilike('handle', handle)
      .maybeSingle();

    if (!profile?.id) return [];

    const { data, error } = await supabase
      .from('profile_activity')
      .select('*')
      .eq('user_id', profile.id)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('[profileService.getActivity]', error);
      return [];
    }
    return (data ?? []).map((a) => ({
      id: a.id,
      userId: a.user_id,
      activityType: a.activity_type,
      refId: a.ref_id,
      refType: a.ref_type,
      message: a.message,
      metadata: a.metadata ?? {},
      isPublic: a.is_public,
      createdAt: a.created_at,
    }));
  },

  async getFollowers(handleOrId: string, limit = 50) {
    const handle = cleanHandle(handleOrId);
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .ilike('handle', handle)
      .maybeSingle();
    if (!profile?.id) return [];

    const { data } = await supabase
      .from('profile_followers')
      .select('follower:profiles!profile_followers_follower_id_fkey(id, name, handle, avatar_url, verification_level)')
      .eq('following_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    return data ?? [];
  },

  async getFollowing(handleOrId: string, limit = 50) {
    const handle = cleanHandle(handleOrId);
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .ilike('handle', handle)
      .maybeSingle();
    if (!profile?.id) return [];

    const { data } = await supabase
      .from('profile_followers')
      .select('following:profiles!profile_followers_following_id_fkey(id, name, handle, avatar_url, verification_level)')
      .eq('follower_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    return data ?? [];
  },

  async follow(handle: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('follow_profile', {
      target_handle: cleanHandle(handle),
    });
    if (error) throw error;
    return Boolean(data);
  },

  async unfollow(handle: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('unfollow_profile', {
      target_handle: cleanHandle(handle),
    });
    if (error) throw error;
    return Boolean(data);
  },

  /** Atualiza badges (chamado após verificações de email/phone/wallet). */
  async addBadge(userId: string, badge: VerificationBadge): Promise<void> {
    const { data: row } = await supabase
      .from('profiles')
      .select('verification_badges')
      .eq('id', userId)
      .maybeSingle();
    const current = Array.isArray(row?.verification_badges)
      ? (row!.verification_badges as VerificationBadge[])
      : [];
    if (current.includes(badge)) return;
    const next = [...current, badge];
    await supabase
      .from('profiles')
      .update({ verification_badges: next })
      .eq('id', userId);
    await supabase.rpc('refresh_trust_metrics', { uid: userId });
  },

  /** Recomputa trust_score + verification_level. */
  async refreshTrustMetrics(userId: string): Promise<void> {
    await supabase.rpc('refresh_trust_metrics', { uid: userId });
  },

  /** Atualiza campos do perfil (uso na SettingsPage). */
  async updateProfile(
    userId: string,
    patch: Partial<{
      name: string;
      bio: string;
      jobTitle: string;
      location: string;
      website: string;
      linkedinUrl: string;
      githubUrl: string;
      twitterUrl: string;
      publicProfile: boolean;
      privacySettings: Partial<PrivacySettings>;
    }>,
  ): Promise<void> {
    const update: Record<string, unknown> = {};
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.bio !== undefined) update.bio = patch.bio;
    if (patch.jobTitle !== undefined) update.job_title = patch.jobTitle;
    if (patch.location !== undefined) update.location = patch.location;
    if (patch.website !== undefined) update.website = patch.website;
    if (patch.linkedinUrl !== undefined) update.linkedin_url = patch.linkedinUrl;
    if (patch.githubUrl !== undefined) update.github_url = patch.githubUrl;
    if (patch.twitterUrl !== undefined) update.twitter_url = patch.twitterUrl;
    if (patch.publicProfile !== undefined) update.public_profile = patch.publicProfile;

    if (patch.privacySettings) {
      const { data } = await supabase
        .from('profiles')
        .select('privacy_settings')
        .eq('id', userId)
        .maybeSingle();
      const current = (data?.privacy_settings as PrivacySettings) ?? DEFAULT_PRIVACY;
      update.privacy_settings = { ...current, ...patch.privacySettings };
    }

    if (Object.keys(update).length === 0) return;
    const { error } = await supabase.from('profiles').update(update).eq('id', userId);
    if (error) throw error;
  },

  async uploadCover(userId: string, file: File): Promise<string> {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const filePath = `${userId}/cover-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('covers')
      .upload(filePath, file, { upsert: true, contentType: file.type });
    if (upErr) throw upErr;

    const { data } = supabase.storage.from('covers').getPublicUrl(filePath);
    const publicUrl = data.publicUrl;

    const { error: dbErr } = await supabase
      .from('profiles')
      .update({ cover_url: publicUrl })
      .eq('id', userId);
    if (dbErr) throw dbErr;

    return publicUrl;
  },

  /** Loga uma atividade pública (chamado após eventos relevantes). */
  async logActivity(
    userId: string,
    activityType: ProfileActivity['activityType'],
    opts: { refId?: string; refType?: string; message?: string; metadata?: Record<string, unknown>; isPublic?: boolean } = {},
  ): Promise<void> {
    await supabase.from('profile_activity').insert({
      user_id: userId,
      activity_type: activityType,
      ref_id: opts.refId,
      ref_type: opts.refType,
      message: opts.message,
      metadata: opts.metadata ?? {},
      is_public: opts.isPublic !== false,
    });
  },
};

// ─── BADGE META ───────────────────────────────────────────────────────

export const BADGE_META: Record<VerificationBadge, { label: string; tone: string; icon: string; description: string }> = {
  email: {
    label: 'Email verificado',
    tone: 'text-blue-300 bg-blue-500/10 border-blue-500/30',
    icon: 'solar:letter-unread-bold-duotone',
    description: 'Conta com email confirmado.',
  },
  phone: {
    label: 'Telefone verificado',
    tone: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30',
    icon: 'solar:phone-bold-duotone',
    description: 'Telefone confirmado por OTP SMS.',
  },
  wallet: {
    label: 'Wallet ativa',
    tone: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
    icon: 'solar:wallet-money-bold-duotone',
    description: 'Carteira Stellar conectada e ativa.',
  },
  kyc: {
    label: 'KYC completo',
    tone: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
    icon: 'solar:shield-user-bold-duotone',
    description: 'Identidade comprovada com documento + selfie.',
  },
  builder: {
    label: 'Builder',
    tone: 'text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-500/30',
    icon: 'solar:hammer-bold-duotone',
    description: 'Faz parte dos primeiros 1.000 usuários da plataforma.',
  },
  notarial: {
    label: 'Cartório parceiro',
    tone: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/30',
    icon: 'solar:medal-star-bold-duotone',
    description: 'Verificação reconhecida em cartório parceiro.',
  },
};

export const LEVEL_META: Record<VerificationLevel, { label: string; tone: string; description: string }> = {
  none: {
    label: 'Não verificado',
    tone: 'text-neutral-400 bg-white/5 border-white/10',
    description: 'Identidade ainda não validada.',
  },
  basic: {
    label: 'Verificado',
    tone: 'text-blue-300 bg-blue-500/10 border-blue-500/40',
    description: 'Email + telefone confirmados.',
  },
  kyc: {
    label: 'KYC',
    tone: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/40',
    description: 'Identidade validada por documento.',
  },
  notarial: {
    label: 'Notarial',
    tone: 'text-yellow-300 bg-yellow-500/15 border-yellow-500/50',
    description: 'Reconhecimento em cartório parceiro.',
  },
};

export function classifyTrustScore(score: number): { label: string; tone: string } {
  if (score >= 80) return { label: 'Confiável', tone: 'text-emerald-300' };
  if (score >= 60) return { label: 'Bom histórico', tone: 'text-blue-300' };
  if (score >= 40) return { label: 'Em construção', tone: 'text-amber-300' };
  if (score >= 20) return { label: 'Iniciante', tone: 'text-orange-300' };
  return { label: 'Sem histórico', tone: 'text-neutral-400' };
}
