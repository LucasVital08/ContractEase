import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { SCQuestion } from '@/services/smartContractTemplates';
import HandleInput from '@/components/HandleInput';

interface Props {
  questions: SCQuestion[];
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
  onComplete: () => void;
  onSwitchToChat?: () => void;
}

export default function QuestionnaireFlow({ questions, values, onChange, onComplete, onSwitchToChat }: Props) {
  const [index, setIndex] = useState(0);
  const total = questions.length;
  const current = questions[index];
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (current?.type !== 'open') return;
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 140);
    return () => window.clearTimeout(focusTimer);
  }, [current?.id, current?.type]);

  const value = current ? values[current.bindTo] || '' : '';
  const isFilled = Boolean(value.trim());
  const isFinalQuestion = index === total - 1;
  const answeredCount = useMemo(
    () => questions.filter(question => values[question.bindTo]?.trim()).length,
    [questions, values],
  );
  const allRequired = useMemo(
    () => questions.every(question => !question.required || values[question.bindTo]?.trim()),
    [questions, values],
  );

  function goNext() {
    if (current.required && !isFilled) return;
    if (isFinalQuestion) {
      if (allRequired) onComplete();
      return;
    }
    setIndex(currentIndex => Math.min(currentIndex + 1, total - 1));
  }

  function goBack() {
    setIndex(currentIndex => Math.max(currentIndex - 1, 0));
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey && current.type !== 'choice') {
      event.preventDefault();
      goNext();
    }
  }

  if (!current) {
    return (
      <div className="flex h-full items-center justify-center rounded-[28px] border border-white/8 bg-neutral-900/70 p-6 text-sm text-neutral-400">
        Esse template ainda não tem um questionário guiado. Use o modo chat com IA.
      </div>
    );
  }

  const progressPct = Math.max(6, Math.round(((index + (isFilled ? 1 : 0)) / total) * 100));

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-white/8 bg-neutral-900/70 shadow-[0_22px_70px_rgba(0,0,0,0.28)]">
      <div className="relative border-b border-white/6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_36%)]" />
        <div className="relative px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/16 bg-emerald-500/10 text-emerald-300">
                <iconify-icon icon="solar:list-check-bold-duotone" class="text-lg" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Questionário guiado</p>
                <h3 className="mt-1 text-base font-bold text-white font-bricolage">Preenchimento assistido</h3>
                <p className="mt-1 text-xs text-neutral-400">Uma pergunta por vez para montar o contrato com contexto real.</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-black/25 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-300">
                <iconify-icon icon="solar:clipboard-list-bold" class="text-sm" />
                {index + 1}/{total}
              </span>
              {onSwitchToChat && (
                <button
                  onClick={onSwitchToChat}
                  className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-neutral-300 transition-colors hover:border-white/14 hover:text-white"
                >
                  <iconify-icon icon="solar:magic-stick-3-linear" class="text-sm" />
                  Ir para o chat
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-emerald-300 to-cyan-300"
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="text-[11px] font-medium text-neutral-500">{answeredCount} preenchido{answeredCount !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 sm:p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22 }}
            className="rounded-[26px] border border-white/8 bg-black/25 p-5 sm:p-6"
          >
            <div className="flex gap-4 items-start">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[20px] border border-white/8 bg-white/[0.03] text-sm font-semibold text-white">
                {(index + 1).toString().padStart(2, '0')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Pergunta atual</p>
                  {current.required && (
                    <span className="rounded-full border border-emerald-400/16 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                      Obrigatória
                    </span>
                  )}
                </div>
                <h4 className="mt-3 text-xl font-bold leading-tight text-white font-bricolage sm:text-2xl">
                  {current.question}
                </h4>
                {current.context && (
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-neutral-400">{current.context}</p>
                )}
              </div>
            </div>

            <div className="mt-6">
              {current.type === 'open' ? (
                <OpenInput
                  question={current}
                  value={value}
                  onChange={nextValue => onChange(current.bindTo, nextValue)}
                  onKeyDown={handleKeyDown}
                  inputRef={inputRef}
                />
              ) : (
                <ChoiceInput
                  question={current}
                  value={value}
                  onChange={nextValue => {
                    onChange(current.bindTo, nextValue);
                    window.setTimeout(() => {
                      if (isFinalQuestion) {
                        if (questions.every(question => !question.required || (question.bindTo === current.bindTo ? nextValue : values[question.bindTo])?.trim())) {
                          onComplete();
                        }
                        return;
                      }
                      setIndex(currentIndex => Math.min(currentIndex + 1, total - 1));
                    }, 220);
                  }}
                />
              )}
            </div>

            {(current.helper || current.placeholder) && (
              <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-xs leading-6 text-neutral-400">
                <div className="flex items-start gap-2">
                  <iconify-icon icon="solar:info-circle-linear" class="mt-0.5 text-sm text-neutral-500" />
                  <p>{current.helper || current.placeholder}</p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="border-t border-white/6 bg-black/15 px-5 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={goBack}
            disabled={index === 0}
            className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-4 py-2 text-sm font-medium text-neutral-300 transition-colors hover:border-white/14 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
          >
            <iconify-icon icon="solar:arrow-left-linear" class="text-base" />
            Voltar
          </button>

          <QuestionDots questions={questions} values={values} currentIndex={index} onJump={setIndex} />

          <button
            onClick={goNext}
            disabled={current.required && !isFilled}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              current.required && !isFilled
                ? 'cursor-not-allowed border border-white/8 bg-white/[0.03] text-neutral-600'
                : isFinalQuestion
                  ? 'border border-emerald-400/18 bg-emerald-500 text-neutral-950 hover:bg-emerald-400'
                  : 'border border-white/10 bg-white text-neutral-950 hover:bg-neutral-100'
            }`}
          >
            {isFinalQuestion ? 'Concluir' : 'Avançar'}
            <iconify-icon icon={isFinalQuestion ? 'solar:check-circle-bold' : 'solar:arrow-right-linear'} class="text-base" />
          </button>
        </div>
      </div>
    </div>
  );
}

function OpenInput({ question, value, onChange, onKeyDown, inputRef }: {
  question: SCQuestion;
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  inputRef: React.MutableRefObject<HTMLInputElement | HTMLTextAreaElement | null>;
}) {
  const baseClass = 'w-full rounded-[22px] border border-white/8 bg-neutral-950/90 px-4 py-3 text-base text-white placeholder:text-neutral-600 outline-none transition-colors focus:border-emerald-400/35';

  if (question.inputType === 'address') {
    return (
      <HandleInput
        value={value}
        onChange={onChange}
        placeholder={question.placeholder || '@usuario, email@empresa.com ou G...'}
        required={question.required}
      />
    );
  }

  if (question.inputType === 'long_text') {
    return (
      <textarea
        ref={inputRef as React.MutableRefObject<HTMLTextAreaElement>}
        value={value}
        onChange={event => onChange(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey) onKeyDown(event);
        }}
        placeholder={question.placeholder || ''}
        rows={4}
        className={`${baseClass} resize-none leading-7`}
      />
    );
  }

  const inputType = question.inputType === 'date'
    ? 'date'
    : question.inputType === 'amount' || question.inputType === 'number'
      ? 'text'
      : 'text';

  return (
    <input
      ref={inputRef as React.MutableRefObject<HTMLInputElement>}
      type={inputType}
      inputMode={question.inputType === 'amount' || question.inputType === 'number' ? 'decimal' : undefined}
      value={value}
      onChange={event => onChange(event.target.value)}
      onKeyDown={onKeyDown}
      placeholder={question.placeholder || ''}
      className={baseClass}
    />
  );
}

function ChoiceInput({ question, value, onChange }: {
  question: SCQuestion;
  value: string;
  onChange: (value: string) => void;
}) {
  const options = question.options || [];

  return (
    <div className="space-y-3">
      {options.map(option => {
        const isSelected = value === option.value;

        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`w-full rounded-[22px] border p-4 text-left transition-all ${
              isSelected
                ? 'border-emerald-400/22 bg-emerald-500/10'
                : 'border-white/8 bg-white/[0.03] hover:border-white/14 hover:bg-white/[0.05]'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border transition-colors ${
                isSelected ? 'border-emerald-400 bg-emerald-400 text-neutral-950' : 'border-neutral-600 text-transparent'
              }`}>
                <iconify-icon icon="solar:check-bold" class="text-xs" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-neutral-200'}`}>{option.label}</p>
                {option.description && (
                  <p className="mt-1 text-xs leading-6 text-neutral-400">{option.description}</p>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function QuestionDots({ questions, values, currentIndex, onJump }: {
  questions: SCQuestion[];
  values: Record<string, string>;
  currentIndex: number;
  onJump: (index: number) => void;
}) {
  return (
    <div className="hidden sm:flex items-center gap-2">
      {questions.map((question, index) => {
        const filled = Boolean(values[question.bindTo]?.trim());
        const current = index === currentIndex;

        return (
          <button
            key={question.id}
            onClick={() => onJump(index)}
            aria-label={`Ir para pergunta ${index + 1}`}
            className={`rounded-full transition-all ${
              current
                ? 'h-2 w-10 bg-emerald-400'
                : filled
                  ? 'h-2 w-2 bg-emerald-500/70 hover:bg-emerald-400'
                  : 'h-2 w-2 bg-white/14 hover:bg-white/24'
            }`}
          />
        );
      })}
    </div>
  );
}
