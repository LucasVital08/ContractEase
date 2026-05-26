import { motion } from 'motion/react';
import type { ProfileStats as Stats } from '@/services/profileService';

interface Props {
  stats: Stats;
  followers: number;
  following: number;
}

interface CardProps {
  label: string;
  value: number | string;
  icon: string;
  tone: string;
  delay?: number;
}

function StatTile({ label, value, icon, tone, delay = 0 }: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 240, damping: 24 }}
      className="relative overflow-hidden rounded-2xl border border-white/8 bg-black/30 px-4 py-3 backdrop-blur"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">{label}</p>
          <p className={`mt-1 text-xl font-bold font-bricolage ${tone}`}>{value}</p>
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] ${tone}`}>
          <iconify-icon icon={icon} class="text-lg" />
        </div>
      </div>
    </motion.div>
  );
}

export default function ProfileStats({ stats, followers, following }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <StatTile
        label="Seguidores"
        value={followers}
        icon="solar:users-group-rounded-bold-duotone"
        tone="text-cyan-300"
        delay={0}
      />
      <StatTile
        label="Seguindo"
        value={following}
        icon="solar:user-plus-rounded-bold-duotone"
        tone="text-fuchsia-300"
        delay={0.04}
      />
      <StatTile
        label="Assinados"
        value={stats.totalSigned}
        icon="solar:pen-2-bold-duotone"
        tone="text-emerald-300"
        delay={0.08}
      />
      <StatTile
        label="Criados"
        value={stats.totalCreated}
        icon="solar:document-add-bold-duotone"
        tone="text-blue-300"
        delay={0.12}
      />
      <StatTile
        label="Concluídos"
        value={stats.totalCompleted}
        icon="solar:diploma-verified-bold-duotone"
        tone="text-amber-300"
        delay={0.16}
      />
      <StatTile
        label="On-chain"
        value={stats.totalOnChain}
        icon="solar:shield-network-bold-duotone"
        tone="text-emerald-200"
        delay={0.2}
      />
    </div>
  );
}
