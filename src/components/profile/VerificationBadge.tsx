import { motion } from 'motion/react';
import { BADGE_META, LEVEL_META, type VerificationBadge, type VerificationLevel } from '@/services/profileService';

interface BadgeProps {
  badge: VerificationBadge;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export function VerificationBadgePill({ badge, size = 'md', showLabel = true }: BadgeProps) {
  const meta = BADGE_META[badge];
  const sizeCls = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';
  return (
    <motion.span
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ y: -1 }}
      className={`inline-flex items-center gap-1 rounded-full border font-semibold uppercase tracking-wide backdrop-blur-sm ${meta.tone} ${sizeCls}`}
      title={meta.description}
    >
      <iconify-icon icon={meta.icon} class="text-sm" />
      {showLabel && <span>{meta.label}</span>}
    </motion.span>
  );
}

interface LevelProps {
  level: VerificationLevel;
  size?: 'sm' | 'md' | 'lg';
}

export function VerificationLevelPill({ level, size = 'md' }: LevelProps) {
  const meta = LEVEL_META[level];
  const sizeCls =
    size === 'lg'
      ? 'text-sm px-3 py-1.5'
      : size === 'sm'
        ? 'text-[10px] px-2 py-0.5'
        : 'text-xs px-2.5 py-1';

  const icon =
    level === 'kyc' || level === 'notarial'
      ? 'solar:verified-check-bold'
      : level === 'basic'
        ? 'solar:check-circle-bold'
        : 'solar:shield-minimalistic-bold';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold backdrop-blur-sm ${meta.tone} ${sizeCls}`}
      title={meta.description}
    >
      <iconify-icon icon={icon} class="text-base" />
      {meta.label}
    </span>
  );
}

/** Sino de "verificado" inline ao lado do nome — versão simplificada. */
export function VerifiedDot({ level }: { level: VerificationLevel }) {
  if (level === 'none') return null;
  const color =
    level === 'notarial'
      ? 'text-yellow-300'
      : level === 'kyc'
        ? 'text-emerald-300'
        : 'text-blue-300';
  return (
    <span title={LEVEL_META[level].label} className={`inline-flex ${color}`}>
      <iconify-icon icon="solar:verified-check-bold" class="text-xl" />
    </span>
  );
}
