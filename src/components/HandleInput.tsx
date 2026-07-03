import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  resolveHandle,
  resolveHandleSync,
  searchHandles,
  isStellarAddress,
  isHandle,
  lookupHandleByAddress,
  lookupProfileByAddress,
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
  const [asyncResolved, setAsyncResolved] = useState<ResolvedHandle | null>(null);
  const [resolving, setResolving] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const trimmed = value.trim();
  const syncResolved = !trimmed
    ? null
    : isStellarAddress(trimmed)
      ? lookupHandleByAddress(trimmed)
      : isHandle(trimmed)
        ? resolveHandleSync(trimmed)
        : null;
  const resolved = asyncResolved ?? syncResolved;
  const isDirectAddress = Boolean(trimmed) && isStellarAddress(trimmed);
  const canSearch = focused && !isDirectAddress && (trimmed === '' || trimmed.length >= 2);

  useEffect(() => {
    let cancel = false;

    if (!trimmed) {
      setAsyncResolved(null);
      setResolving(false);
      return;
    }

    if (isDirectAddress) {
      setResolving(true);
      lookupProfileByAddress(trimmed).then(result => {
        if (cancel) return;
        setAsyncResolved(result ?? lookupHandleByAddress(trimmed));
        setResolving(false);
      }).catch(() => {
        if (cancel) return;
        setAsyncResolved(lookupHandleByAddress(trimmed));
        setResolving(false);
      });
      return () => { cancel = true; };
    }

    if (trimmed.startsWith('@') || isHandle(trimmed)) {
      setResolving(true);
      resolveHandle(trimmed).then(result => {
        if (cancel) return;
        setAsyncResolved(result ?? resolveHandleSync(trimmed));
        setResolving(false);
      }).catch(() => {
        if (cancel) return;
        setAsyncResolved(resolveHandleSync(trimmed));
        setResolving(false);
      });
      return () => { cancel = true; };
    }

    setAsyncResolved(null);
    setResolving(false);
    return () => { cancel = true; };
  }, [trimmed, isDirectAddress]);

  useEffect(() => {
    let cancel = false;
    if (canSearch) {
      searchHandles(trimmed, 8).then(results => {
        if (!cancel) {
          setSuggestions(results);
          const firstSelectable = results.findIndex(result => Boolean(result.preferredInput));
          setSelectedIdx(firstSelectable >= 0 ? firstSelectable : 0);
        }
      });
    } else {
      setSuggestions([]);
    }
    return () => { cancel = true; };
  }, [trimmed, canSearch]);

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
    if (!s.preferredInput) return;
    onChange(s.preferredInput);
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

  const borderColor = resolved
    ? 'border-emerald-400/35'
    : focused
      ? 'border-white/16'
      : 'border-white/10';
  const helperMessage = !trimmed
    ? 'Busque por @handle, nome, e-mail ou carteira Stellar.'
    : resolving
      ? 'Procurando usuário existente...'
      : isDirectAddress
        ? (resolved ? 'Carteira Stellar reconhecida.' : 'Carteira Stellar válida. Se pertencer a um usuário cadastrado, os dados aparecerão aqui.')
        : trimmed.length >= 2 && suggestions.length === 0
          ? 'Nenhum usuário existente encontrado para esse termo.'
          : 'Selecione um usuário real da lista ou cole a carteira Stellar. Mesmo sem carteira conectada, o perfil pode seguir no fluxo.';

  return (
    <div className="relative" ref={wrapRef}>
      <div className={`rounded-[22px] border bg-neutral-950/90 p-2 transition-colors ${borderColor}`}>
        <div className="flex items-center gap-3 rounded-[18px] border border-white/6 bg-black/25 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-neutral-500 flex-shrink-0">
            {resolved
              ? <iconify-icon icon="solar:check-circle-bold" class="text-emerald-400 text-base" />
              : resolving
                ? <iconify-icon icon="solar:refresh-bold" class="text-neutral-300 text-base animate-spin" />
                : <iconify-icon icon="solar:user-id-bold-duotone" class="text-neutral-500 text-base" />}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500 mb-1">Parte do contrato</p>
            <input
              type="text"
              value={value}
              onChange={e => onChange(e.target.value)}
              onFocus={() => setFocused(true)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder || '@usuario, nome, email@empresa.com ou G...'}
              required={required}
              className="w-full bg-transparent text-sm text-white placeholder:text-neutral-600 outline-none min-w-0"
            />
          </div>

          {resolved && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-400/18 bg-emerald-500/8 px-2.5 py-1.5 text-xs flex-shrink-0 max-w-[220px]"
            >
              <IdentityAvatar handle={resolved.handle} displayName={resolved.displayName} avatar={resolved.avatar} size="sm" />
              <div className="min-w-0">
                <p className="truncate font-semibold text-emerald-200">{resolved.displayName}</p>
                <p className="truncate text-[10px] text-emerald-300/80">{resolved.email || resolved.preferredInput || resolved.address}</p>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-neutral-500">
        <iconify-icon icon="solar:info-circle-linear" class="text-sm" />
        {helperMessage}
      </p>

      <AnimatePresence>
        {focused && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute left-0 right-0 top-full mt-2 z-50 overflow-hidden rounded-[24px] border border-white/10 bg-neutral-950 shadow-[0_28px_80px_rgba(0,0,0,0.45)]"
          >
            <div className="flex items-center justify-between border-b border-white/6 bg-white/[0.03] px-4 py-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                  {trimmed ? 'Resultados reais' : 'Usuários existentes'}
                </p>
                <p className="mt-1 text-xs text-neutral-400">Busca por handle, nome ou e-mail</p>
              </div>
              <span className="rounded-full border border-white/8 bg-black/25 px-2.5 py-1 text-[10px] font-semibold text-neutral-300">
                {suggestions.length} resultado{suggestions.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="max-h-80 overflow-y-auto p-2">
            {suggestions.map((s, i) => (
              <button
                key={`${s.userId || s.handle}-${i}`}
                onClick={() => selectSuggestion(s)}
                onMouseEnter={() => setSelectedIdx(i)}
                disabled={!s.preferredInput}
                className={`w-full flex items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors ${
                  i === selectedIdx ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
                } ${!s.preferredInput ? 'opacity-55 cursor-not-allowed' : ''}`}
              >
                <IdentityAvatar handle={s.handle} displayName={s.displayName} avatar={s.avatar} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white">
                      {s.preferredInput?.startsWith('@') ? s.preferredInput : s.displayName}
                    </span>
                    {s.hasWallet ? (
                      <span className="rounded-full border border-emerald-400/16 bg-emerald-500/8 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">Carteira pronta</span>
                    ) : (
                      <span className="rounded-full border border-amber-400/16 bg-amber-500/8 px-2 py-0.5 text-[10px] font-semibold text-amber-200">Carteira pendente</span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px] text-neutral-400">
                    <span className="truncate max-w-[220px]">{s.displayName}</span>
                    {s.email && <span className="truncate max-w-[220px] text-neutral-500">{s.email}</span>}
                  </div>
                </div>
                <div className="text-right text-[10px] text-neutral-500 flex-shrink-0">
                  {s.preferredInput?.startsWith('@')
                    ? 'Seleciona @handle'
                    : s.address
                      ? 'Seleciona carteira'
                      : 'Seleciona perfil'}
                </div>
              </button>
            ))}
            </div>

            <div className="flex items-center justify-between border-t border-white/6 bg-white/[0.03] px-4 py-2.5 text-[10px] text-neutral-500">
              <span>↑↓ navegar · Enter selecionar</span>
              <span>somente perfis reais</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function IdentityAvatar({ handle, displayName, avatar, size = 'md' }: {
  handle: string;
  displayName: string;
  avatar?: string;
  size?: 'sm' | 'md';
}) {
  const frame = size === 'sm' ? 'h-8 w-8 rounded-xl text-[11px]' : 'h-11 w-11 rounded-2xl text-xs';
  const initials = getInitials(displayName || handle);
  const isAvatarUrl = Boolean(avatar && /^https?:\/\//i.test(avatar));

  return (
    <div className={`flex items-center justify-center overflow-hidden border border-white/10 bg-white/[0.04] text-neutral-200 font-semibold flex-shrink-0 ${frame}`}>
      {isAvatarUrl
        ? <img src={avatar} alt={displayName} className="h-full w-full object-cover" />
        : <span>{initials}</span>}
    </div>
  );
}

function getInitials(text: string) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('') || 'US';
}
