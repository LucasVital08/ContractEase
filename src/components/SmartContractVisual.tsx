import { CATEGORIES, type SmartContractCategory, type SmartContractTemplate } from '@/services/smartContractTemplates';

type VisualInput = Pick<SmartContractTemplate, 'id' | 'name' | 'shortName' | 'category'>;

interface VisualTheme {
  accentText: string;
  accentStrong: string;
  accentGlow: string;
  accentGradient: string;
  accentChip: string;
  accentSoft: string;
  accentRing: string;
  accentMetric: string;
}

interface SmartContractVisual {
  monogram: string;
  categoryIcon: string;
  categoryLabel: string;
  accentText: string;
  accentStrong: string;
  accentGlow: string;
  accentGradient: string;
  accentChip: string;
  accentSoft: string;
  accentRing: string;
  accentMetric: string;
}

const THEMES: Record<SmartContractCategory, VisualTheme> = {
  real_estate: {
    accentText: 'text-emerald-300',
    accentStrong: 'text-emerald-400',
    accentGlow: 'bg-emerald-400/30',
    accentGradient: 'from-emerald-400/18 via-emerald-400/6 to-transparent',
    accentChip: 'bg-emerald-500/10 text-emerald-300 border-emerald-400/20',
    accentSoft: 'bg-emerald-500/6 border-emerald-400/14',
    accentRing: 'border-emerald-400/18',
    accentMetric: 'text-emerald-200',
  },
  payroll: {
    accentText: 'text-lime-300',
    accentStrong: 'text-lime-400',
    accentGlow: 'bg-lime-400/30',
    accentGradient: 'from-lime-400/16 via-lime-400/6 to-transparent',
    accentChip: 'bg-lime-500/10 text-lime-300 border-lime-400/20',
    accentSoft: 'bg-lime-500/6 border-lime-400/14',
    accentRing: 'border-lime-400/18',
    accentMetric: 'text-lime-200',
  },
  ecommerce: {
    accentText: 'text-sky-300',
    accentStrong: 'text-sky-400',
    accentGlow: 'bg-sky-400/30',
    accentGradient: 'from-sky-400/16 via-sky-400/6 to-transparent',
    accentChip: 'bg-sky-500/10 text-sky-300 border-sky-400/20',
    accentSoft: 'bg-sky-500/6 border-sky-400/14',
    accentRing: 'border-sky-400/18',
    accentMetric: 'text-sky-200',
  },
  finance: {
    accentText: 'text-cyan-300',
    accentStrong: 'text-cyan-400',
    accentGlow: 'bg-cyan-400/30',
    accentGradient: 'from-cyan-400/16 via-cyan-400/6 to-transparent',
    accentChip: 'bg-cyan-500/10 text-cyan-300 border-cyan-400/20',
    accentSoft: 'bg-cyan-500/6 border-cyan-400/14',
    accentRing: 'border-cyan-400/18',
    accentMetric: 'text-cyan-200',
  },
  business: {
    accentText: 'text-amber-200',
    accentStrong: 'text-amber-400',
    accentGlow: 'bg-amber-400/26',
    accentGradient: 'from-amber-400/16 via-amber-400/6 to-transparent',
    accentChip: 'bg-amber-500/10 text-amber-200 border-amber-400/20',
    accentSoft: 'bg-amber-500/6 border-amber-400/14',
    accentRing: 'border-amber-400/18',
    accentMetric: 'text-amber-100',
  },
  professional: {
    accentText: 'text-orange-200',
    accentStrong: 'text-orange-400',
    accentGlow: 'bg-orange-400/26',
    accentGradient: 'from-orange-400/16 via-orange-400/6 to-transparent',
    accentChip: 'bg-orange-500/10 text-orange-200 border-orange-400/20',
    accentSoft: 'bg-orange-500/6 border-orange-400/14',
    accentRing: 'border-orange-400/18',
    accentMetric: 'text-orange-100',
  },
  construction: {
    accentText: 'text-yellow-200',
    accentStrong: 'text-yellow-400',
    accentGlow: 'bg-yellow-400/26',
    accentGradient: 'from-yellow-400/16 via-yellow-400/6 to-transparent',
    accentChip: 'bg-yellow-500/10 text-yellow-200 border-yellow-400/20',
    accentSoft: 'bg-yellow-500/6 border-yellow-400/14',
    accentRing: 'border-yellow-400/18',
    accentMetric: 'text-yellow-100',
  },
  automotive: {
    accentText: 'text-blue-200',
    accentStrong: 'text-blue-400',
    accentGlow: 'bg-blue-400/26',
    accentGradient: 'from-blue-400/16 via-blue-400/6 to-transparent',
    accentChip: 'bg-blue-500/10 text-blue-200 border-blue-400/20',
    accentSoft: 'bg-blue-500/6 border-blue-400/14',
    accentRing: 'border-blue-400/18',
    accentMetric: 'text-blue-100',
  },
  rwa: {
    accentText: 'text-teal-200',
    accentStrong: 'text-teal-400',
    accentGlow: 'bg-teal-400/26',
    accentGradient: 'from-teal-400/16 via-teal-400/6 to-transparent',
    accentChip: 'bg-teal-500/10 text-teal-200 border-teal-400/20',
    accentSoft: 'bg-teal-500/6 border-teal-400/14',
    accentRing: 'border-teal-400/18',
    accentMetric: 'text-teal-100',
  },
  registry: {
    accentText: 'text-stone-200',
    accentStrong: 'text-stone-300',
    accentGlow: 'bg-stone-300/24',
    accentGradient: 'from-stone-300/14 via-stone-300/6 to-transparent',
    accentChip: 'bg-stone-400/10 text-stone-200 border-stone-300/16',
    accentSoft: 'bg-stone-400/6 border-stone-300/12',
    accentRing: 'border-stone-300/14',
    accentMetric: 'text-stone-100',
  },
  insurance: {
    accentText: 'text-indigo-200',
    accentStrong: 'text-indigo-400',
    accentGlow: 'bg-indigo-400/24',
    accentGradient: 'from-indigo-400/14 via-indigo-400/6 to-transparent',
    accentChip: 'bg-indigo-500/10 text-indigo-200 border-indigo-400/20',
    accentSoft: 'bg-indigo-500/6 border-indigo-400/14',
    accentRing: 'border-indigo-400/18',
    accentMetric: 'text-indigo-100',
  },
};

