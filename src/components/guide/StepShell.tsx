/**
 * Moldura de uma etapa.
 *
 * Uma etapa = um título, uma frase de contexto, um conteúdo e UMA ação
 * principal. A ação principal fica sempre no mesmo lugar (canto inferior
 * direito, em verde), e a ação de voltar sempre à esquerda. Isso é o que torna
 * o fluxo previsível: o usuário aprende o padrão na primeira tela e repete.
 */

import type { ReactNode } from 'react';
import { motion } from 'motion/react';

export function StepShell({
  eyebrow,
  title,
  subtitle,
  children,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  primaryLoading,
  primaryHint,
  onBack,
  backLabel = 'Voltar',
  secondary,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  /** Por que o botão está desabilitado — nunca deixe o usuário adivinhar. */
  primaryHint?: string;
  onBack?: () => void;
  backLabel?: string;
  secondary?: ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="space-y-6"
    >
      <header className="space-y-2">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-400">{eyebrow}</p>
        )}
        <h1 className="font-bricolage text-2xl font-bold leading-tight text-white sm:text-3xl">{title}</h1>
        {subtitle && <p className="max-w-2xl text-sm leading-6 text-neutral-400">{subtitle}</p>}
      </header>

      <div className="space-y-5">{children}</div>

      {(onPrimary || onBack || secondary) && (
        <footer className="flex flex-col gap-3 border-t border-white/8 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-400 transition-colors hover:text-white"
              >
                <iconify-icon icon="solar:arrow-left-linear" class="text-base" />
                {backLabel}
              </button>
            )}
            {secondary}
          </div>

          {onPrimary && (
            <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
              <button
                type="button"
                onClick={onPrimary}
                disabled={primaryDisabled || primaryLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-black shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-white/8 disabled:text-neutral-500 disabled:shadow-none"
              >
                {primaryLoading && <iconify-icon icon="svg-spinners:ring-resize" class="text-base" />}
                {primaryLabel}
                {!primaryLoading && <iconify-icon icon="solar:arrow-right-linear" class="text-base" />}
              </button>
              {primaryHint && primaryDisabled && (
                <p className="text-right text-[11px] text-neutral-500">{primaryHint}</p>
              )}
            </div>
          )}
        </footer>
      )}
    </motion.section>
  );
}

/**
 * Cartão de escolha grande. Usado quando a pergunta tem 2–3 respostas e
 * precisamos que a diferença entre elas fique óbvia sem o usuário ler tudo.
 */
export function ChoiceCard({
  icon,
  title,
  description,
  meta,
  selected,
  onClick,
  disabled,
  badge,
}: {
  icon: string;
  title: string;
  description: string;
  meta?: string;
  selected?: boolean;
  onClick: () => void;
  disabled?: boolean;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`group flex w-full items-start gap-4 rounded-2xl border p-5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-45 ${
        selected
          ? 'border-emerald-400/50 bg-emerald-500/[0.07] shadow-[0_0_0_1px_rgba(52,211,153,0.18)]'
          : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
      }`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors ${
          selected ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300' : 'border-white/10 bg-black/30 text-neutral-400'
        }`}
      >
        <iconify-icon icon={icon} class="text-xl" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-semibold text-white">{title}</span>
          {badge && (
            <span className="rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
              {badge}
            </span>
          )}
        </span>
        <span className="mt-1.5 block text-sm leading-6 text-neutral-400">{description}</span>
        {meta && <span className="mt-2 block text-[11px] text-neutral-600">{meta}</span>}
      </span>

      <span
        className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
          selected ? 'border-emerald-400 bg-emerald-400 text-black' : 'border-white/15 text-transparent'
        }`}
      >
        <iconify-icon icon="solar:check-read-linear" class="text-[11px]" />
      </span>
    </button>
  );
}

/** Campo de formulário com rótulo, dica e erro no mesmo padrão em todo lugar. */
export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline gap-1.5 text-sm font-medium text-neutral-200">
        {label}
        {required && <span className="text-emerald-400">*</span>}
      </span>
      {hint && <span className="mt-0.5 block text-xs leading-5 text-neutral-500">{hint}</span>}
      <span className="mt-2 block">{children}</span>
      {error && (
        <span className="mt-1.5 flex items-center gap-1.5 text-xs text-red-400">
          <iconify-icon icon="solar:danger-circle-bold" class="text-sm" />
          {error}
        </span>
      )}
    </label>
  );
}

export const inputClass =
  'w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-emerald-500/60';
