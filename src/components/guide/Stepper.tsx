/**
 * Trilha de passos sempre visível.
 *
 * O usuário nunca deve se perguntar "quantas telas faltam?". A trilha responde
 * isso o tempo todo, e passos já concluídos são clicáveis para voltar.
 */

import { motion } from 'motion/react';

export interface StepDef {
  id: string;
  label: string;
}

export function Stepper({
  steps,
  current,
  onGoTo,
}: {
  steps: StepDef[];
  current: number;
  onGoTo?: (index: number) => void;
}) {
  return (
    <nav aria-label="Progresso" className="w-full">
      <ol className="flex items-center gap-1.5 sm:gap-2">
        {steps.map((step, index) => {
          const done = index < current;
          const active = index === current;
          const clickable = done && Boolean(onGoTo);

          return (
            <li key={step.id} className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onGoTo?.(index)}
                aria-current={active ? 'step' : undefined}
                className={`group flex min-w-0 flex-1 flex-col gap-1.5 text-left ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <span className="relative block h-1 w-full overflow-hidden rounded-full bg-white/8">
                  <motion.span
                    initial={false}
                    animate={{ width: done ? '100%' : active ? '52%' : '0%' }}
                    transition={{ type: 'spring', stiffness: 220, damping: 30 }}
                    className={`absolute inset-y-0 left-0 rounded-full ${done ? 'bg-emerald-400' : 'bg-emerald-400/70'}`}
                  />
                </span>
                <span
                  className={`truncate text-[11px] font-medium transition-colors ${
                    active ? 'text-white' : done ? 'text-emerald-300/80 group-hover:text-emerald-200' : 'text-neutral-600'
                  }`}
                >
                  {index + 1}. {step.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
