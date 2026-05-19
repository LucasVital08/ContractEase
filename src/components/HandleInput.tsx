import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  resolveHandleSync,
  searchHandles,
  isStellarAddress,
  isHandle,
  normalizeHandle,
  lookupHandleByAddress,
  type ResolvedHandle,
} from '@/services/handleResolver';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

/**
 * Input especializado para campos de endereço Stellar.
 *
 * Aceita:
 *  - @handle (preferido, mostra autocomplete)
 *  - G... (endereço Stellar bruto)
 *
 * Mostra um chip com nome/avatar quando resolvido.
 */
export default function HandleInput({ value, onChange, placeholder, required }: Props) {
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<ResolvedHandle[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Estado de validação
  const trimmed = value.trim();
  let resolved: ResolvedHandle | null = null;
  let validationState: 'empty' | 'valid_handle' | 'valid_address' | 'invalid' | 'partial' = 'empty';

  if (!trimmed) {
    validationState = 'empty';
  } else if (trimmed.startsWith('@')) {
    resolved = resolveHandleSync(trimmed);
    validationState = resolved ? 'valid_handle' : 'partial';
  } else if (isStellarAddress(trimmed)) {
    resolved = lookupHandleByAddress(trimmed);
    validationState = 'valid_address';
  } else if (isHandle(trimmed)) {
    // sem @ mas parece um handle
    resolved = resolveHandleSync(trimmed);
    validationState = resolved ? 'valid_handle' : 'partial';
  } else if (trimmed.length > 3) {
    validationState = 'invalid';
  } else {
    validationState = 'partial';
  }

  // Carrega sugestões quando começa a digitar @
  useEffect(() => {
    let cancel = false;
    if (focused && trimmed.startsWith('@')) {
      const query = normalizeHandle(trimmed);
      searchHandles(query, 6).then(results => {
        if (!cancel) {
          setSuggestions(results);
          setSelectedIdx(0);
        }
      });
    } else if (focused && trimmed === '') {
      // Mostra "destaques" quando focar com input vazio
      searchHandles('', 6).then(results => {
        if (!cancel) {
          setSuggestions(results);
          setSelectedIdx(0);
        }
      });
    } else {
      setSuggestions([]);
    }
    return () => { cancel = true; };
  }, [trimmed, focused]);

  // Fecha o dropdown quando clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function selectSuggestion(s: ResolvedHandle) {
    onChange(`@${s.handle}`);
    setFocused(false);
    setSuggestions([]);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      selectSuggestion(suggestions[selectedIdx]);
    } else if (e.key === 'Escape') {
      setFocused(false);
    }
  }

  // ─── Estilo dinâmico do input ─────────────────────
  const borderColor = {
    empty: 'border-white/10',
    valid_handle: 'border-emerald-500/50',
    valid_address: 'border-blue-500/40',
    partial: 'border-amber-500/30',
    invalid: 'border-red-500/40',
  }[validationState];

  return (
    <div className="relative" ref={wrapRef}>
      <div className={`flex items-center gap-2 bg-neutral-950 border rounded-lg px-3 py-2 transition-colors ${borderColor} focus-within:border-fuchsia-500/50`}>
        {/* Prefix icon */}
        <div className="text-neutral-500 flex-shrink-0">
          {validationState === 'valid_handle' || validationState === 'valid_address'
            ? <iconify-icon icon="solar:check-circle-bold" class="text-emerald-400 text-base" />
            : validationState === 'partial'
              ? <iconify-icon icon="solar:question-circle-bold" class="text-amber-400 text-base" />
              : validationState === 'invalid'
                ? <iconify-icon icon="solar:close-circle-bold" class="text-red-400 text-base" />
                : <iconify-icon icon="solar:at-bold" class="text-neutral-600 text-base" />}
        </div>

        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || '@usuario ou G...'}
          required={required}
          className="flex-1 bg-transparent text-sm text-white placeholder:text-neutral-600 outline-none min-w-0"
        />

        {/* Chip do usuário resolvido */}
        {resolved && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-2 py-0.5 text-xs flex-shrink-0 max-w-[140px]"
          >
            <span>{resolved.avatar || '👤'}</span>
            <span className="text-emerald-300 font-medium truncate">{resolved.displayName}</span>
            {resolved.verified && (
              <iconify-icon icon="solar:verified-check-bold" class="text-blue-400 text-xs flex-shrink-0" />
            )}
          </motion.div>
        )}
      </div>

      {/* Mensagem de erro/dica abaixo do input */}
      {validationState === 'partial' && trimmed.startsWith('@') && (
        <p className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
          <iconify-icon icon="solar:info-circle-bold" />
          {`@${normalizeHandle(trimmed)} não encontrado — digite para ver sugestões`}
        </p>
      )}
      {validationState === 'invalid' && (
        <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1">
          <iconify-icon icon="solar:close-circle-bold" />
          Use um @handle (ex: @lucas) ou endereço Stellar (G...)
        </p>
      )}

      {/* Dropdown de sugestões */}
      <AnimatePresence>
        {focused && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute left-0 right-0 top-full mt-1 z-50 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden"
          >
            {trimmed === '' && (
              <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wider border-b border-white/5 bg-neutral-950/50">
                Usuários em destaque
              </div>
            )}
            {suggestions.map((s, i) => (
              <button
                key={s.handle}
                onClick={() => selectSuggestion(s)}
                onMouseEnter={() => setSelectedIdx(i)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                  i === selectedIdx ? 'bg-fuchsia-500/10' : 'hover:bg-white/5'
                }`}
              >
                <div className="text-xl flex-shrink-0">{s.avatar || '👤'}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-white">@{s.handle}</span>
                    {s.verified && <iconify-icon icon="solar:verified-check-bold" class="text-blue-400 text-xs" />}
                  </div>
                  <div className="text-xs text-neutral-400 truncate">{s.displayName}</div>
                </div>
                {s.kind === 'company' && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/20">EMPRESA</span>
                )}
                {s.kind === 'project' && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/20">PROJETO</span>
                )}
                {s.kind === 'supplier' && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20">SERVIÇO</span>
                )}
              </button>
            ))}
            <div className="px-3 py-2 text-[10px] text-neutral-600 border-t border-white/5 bg-neutral-950/40 flex items-center justify-between">
              <span>↑↓ navegar · Enter selecionar</span>
              <span className="text-fuchsia-400">{suggestions.length} resultados</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
