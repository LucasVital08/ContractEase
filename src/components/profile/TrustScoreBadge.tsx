import { motion } from 'motion/react';
import { classifyTrustScore } from '@/services/profileService';

interface Props {
  score: number;
  size?: number; // px (default 80)
  showLabel?: boolean;
}

/** Anel circular animado mostrando o trust score 0-100. */
export default function TrustScoreBadge({ score, size = 80, showLabel = true }: Props) {
  const safe = Math.max(0, Math.min(score, 100));
  const { label, tone } = classifyTrustScore(safe);
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (safe / 100) * circumference;

  const colorStop =
    safe >= 80 ? '#10b981' : safe >= 60 ? '#22d3ee' : safe >= 40 ? '#f59e0b' : safe >= 20 ? '#fb923c' : '#9ca3af';

  return (
    <div className="inline-flex items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={stroke}
            fill="none"
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colorStop}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - dash }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-white font-bricolage">{safe}</span>
          {showLabel && size >= 80 && (
            <span className="text-[9px] uppercase tracking-wider text-neutral-500">trust</span>
          )}
        </div>
      </div>
      {showLabel && (
        <div className="flex flex-col">
          <span className={`text-sm font-semibold ${tone}`}>{label}</span>
          <span className="text-xs text-neutral-500">Trust Score</span>
        </div>
      )}
    </div>
  );
}
