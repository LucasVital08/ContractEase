import { motion, AnimatePresence } from 'motion/react';
import { type SmartContractTemplate, CATEGORIES } from '@/services/smartContractTemplates';
import { getQuestionsForTemplate } from '@/services/templateQuestions';
import { SmartContractGlyph, getSmartContractVisual } from '@/components/SmartContractVisual';

export type CreationMode = 'chat' | 'questions';

interface Props {
  template: SmartContractTemplate | null;
  onSelect: (mode: CreationMode) => void;
  onClose: () => void;
}

export default function ContractCreationModeModal({ template, onSelect, onClose }: Props) {
  if (!template) return null;

  const questionsCount = getQuestionsForTemplate(template.id).length;
  const categoryMeta = CATEGORIES.find(c => c.id === template.category);
  const visual = getSmartContractVisual(template);

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-neutral-950/88 backdrop-blur-md z-50 flex items-center justify-center p-4"
      >
        <motion.div
          key="modal"
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-3xl overflow-hidden rounded-[32px] border border-white/10 bg-neutral-950 shadow-[0_32px_120px_rgba(0,0,0,0.55)]"
        >
          <div className="relative border-b border-white/6 p-6 sm:p-7">
            <div className={`absolute inset-0 bg-gradient-to-br ${visual.accentGradient}`} />
            <div className="absolute inset-0 bg-[linear-gradient(140deg,rgba(255,255,255,0.08),transparent_38%)] opacity-70" />
            <div className="relative flex items-start gap-4">
              <SmartContractGlyph template={template} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${visual.accentChip}`}>
                    {categoryMeta?.label}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-neutral-300">
                    {template.difficulty}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-neutral-300">
                    {template.variables.length} campos
                  </span>
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${template.isFullyImplemented ? visual.accentChip : 'border-white/10 bg-white/[0.04] text-neutral-400'}`}>
                    {template.isFullyImplemented ? 'Operacional' : 'Beta'}
                  </span>
                </div>

                <h2 className="text-2xl font-bold leading-tight text-white font-bricolage">{template.name}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-neutral-300">{template.description}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {template.useCases.slice(0, 3).map(useCase => (
                    <span key={useCase} className="rounded-full border border-white/8 bg-black/25 px-3 py-1.5 text-[11px] font-medium text-neutral-300">
                      {useCase}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-neutral-500 transition-colors hover:text-white"
                aria-label="Fechar"
              >
                <iconify-icon icon="solar:close-circle-linear" class="text-2xl" />
              </button>
            </div>
          </div>

          <div className="p-6 sm:p-7">
            <div className="flex items-end justify-between gap-4 flex-wrap mb-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500 mb-1">Modo de criação</p>
                <h3 className="text-xl font-bold text-white font-bricolage">
                  Escolha como quer iniciar esse contrato
                </h3>
              </div>
              <div className="text-xs text-neutral-500">
                Você pode trocar de modo depois.
              </div>
            </div>

            <p className="text-sm text-neutral-400 mb-5 leading-6">
              Como você quer criar esse contrato?
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ModeCard
                icon="solar:magic-stick-3-bold-duotone"
                title="Conversar com a IA"
                description="Digite como você falaria para um operador especialista. A IA extrai partes, valores, prazos e variáveis no meio da conversa."
                tags={['Entrada livre', 'Mais rápido']}
                onClick={() => onSelect('chat')}
              />
              <ModeCard
                icon="solar:list-check-bold-duotone"
                title="Responder perguntas"
                description={`Percurso guiado com ${questionsCount} perguntas claras, uma por vez, ideal para clientes que precisam de máxima previsibilidade.`}
                tags={['Guiado', 'Mais seguro']}
                onClick={() => onSelect('questions')}
                recommended
              />
            </div>
          </div>

          {template.useCases?.length > 0 && (
            <div className="px-6 pb-7 sm:px-7">
              <p className="text-[11px] uppercase tracking-[0.22em] text-neutral-500 font-semibold mb-3">
                Onde esse fluxo costuma ser usado
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {template.useCases.slice(0, 4).map((u, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-neutral-300"
                  >
                    <div className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border ${visual.accentChip}`}>
                      <iconify-icon icon="solar:check-circle-bold" class="text-xs" />
                    </div>
                    {u}
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function ModeCard({ icon, title, description, tags, onClick, recommended }: {
  icon: string;
  title: string;
  description: string;
  tags: string[];
  onClick: () => void;
  recommended?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`group text-left p-5 rounded-[26px] border transition-all flex flex-col gap-4 ${
        recommended
          ? 'bg-emerald-500/[0.05] border-emerald-500/28 hover:border-emerald-500/50 hover:bg-emerald-500/[0.08]'
          : 'bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.05]'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${recommended ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-white/10 bg-black/20 text-neutral-300'}`}>
          <iconify-icon icon={icon} class="text-3xl" />
        </div>
        {recommended && (
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full">
            Recomendado
          </span>
        )}
      </div>

      <div>
        <h4 className="text-base font-semibold text-white mb-1.5 font-bricolage">{title}</h4>
        <p className="text-sm text-neutral-400 leading-6">{description}</p>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-1">
        {tags.map((t, i) => (
          <span
            key={i}
            className="text-[11px] text-neutral-400 bg-black/25 border border-white/8 px-2 py-1 rounded-full"
          >
            {t}
          </span>
        ))}
      </div>

      <div className={`flex items-center gap-1.5 text-sm font-semibold pt-2 mt-auto ${
        recommended ? 'text-emerald-400' : 'text-neutral-300'
      }`}>
        Começar
        <iconify-icon icon="solar:arrow-right-linear" class="group-hover:translate-x-0.5 transition-transform" />
      </div>
    </button>
  );
}
