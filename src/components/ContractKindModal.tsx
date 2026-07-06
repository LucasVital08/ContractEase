import { motion } from 'motion/react';

export type ContractKind = 'document' | 'smart';

interface Props {
  onSelect: (kind: ContractKind) => void;
  onCancel: () => void;
  /** Texto de apoio abaixo do título. */
  subtitle?: string;
  /** Rótulo da CTA de cada carta (default "Escolher"). */
  ctaLabel?: string;
}

const KINDS: {
  id: ContractKind;
  title: string;
  description: string;
  icon: string;
  cardClass: string;
  iconClass: string;
  ctaClass: string;
}[] = [
  {
    id: 'document',
    title: 'Documento Contratual',
    description: 'Cláusulas, partes, assinatura digital e registro de prova na blockchain.',
    icon: 'solar:document-text-bold-duotone',
    cardClass: 'border-emerald-400/18 bg-emerald-500/8 hover:border-emerald-400/34 hover:bg-emerald-500/12',
    iconClass: 'border-emerald-400/18 bg-emerald-500/12 text-emerald-300',
    ctaClass: 'text-emerald-300',
  },
  {
    id: 'smart',
    title: 'Contrato Inteligente',
    description: 'Dinheiro programável, automação e execução on-chain (Stellar/Soroban).',
    icon: 'solar:cpu-bolt-bold-duotone',
    cardClass: 'border-cyan-400/18 bg-cyan-500/8 hover:border-cyan-400/34 hover:bg-cyan-500/12',
    iconClass: 'border-cyan-400/18 bg-cyan-500/12 text-cyan-300',
    ctaClass: 'text-cyan-300',
  },
];

export default function ContractKindModal({
  onSelect,
  onCancel,
  subtitle = 'Escolha o tipo de contrato — depois você define como quer criá-lo.',
  ctaLabel = 'Escolher',
}: Props) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 14 }}
        className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-neutral-950 p-6 shadow-[0_24px_90px_rgba(0,0,0,0.55)]"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-emerald-300">Criar</p>
            <h3 className="mt-2 text-2xl font-bold text-white font-bricolage">Por onde você quer começar?</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-400">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 text-neutral-500 hover:bg-white/[0.05] hover:text-white"
            title="Fechar"
            aria-label="Fechar"
          >
            <iconify-icon icon="solar:close-circle-bold" class="text-xl" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {KINDS.map((kind) => (
            <button
              key={kind.id}
              type="button"
              onClick={() => onSelect(kind.id)}
              className={`group rounded-2xl border p-5 text-left transition-all ${kind.cardClass}`}
            >
              <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border ${kind.iconClass}`}>
                <iconify-icon icon={kind.icon} class="text-2xl" />
              </div>
              <h4 className="text-base font-bold text-white">{kind.title}</h4>
              <p className="mt-2 text-sm leading-6 text-neutral-400">{kind.description}</p>
              <span className={`mt-5 inline-flex items-center gap-2 text-xs font-bold ${kind.ctaClass}`}>
                {ctaLabel}
                <iconify-icon icon="solar:arrow-right-linear" class="transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-5 py-2.5 text-sm font-medium text-neutral-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            Cancelar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