const STOP_WORDS = new Set(['de', 'do', 'da', 'dos', 'das', 'e', 'com', 'por']);

function buildMonogram(template: VisualInput) {
  const seed = template.shortName || template.name || template.id;
  const tokens = seed
    .replace(/[()]/g, ' ')
    .split(/\s+/)
    .map(token => token.trim())
    .filter(Boolean)
    .filter(token => !STOP_WORDS.has(token.toLowerCase()));

  if (tokens.length >= 2) {
    return `${tokens[0][0]}${tokens[1][0]}`.toUpperCase();
  }

  return seed.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() || template.id.slice(0, 2).toUpperCase();
}

export function getSmartContractVisual(template: VisualInput): SmartContractVisual {
  const categoryMeta = CATEGORIES.find(category => category.id === template.category);
  const theme = THEMES[template.category];

  return {
    monogram: buildMonogram(template),
    categoryIcon: categoryMeta?.icon ?? 'solar:widget-bold-duotone',
    categoryLabel: categoryMeta?.label ?? 'Smart Contract',
    accentText: theme.accentText,
    accentStrong: theme.accentStrong,
    accentGlow: theme.accentGlow,
    accentGradient: theme.accentGradient,
    accentChip: theme.accentChip,
    accentSoft: theme.accentSoft,
    accentRing: theme.accentRing,
    accentMetric: theme.accentMetric,
  };
}

export function SmartContractGlyph({ template, size = 'md', className = '' }: {
  template: VisualInput;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const visual = getSmartContractVisual(template);
  const sizeMap = {
    sm: {
      frame: 'h-11 w-11 rounded-xl',
      text: 'text-sm tracking-[0.24em] pl-[0.24em]',
      mark: 'h-5 w-5 rounded-full',
      markIcon: 'text-[11px]',
    },
    md: {
      frame: 'h-14 w-14 rounded-2xl',
      text: 'text-lg tracking-[0.24em] pl-[0.24em]',
      mark: 'h-6 w-6 rounded-full',
      markIcon: 'text-xs',
    },
    lg: {
      frame: 'h-16 w-16 rounded-[22px]',
      text: 'text-xl tracking-[0.28em] pl-[0.28em]',
      mark: 'h-7 w-7 rounded-full',
      markIcon: 'text-sm',
    },
  }[size];

  return (
    <div className={`relative isolate ${sizeMap.frame} ${className}`.trim()}>
      <div className={`absolute inset-1 blur-2xl opacity-70 ${visual.accentGlow}`} />
      <div className={`relative h-full w-full overflow-hidden border bg-neutral-950/90 ${visual.accentRing} ${sizeMap.frame}`}>
        <div className={`absolute inset-0 bg-gradient-to-br ${visual.accentGradient}`} />
        <div className="absolute inset-0 bg-[linear-gradient(140deg,rgba(255,255,255,0.14),transparent_36%)]" />
        <div className={`absolute right-2 top-2 flex items-center justify-center border border-white/10 bg-black/35 text-white/70 backdrop-blur ${sizeMap.mark}`}>
          <iconify-icon icon={visual.categoryIcon} class={sizeMap.markIcon} />
        </div>
        <div className="relative flex h-full items-center justify-center">
          <span className={`font-bricolage font-bold uppercase ${visual.accentText} ${sizeMap.text}`}>
            {visual.monogram}
          </span>
        </div>
      </div>
    </div>
  );
}