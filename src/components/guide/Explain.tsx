/**
 * Blocos de explicação reutilizáveis.
 *
 * Regra de produto: toda etapa que envolve blockchain responde três perguntas,
 * sempre na mesma ordem e sempre com o mesmo formato visual — "o que é isso",
 * "por que existe" e "como fazer". A previsibilidade é o que faz o usuário
 * comum parar de ter medo da tela.
 */

import type { ReactNode } from 'react';

export function Explain({
  what,
  why,
  how,
}: {
  what: string;
  why: string;
  how: string[];
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
      <dl className="space-y-4">
        <ExplainRow icon="solar:info-circle-bold-duotone" label="O que é isso" tone="text-sky-300">
          {what}
        </ExplainRow>
        <ExplainRow icon="solar:question-circle-bold-duotone" label="Por que existe" tone="text-violet-300">
          {why}
        </ExplainRow>
        <div>
          <dt className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
            <iconify-icon icon="solar:list-check-bold-duotone" class="text-base" />
            Como fazer
          </dt>
          <dd className="mt-2">
            <ol className="space-y-2">
              {how.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm leading-6 text-neutral-300">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/12 bg-black/40 text-[10px] font-bold text-neutral-400">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </dd>
        </div>
      </dl>
    </div>
  );
}

function ExplainRow({
  icon,
  label,
  tone,
  children,
}: {
  icon: string;
  label: string;
  tone: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt className={`flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] ${tone}`}>
        <iconify-icon icon={icon} class="text-base" />
        {label}
      </dt>
      <dd className="mt-1.5 text-sm leading-6 text-neutral-300">{children}</dd>
    </div>
  );
}

/** Aviso honesto — usado quando existe uma limitação real que o usuário precisa saber. */
export function Caveat({ children }: { children: ReactNode }) {
  return (
    <p className="flex gap-2 rounded-xl border border-amber-400/20 bg-amber-500/[0.06] px-4 py-3 text-xs leading-6 text-amber-200/90">
      <iconify-icon icon="solar:danger-triangle-bold-duotone" class="mt-0.5 shrink-0 text-sm" />
      <span>{children}</span>
    </p>
  );
}

/** Explicação curta em linha, para termos técnicos inevitáveis. */
export function Term({ term, meaning }: { term: string; meaning: string }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="font-medium text-white">{term}</span>
      <span className="text-neutral-500">({meaning})</span>
    </span>
  );
}
