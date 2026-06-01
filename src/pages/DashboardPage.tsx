import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { useContracts } from '@/hooks/useContractQueries';
import { useOpportunityFeed } from '@/hooks/useOpportunityQueries';
import { useAuthStore, useNotificationStore } from '@/stores';
import type { Contract } from '@/types';
import { api, signingService } from '@/services/supabaseService';
import { supabase } from '@/lib/supabase';
import { formatOpportunityReward, type SmartContractOpportunity } from '@/services/smartContractOpportunityService';

function isSmartContract(contract: Pick<Contract, 'tags'> | null | undefined) {
  return Boolean(contract?.tags?.includes('smart-contract'));
}

function StatCard({ title, value, icon, color, bg, to, subtext, delay = 0 }: {
  title: string; value: string; icon: string; color: string; bg: string;
  to: string; subtext?: string; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <Link
        to={to}
        className="group relative flex h-full flex-col rounded-2xl border border-white/[0.06] bg-white/[0.018] p-5 transition-colors hover:border-emerald-400/25 hover:bg-white/[0.035]"
      >
        <div className="mb-5 flex items-center justify-between">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${bg}`}>
            <iconify-icon icon={icon} class={`text-base ${color}`} />
          </div>
          <iconify-icon
            icon="solar:arrow-right-up-linear"
            class="text-neutral-700 text-sm opacity-0 transition-opacity group-hover:opacity-100"
          />
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">{title}</p>
        <p className="mt-2 font-bricolage text-[2.5rem] font-bold leading-none tabular-nums text-white">{value}</p>
        {subtext && <p className="mt-2 text-[11px] leading-5 text-neutral-500">{subtext}</p>}
      </Link>
    </motion.div>
  );
}

function RecentRow({ contract }: { contract: Contract }) {
  const statusMap: Record<string, { label: string; cls: string }> = {
    active: { label: 'Ativo', cls: 'bg-emerald-500/[0.10] text-emerald-300' },
    pending: { label: 'Pendente', cls: 'bg-amber-500/[0.08] text-amber-200' },
    completed: { label: 'Concluído', cls: 'bg-indigo-500/[0.08] text-indigo-300' },
    draft: { label: 'Rascunho', cls: 'bg-white/[0.04] text-neutral-400' },
    cancelled: { label: 'Cancelado', cls: 'bg-rose-500/[0.08] text-rose-300' },
    archived: { label: 'Arquivado', cls: 'bg-white/[0.03] text-neutral-500' },
  };
  const s = statusMap[contract.status] ?? statusMap.draft;
  const smart = isSmartContract(contract);

  return (
    <Link to={`/contracts/${contract.id}`} className="flex items-center justify-between gap-3 py-3 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] px-2 -mx-2 rounded-lg transition-colors">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-white text-sm font-medium truncate">{contract.title}</span>
        {smart && (
          <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-500/[0.10] text-emerald-300 text-[10px] font-bold uppercase tracking-wide">
            Smart
          </span>
        )}
        {contract.stellarTxHash && (
          <iconify-icon icon="solar:shield-check-linear" class="text-emerald-400/70 text-sm shrink-0" />
        )}
      </div>
      <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${s.cls}`}>
        {s.label}
      </span>
    </Link>
  );
}

const DEFAULT_WIDGETS = {
  stats: true,
  blockchain: true,
  expirations: true,
  activity: true
};

function buildSmoothPath(pts: { x: number; y: number }[]) {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

function ContractsTrendChart({ contracts }: { contracts: Contract[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [docsOpen, setDocsOpen] = useState(true);
  const [smartOpen, setSmartOpen] = useState(true);

  const series = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, idx) => {
      const i = 5 - idx;
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = d.getTime();
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
      const items = contracts.filter((c) => {
        const t = new Date(c.createdAt).getTime();
        return !Number.isNaN(t) && t >= start && t < end;
      });
      return {
        label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
        fullLabel: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
        count: items.length,
        items,
      };
    });
  }, [contracts]);

  const W = 640;
  const H = 180;
  const PX = 16;
  const PT = 20;
  const PB = 12;
  const innerW = W - PX * 2;
  const innerH = H - PT - PB;
  const step = innerW / Math.max(series.length - 1, 1);
  const max = Math.max(...series.map((s) => s.count), 1);
  const points = series.map((s, i) => ({
    x: PX + step * i,
    y: PT + innerH - (innerH * s.count) / max,
    ...s,
  }));
  const linePath = buildSmoothPath(points);
  const last = points[points.length - 1];
  const first = points[0];
  const areaPath = linePath ? `${linePath} L ${last.x},${PT + innerH} L ${first.x},${PT + innerH} Z` : '';
  const selectedData = selected != null ? series[selected] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.14, duration: 0.4 }}
      className="rounded-3xl border border-white/[0.06] bg-white/[0.018] p-7"
    >
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Evolução</p>
          <h3 className="mt-1 font-bricolage text-2xl font-bold text-white">Contratos por mês</h3>
          <p className="mt-1 text-xs text-neutral-500">Os últimos 6 meses · clique num mês pra ver a lista</p>
        </div>
        {selectedData && (
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">{selectedData.fullLabel}</p>
            <p className="font-bricolage text-3xl font-bold tabular-nums text-emerald-300">{selectedData.count}</p>
          </div>
        )}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 'auto' }} role="img" aria-label="Contratos por mês">
        <defs>
          <linearGradient id="dashAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* horizontal guide line at midpoint */}
        <line x1={PX} x2={W - PX} y1={PT + innerH / 2} y2={PT + innerH / 2} stroke="rgba(255,255,255,0.04)" strokeDasharray="2 4" />
        {areaPath && <path d={areaPath} fill="url(#dashAreaGrad)" />}
        {linePath && <path d={linePath} fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
        {points.map((p, i) => (
          <g key={i}>
            {selected === i && (
              <line x1={p.x} x2={p.x} y1={PT} y2={PT + innerH} stroke="#34d399" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="3 3" />
            )}
            <circle
              cx={p.x}
              cy={p.y}
              r={selected === i ? 6 : 4}
              fill={selected === i ? '#34d399' : '#0a0b0d'}
              stroke="#34d399"
              strokeWidth="2"
            />
            <rect
              x={p.x - step / 2}
              y={PT}
              width={step}
              height={innerH}
              fill="transparent"
              className="cursor-pointer"
              onClick={() => setSelected(selected === i ? null : i)}
            />
          </g>
        ))}
      </svg>

      <div className="mt-3 flex justify-between gap-1 px-1">
        {series.map((s, i) => (
          <button
            key={i}
            onClick={() => setSelected(selected === i ? null : i)}
            className={`flex flex-1 flex-col items-center rounded-xl py-2 transition-colors ${
              selected === i ? 'bg-emerald-500/[0.08] text-emerald-300' : 'text-neutral-500 hover:bg-white/[0.025]'
            }`}
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">{s.label}</span>
            <span className={`mt-0.5 font-bricolage text-sm font-bold tabular-nums ${selected === i ? 'text-emerald-300' : 'text-neutral-400'}`}>{s.count}</span>
          </button>
        ))}
      </div>

      <AnimatePresence initial={false}>
        {selectedData && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-6 border-t border-white/[0.06] pt-5">
              {selectedData.items.length > 0 ? (() => {
                const docItems = selectedData.items.filter(c => !isSmartContract(c));
                const smartItems = selectedData.items.filter(c => isSmartContract(c));
                return (
                  <div className="space-y-2.5">
                    {/* Documentos Contratuais */}
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] overflow-hidden">
                      <button
                        onClick={() => setDocsOpen(o => !o)}
                        className="flex w-full items-center gap-2.5 px-4 py-3 text-left hover:bg-white/[0.025] transition-colors"
                      >
                        <iconify-icon icon="solar:document-text-linear" class="text-neutral-400 shrink-0" />
                        <span className="flex-1 text-sm font-semibold text-neutral-200">Documentos Contratuais</span>
                        <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-neutral-300">{docItems.length}</span>
                        <iconify-icon
                          icon="solar:alt-arrow-down-linear"
                          class={`text-sm text-neutral-500 transition-transform ${docsOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                      <AnimatePresence initial={false}>
                        {docsOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="space-y-1.5 px-3 pb-3">
                              {docItems.length > 0 ? docItems.map(c => (
                                <ContractListItem key={c.id} contract={c} />
                              )) : (
                                <p className="py-2 text-[11px] text-app-text-subtle">Nenhum documento neste mês.</p>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Contratos Inteligentes */}
                    <div className="rounded-2xl border border-emerald-400/[0.12] bg-emerald-500/[0.025] overflow-hidden">
                      <button
                        onClick={() => setSmartOpen(o => !o)}
                        className="flex w-full items-center gap-2.5 px-4 py-3 text-left hover:bg-white/[0.025] transition-colors"
                      >
                        <iconify-icon icon="solar:cpu-bolt-linear" class="text-emerald-300 shrink-0" />
                        <span className="flex-1 text-sm font-semibold text-emerald-100/90">Contratos Inteligentes</span>
                        <span className="rounded-full bg-emerald-500/[0.12] px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-emerald-300">{smartItems.length}</span>
                        <iconify-icon
                          icon="solar:alt-arrow-down-linear"
                          class={`text-sm text-emerald-400/70 transition-transform ${smartOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                      <AnimatePresence initial={false}>
                        {smartOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="space-y-1.5 px-3 pb-3">
                              {smartItems.length > 0 ? smartItems.map(c => (
                                <ContractListItem key={c.id} contract={c} />
                              )) : (
                                <p className="py-2 text-[11px] text-app-text-subtle">Nenhum contrato inteligente neste mês.</p>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                );
              })() : (
                <p className="text-xs text-app-text-subtle">Nenhum contrato criado neste mês.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ContractListItem({ contract }: { contract: Contract }) {
  const isSmart = isSmartContract(contract);
  const parties = contract.parties || [];
  const total = parties.length;
  const signed = parties.filter((p) => p.signedAt).length;
  const isAnchored = Boolean(contract.stellarTxHash);
  const now = Date.now();
  const expiresAtMs = contract.expiresAt ? new Date(contract.expiresAt).getTime() : null;
  const isPastDue =
    expiresAtMs !== null
    && !Number.isNaN(expiresAtMs)
    && expiresAtMs < now
    && contract.status !== 'completed'
    && contract.status !== 'cancelled'
    && contract.status !== 'archived';

  // Status efetivo (substitui pelo "Em atraso" / "Expirado" quando vencido)
  const statusInfo: { label: string; color: string; icon: string } = (() => {
    if (isPastDue) {
      return isSmart
        ? { label: 'Em atraso', color: 'bg-rose-500/[0.10] text-rose-300', icon: 'solar:danger-triangle-linear' }
        : { label: 'Expirado', color: 'bg-rose-500/[0.10] text-rose-300', icon: 'solar:clock-circle-linear' };
    }
    switch (contract.status) {
      case 'active':
        return { label: isSmart ? 'Em execução' : 'Ativo', color: 'bg-emerald-500/[0.10] text-emerald-300', icon: 'solar:play-circle-linear' };
      case 'pending':
        return { label: 'Pendente de assinatura', color: 'bg-amber-500/[0.08] text-amber-200', icon: 'solar:hourglass-linear' };
      case 'completed':
        return { label: 'Concluído', color: 'bg-indigo-500/[0.08] text-indigo-300', icon: 'solar:check-circle-linear' };
      case 'draft':
        return { label: 'Rascunho', color: 'bg-white/[0.04] text-neutral-400', icon: 'solar:pen-new-square-linear' };
      case 'cancelled':
        return { label: 'Cancelado', color: 'bg-rose-500/[0.08] text-rose-300', icon: 'solar:close-circle-linear' };
      case 'archived':
        return { label: 'Arquivado', color: 'bg-white/[0.03] text-neutral-500', icon: 'solar:archive-linear' };
      default:
        return { label: String(contract.status), color: 'bg-white/[0.04] text-neutral-400', icon: 'solar:document-linear' };
    }
  })();

  // Linha de detalhes contextuais
  const details: string[] = [];
  if (total > 0) {
    if (contract.status === 'pending' && signed < total) {
      details.push(`aguardando ${total - signed} de ${total} assinatura${total - signed !== 1 ? 's' : ''}`);
    } else {
      details.push(`${signed}/${total} assinado${total !== 1 ? 's' : ''}`);
    }
  }
  if (isAnchored) details.push('ancorado on-chain');
  if (expiresAtMs !== null && !Number.isNaN(expiresAtMs)) {
    const diffDays = Math.floor((expiresAtMs - now) / (24 * 60 * 60 * 1000));
    if (isPastDue) {
      const overdueDays = Math.floor((now - expiresAtMs) / (24 * 60 * 60 * 1000));
      details.push(overdueDays > 0 ? `vencido há ${overdueDays}d` : 'vencido hoje');
    } else if (diffDays >= 0 && diffDays <= 14) {
      details.push(diffDays === 0 ? 'vence hoje' : `vence em ${diffDays}d`);
    } else {
      const fmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
      details.push(`vence ${fmt.format(new Date(contract.expiresAt))}`);
    }
  }

  return (
    <Link
      to={`/contracts/${contract.id}`}
      className={`block rounded-xl border bg-white/[0.02] px-3 py-2.5 transition-colors hover:bg-white/[0.05] ${
        isPastDue ? 'border-rose-400/30 hover:bg-rose-500/[0.06]' : 'border-app-border'
      }`}
    >
      {/* Linha 1: tipo + status + seta */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              isSmart
                ? 'bg-emerald-500/[0.10] text-emerald-300'
                : 'bg-white/[0.06] text-neutral-300'
            }`}
          >
            <iconify-icon icon={isSmart ? 'solar:cpu-bolt-linear' : 'solar:document-text-linear'} class="text-xs" />
            {isSmart ? 'Inteligente' : 'Documento'}
          </span>
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusInfo.color}`}>
            <iconify-icon icon={statusInfo.icon} class="text-xs" />
            {statusInfo.label}
          </span>
        </div>
        <iconify-icon icon="solar:arrow-right-up-linear" class="shrink-0 text-app-text-subtle" />
      </div>

      {/* Linha 2: titulo */}
      <p className="mt-1.5 truncate text-sm font-semibold text-app-text">{contract.title || 'Sem título'}</p>

      {/* Linha 3: detalhes (assinaturas + ancoragem + expiração / atraso) */}
      {details.length > 0 && (
        <p className={`mt-1 truncate text-[11px] ${isPastDue ? 'text-rose-300' : 'text-app-text-muted'}`}>
          {details.join(' · ')}
        </p>
      )}
    </Link>
  );
}

export default function DashboardPage() {
  const { data: contracts = [], isLoading, error: contractsError } = useContracts();
  const { data: opportunityFeed = [] } = useOpportunityFeed({ limit: 3, status: 'open' });
  if (contractsError) console.error('[Dashboard] contracts query failed:', contractsError);
  const { user, organization } = useAuthStore();
  const notify = useNotificationStore(s => s.add);
  const [isEditing, setIsEditing] = useState(false);
  const [pendingSignatures, setPendingSignatures] = useState<any[]>([]);
  const [identitySettings, setIdentitySettings] = useState<Record<string, any>>({});
  const [profileExtra, setProfileExtra] = useState<{
    coverUrl?: string | null; bio?: string | null;
    linkedin?: string | null; instagram?: string | null; twitter?: string | null; github?: string | null; website?: string | null;
  }>({});

  useEffect(() => {
    if (!user?.email) return;
    signingService.getPendingForUser(user.email).then(setPendingSignatures);
  }, [user?.email]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      // Tenta com instagram_url; se a coluna ainda não existe, refaz sem ela.
      const withIg = 'cover_url, bio, linkedin_url, instagram_url, twitter_url, github_url, website';
      const noIg = 'cover_url, bio, linkedin_url, twitter_url, github_url, website';
      let res = await supabase.from('profiles').select(withIg).eq('id', user.id).maybeSingle();
      if (res.error) res = await supabase.from('profiles').select(noIg).eq('id', user.id).maybeSingle();
      if (cancelled || res.error || !res.data) return;
      const d = res.data as Record<string, any>;
      setProfileExtra({
        coverUrl: d.cover_url ?? null,
        bio: d.bio ?? null,
        linkedin: d.linkedin_url ?? null,
        instagram: d.instagram_url ?? null,
        twitter: d.twitter_url ?? null,
        github: d.github_url ?? null,
        website: d.website ?? null,
      });
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    api.settings.get()
      .then((settings) => {
        if (!cancelled) setIdentitySettings(settings || {});
      })
      .catch(() => {
        if (!cancelled) setIdentitySettings({});
      });
    return () => { cancelled = true; };
  }, []);
  const [visibleWidgets, setVisibleWidgets] = useState(() => {
    const saved = localStorage.getItem('dashboard_widgets');
    return saved ? JSON.parse(saved) : DEFAULT_WIDGETS;
  });


  const toggleWidget = (id: keyof typeof DEFAULT_WIDGETS) => {
    const next = { ...visibleWidgets, [id]: !visibleWidgets[id] };
    setVisibleWidgets(next);
    localStorage.setItem('dashboard_widgets', JSON.stringify(next));
  };

  const active = contracts.filter((c) => c.status === 'active').length;
  const pending = contracts.filter((c) => c.status === 'pending').length;
  const draft = contracts.filter((c) => c.status === 'draft').length;
  const completed = contracts.filter((c) => c.status === 'completed').length;
  const anchored = contracts.filter((c) => c.stellarTxHash).length;
  const totalSignatures = contracts.reduce((sum, c) => sum + c.parties.filter(p => p.signedAt).length, 0);
  const smartContracts = contracts.filter(isSmartContract);
  const smartActive = smartContracts.filter((c) => c.status === 'active').length;
  const smartPending = smartContracts.filter((c) => c.status === 'pending').length;
  const smartDraft = smartContracts.filter((c) => c.status === 'draft').length;
  const smartAnchored = smartContracts.filter((c) => c.stellarTxHash).length;

  const handleCopyIdentity = async () => {
    if (!user?.handle) {
      notify({ type: 'info', title: 'Handle indisponível', message: 'Seu @usuário ainda não está configurado no perfil.' });
      return;
    }

    try {
      await navigator.clipboard.writeText(`@${user.handle}`);
      notify({ type: 'success', title: 'Identidade copiada', message: `@${user.handle} copiado para a área de transferência.` });
    } catch {
      notify({ type: 'warning', title: 'Não foi possível copiar', message: 'Tente novamente em alguns segundos.' });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <motion.div className="h-8 w-48 bg-white/10 rounded-lg" animate={{ opacity: [0.5, 0.8, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }} />
            <motion.div className="h-4 w-32 bg-white/5 rounded-lg" animate={{ opacity: [0.5, 0.8, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }} />
          </div>
          <motion.div className="h-10 w-32 bg-white/10 rounded-lg" animate={{ opacity: [0.5, 0.8, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }} />
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className="h-32 bg-neutral-900 border border-white/5 rounded-2xl"
              animate={{ opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
            />
          ))}
        </div>

        {/* Blockchain section skeleton */}
        <motion.div
          className="h-48 bg-neutral-900 border border-white/5 rounded-2xl"
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />

        {/* Content sections skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div
            className="lg:col-span-2 h-64 bg-neutral-900 border border-white/5 rounded-2xl"
            animate={{ opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <motion.div
            className="h-64 bg-neutral-900 border border-white/5 rounded-2xl"
            animate={{ opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Dashboard</p>
          <h1 className="mt-1 font-bricolage text-4xl font-bold text-white">Olá, {user?.name?.split(' ')[0] ?? 'usuário'}.</h1>
          <p className="mt-2 text-sm text-neutral-500">Sua leitura operacional de contratos, smart contracts e ancoragens.</p>
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className={`px-3.5 py-2 rounded-xl border transition-colors flex items-center gap-2 text-xs font-semibold ${
            isEditing
              ? 'border-emerald-400/40 bg-emerald-500/[0.10] text-emerald-300'
              : 'border-white/[0.06] bg-white/[0.02] text-neutral-400 hover:bg-white/[0.05] hover:text-white'
          }`}
        >
          <iconify-icon icon={isEditing ? 'solar:check-read-linear' : 'solar:widget-add-linear'} />
          {isEditing ? 'Salvar layout' : 'Customizar painel'}
        </button>
      </div>

      {user && (
        <ProfileStrip
          user={user}
          organizationName={organization?.name}
          jobTitle={identitySettings.jobTitle}
          bio={profileExtra.bio}
          coverUrl={profileExtra.coverUrl}
          socials={{
            linkedin: profileExtra.linkedin,
            instagram: profileExtra.instagram,
            twitter: profileExtra.twitter,
            github: profileExtra.github,
            website: profileExtra.website,
          }}
          onCopyHandle={handleCopyIdentity}
        />
      )}

      <AnimatePresence>
        {isEditing && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-8"
          >
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 flex flex-wrap gap-3 items-center">
              <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-[0.22em] mr-2">Widgets disponíveis</p>
              {Object.keys(DEFAULT_WIDGETS).map((id) => (
                <button
                  key={id}
                  onClick={() => toggleWidget(id as any)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-2 ${
                    visibleWidgets[id as keyof typeof DEFAULT_WIDGETS]
                      ? 'border-emerald-400/30 bg-emerald-500/[0.08] text-emerald-300'
                      : 'border-white/[0.05] bg-white/[0.01] text-neutral-500 opacity-60 hover:opacity-100'
                  }`}
                >
                  <iconify-icon icon={
                    id === 'stats' ? 'solar:chart-2-linear' :
                    id === 'blockchain' ? 'solar:shield-check-linear' :
                    id === 'expirations' ? 'solar:calendar-linear' : 'solar:list-linear'
                  } />
                  {id.charAt(0).toUpperCase() + id.slice(1)}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats & AI Insight */}
      {visibleWidgets.stats && (
        <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 transition-all ${isEditing ? 'opacity-50 scale-[0.98]' : ''}`}>
          <StatCard title="Total" value={contracts.length.toString()} icon="solar:document-text-linear" color="text-neutral-300" bg="bg-white/[0.04]" to="/contracts" subtext="todos os documentos" delay={0} />
          <StatCard title="Ativos" value={active.toString()} icon="solar:check-circle-linear" color="text-emerald-300" bg="bg-emerald-500/10" to="/contracts?status=active" subtext="em vigência" delay={0.04} />
          <StatCard title="Rascunhos" value={draft.toString()} icon="solar:pen-new-round-linear" color="text-neutral-400" bg="bg-white/[0.04]" to="/contracts?status=draft" subtext="aguardando revisão" delay={0.08} />
          <StatCard title="Assinatura Pendente" value={pending.toString()} icon="solar:hourglass-linear" color="text-amber-200" bg="bg-amber-500/[0.08]" to="/contracts?status=pending" subtext="aguardando partes" delay={0.12} />
          <StatCard title="Concluídos" value={completed.toString()} icon="solar:diploma-verified-linear" color="text-indigo-300" bg="bg-indigo-500/[0.08]" to="/contracts?status=completed" subtext="todos assinaram" delay={0.16} />
        </div>
      )}

      {visibleWidgets.stats && (
        <div className={`transition-all ${isEditing ? 'opacity-50 scale-[0.98]' : ''}`}>
          <ContractsTrendChart contracts={contracts} />
        </div>
      )}

      {smartContracts.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16, duration: 0.4 }} className={`rounded-3xl border border-white/[0.06] bg-white/[0.018] p-7 ${isEditing ? 'opacity-50 scale-[0.98]' : ''}`}>
          <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Smart Contracts</p>
              <h3 className="mt-1 font-bricolage text-2xl font-bold text-white">Contratos Inteligentes</h3>
              <p className="mt-1 text-xs text-neutral-500 max-w-md">Fluxos programáveis: execução, pendências, rascunhos e provas ancoradas na rede.</p>
            </div>
            <Link to="/contracts" className="text-xs text-emerald-300 hover:text-emerald-200 transition-colors">Abrir documentos →</Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: 'Total', value: smartContracts.length, tone: 'text-white', subtext: 'contratos inteligentes' },
              { label: 'Ativos', value: smartActive, tone: 'text-emerald-300', subtext: 'em execução' },
              { label: 'Pendentes', value: smartPending, tone: 'text-amber-200', subtext: 'pendente de ciência' },
              { label: 'Rascunhos', value: smartDraft, tone: 'text-neutral-300', subtext: 'ainda não publicados' },
              { label: 'Ancorados', value: smartAnchored, tone: 'text-indigo-300', subtext: 'com hash na Stellar' },
            ].map(card => (
              <div key={card.label} className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">{card.label}</p>
                <p className={`mt-2 font-bricolage text-[2rem] font-bold leading-none tabular-nums ${card.tone}`}>{card.value}</p>
                <p className="mt-2 text-[11px] text-neutral-500">{card.subtext}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {opportunityFeed.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className={`rounded-2xl border border-emerald-400/12 bg-neutral-900/80 p-6 ${isEditing ? 'opacity-50 scale-[0.98]' : ''}`}>
          <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
            <div>
              <h3 className="text-lg font-bold text-white font-bricolage flex items-center gap-2">
                <iconify-icon icon="solar:bolt-circle-bold-duotone" class="text-emerald-400 text-xl" /> Feed de oportunidades
              </h3>
              <p className="text-xs text-neutral-400 mt-1">Demandas e disponibilidades profissionais que já viram smart contract no próximo clique.</p>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/opportunities" className="text-xs text-emerald-400 hover:underline">Abrir feed completo</Link>
              <Link to="/opportunities" className="inline-flex items-center gap-2 rounded-full border border-emerald-400/18 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/14 transition-colors">
                <iconify-icon icon="solar:add-circle-bold-duotone" class="text-sm" />
                Publicar
              </Link>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            {opportunityFeed.map((opportunity) => (
              <OpportunityPreviewCard key={opportunity.id} opportunity={opportunity} />
            ))}
          </div>
        </motion.div>
      )}

      {/* Blockchain Stats */}
      {visibleWidgets.blockchain && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }} className={`rounded-3xl border border-white/[0.06] bg-white/[0.018] p-7 ${isEditing ? 'opacity-50 scale-[0.98]' : ''}`}>
          <div className="flex items-start gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/[0.08]">
              <iconify-icon icon="solar:shield-network-linear" class="text-xl text-emerald-300" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Blockchain</p>
              <h3 className="mt-0.5 font-bricolage text-xl font-bold text-white">Stellar · Testnet</h3>
              <p className="text-xs text-neutral-500">Proof of Existence on-chain</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Ancorados</p>
              <p className="mt-2 font-bricolage text-[2rem] font-bold leading-none tabular-nums text-emerald-300">{anchored}</p>
              <p className="mt-2 text-[11px] text-neutral-500">documentos on-chain</p>
            </div>
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Assinaturas</p>
              <p className="mt-2 font-bricolage text-[2rem] font-bold leading-none tabular-nums text-white">{totalSignatures}</p>
              <p className="mt-2 text-[11px] text-neutral-500">coletadas</p>
            </div>
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Taxa</p>
              <p className="mt-2 font-bricolage text-[2rem] font-bold leading-none tabular-nums text-white">
                {contracts.length > 0 ? Math.round((anchored / contracts.length) * 100) : 0}<span className="text-base text-neutral-500">%</span>
              </p>
              <p className="mt-2 text-[11px] text-neutral-500">de ancoragem</p>
            </div>
            <div className="rounded-2xl border border-emerald-400/[0.10] bg-emerald-500/[0.02] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Rede</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <p className="text-sm font-semibold text-emerald-300">Testnet ativa</p>
              </div>
              <p className="mt-2 text-[11px] text-neutral-500">latência baixa</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Pending signatures for current user */}
      {pendingSignatures.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-emerald-400/[0.12] bg-emerald-500/[0.025] p-7">
          <div className="flex items-start gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/[0.10]">
              <iconify-icon icon="solar:pen-linear" class="text-xl text-emerald-300" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Aguardando você</p>
              <h3 className="mt-0.5 font-bricolage text-xl font-bold text-white">Pendentes de assinatura</h3>
              <p className="text-xs text-neutral-500">{pendingSignatures.length} documento(s) aguardam sua assinatura eletrônica.</p>
            </div>
          </div>
          <div className="space-y-2">
            {pendingSignatures.map((party: any) => (
              <Link
                key={party.id}
                to={`/contracts/${party.contract_id}`}
                className="flex items-center justify-between p-3.5 bg-white/[0.02] border border-white/[0.05] rounded-2xl hover:border-emerald-400/30 hover:bg-white/[0.04] transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/[0.10] flex items-center justify-center">
                    <iconify-icon icon="solar:document-text-linear" class="text-emerald-300 text-base" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm text-white font-medium group-hover:text-emerald-400 transition-colors">
                        {(party.contracts as any)?.title ?? 'Documento'}
                      </p>
                      {isSmartContract((party.contracts as any) ?? undefined) && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/[0.10] text-emerald-300 text-[10px] font-bold uppercase tracking-wide">
                          Smart
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 capitalize">{party.role}</p>
                  </div>
                </div>
                <span className="text-xs text-emerald-400 font-bold flex items-center gap-1 group-hover:gap-2 transition-all">
                  Assinar <iconify-icon icon="solar:arrow-right-bold" />
                </span>
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent contracts */}
        {visibleWidgets.activity && (
          <div className={`rounded-3xl border border-white/[0.06] bg-white/[0.018] p-7 lg:col-span-2 ${isEditing ? 'opacity-50 scale-[0.98]' : ''}`}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Atividade</p>
                <h3 className="mt-0.5 font-bricolage text-xl font-bold text-white">Documentos recentes</h3>
              </div>
              <Link to="/contracts" className="text-xs text-emerald-300 hover:text-emerald-200 transition-colors">Ver todos →</Link>
            </div>
            {contracts.length === 0 ? (
              <p className="text-neutral-500 text-sm">Nenhum documento encontrado.</p>
            ) : (
              <div>
                {contracts.slice(0, 5).map((c) => (
                  <RecentRow key={c.id} contract={c} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Next Expirations Widget */}
        {visibleWidgets.expirations && (
          <div className={`rounded-3xl border border-white/[0.06] bg-white/[0.018] p-7 ${isEditing ? 'opacity-50 scale-[0.98]' : ''}`}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Próximos 30 dias</p>
                <h3 className="mt-0.5 font-bricolage text-xl font-bold text-white">Vencimentos</h3>
              </div>
              <iconify-icon icon="solar:alarm-linear" class="text-amber-200/70 text-lg" />
            </div>
            <div className="space-y-2.5">
              {contracts.filter(c => c.status === 'active').slice(0, 3).map(c => (
                <div key={c.id} className="p-3 bg-white/[0.02] border border-white/[0.05] rounded-2xl flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-semibold text-white truncate max-w-[140px]">{c.title}</p>
                      {isSmartContract(c) && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/[0.10] text-emerald-300 text-[9px] font-bold uppercase tracking-wide">
                          Smart
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-500 mt-1">{new Date(c.expiresAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</p>
                  </div>
                  <span className="text-[10px] text-amber-200 font-semibold bg-amber-500/[0.08] px-2.5 py-1 rounded-full uppercase tracking-wide">Em breve</span>
                </div>
              ))}
              {contracts.filter(c => c.status === 'active').length === 0 && (
                <p className="text-center text-neutral-500 py-10 text-sm">Nenhum vencimento próximo.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OpportunityPreviewCard({ opportunity }: { opportunity: SmartContractOpportunity }) {
  return (
    <Link
      to="/smart-contracts"
      state={{ marketplaceOpportunity: opportunity, autoSelectTemplateId: opportunity.templateId }}
      className="rounded-2xl border border-white/8 bg-black/25 p-4 transition hover:border-emerald-400/20 hover:bg-black/35"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
            {opportunity.opportunityType === 'request' ? 'Quero contratar' : 'Disponível'}
          </p>
          <h4 className="mt-2 text-sm font-semibold text-white leading-6">{opportunity.title}</h4>
        </div>
        <span className="rounded-full border border-emerald-400/18 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-300">
          {formatOpportunityReward(opportunity)}
        </span>
      </div>

      <p className="mt-3 text-xs leading-6 text-neutral-400 line-clamp-3">{opportunity.summary}</p>

      <div className="mt-4 flex items-center justify-between gap-2 text-[11px] text-neutral-500">
        <span>{opportunity.serviceCategory}</span>
        <span>@{opportunity.ownerHandle}</span>
      </div>
    </Link>
  );
}

function ProfileStrip({
  user,
  organizationName,
  jobTitle,
  bio,
  coverUrl,
  socials,
  onCopyHandle,
}: {
  user: NonNullable<ReturnType<typeof useAuthStore.getState>['user']>;
  organizationName?: string;
  jobTitle?: string;
  bio?: string | null;
  coverUrl?: string | null;
  socials?: { linkedin?: string | null; instagram?: string | null; twitter?: string | null; github?: string | null; website?: string | null };
  onCopyHandle: () => void;
}) {
  const initials = user.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'CE';

  const socialLinks = [
    { url: socials?.linkedin, icon: 'mdi:linkedin', label: 'LinkedIn', color: 'hover:text-[#0a66c2]' },
    { url: socials?.instagram, icon: 'mdi:instagram', label: 'Instagram', color: 'hover:text-[#e1306c]' },
    { url: socials?.twitter, icon: 'mdi:twitter', label: 'X', color: 'hover:text-sky-400' },
    { url: socials?.github, icon: 'mdi:github', label: 'GitHub', color: 'hover:text-app-text' },
    { url: socials?.website, icon: 'solar:global-bold', label: 'Site', color: 'hover:text-violet-300' },
  ].filter((s) => s.url);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-app-border bg-neutral-900/70"
    >
      {/* Capa */}
      <div className="relative mx-auto mt-4 h-32 w-full max-w-5xl overflow-hidden rounded-2xl border border-white/8 sm:h-40">
        {coverUrl ? (
          <img src={coverUrl} alt="Capa do perfil" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(124,58,237,0.35),rgba(168,85,247,0.18),rgba(34,211,238,0.16))]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-neutral-900/40 to-transparent" />
      </div>

      <div className="relative mx-auto -mt-10 max-w-5xl px-4 pb-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-end gap-3">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-neutral-900 bg-gradient-to-br from-violet-500/30 to-cyan-500/20 text-xl font-bold text-white shadow-lg">
              {user.avatar
                ? <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
                : initials}
            </div>
            <div className="min-w-0 pb-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bricolage text-base font-bold text-app-text">{user.name}</h2>
                <span className="rounded-full border border-app-border bg-white/[0.03] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-app-text-muted">{user.plan || 'free'}</span>
                {user.walletAddress && (
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">Carteira ativa</span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-app-text-muted">
                <span className="text-violet-300">{user.handle ? `@${user.handle}` : user.email}</span>
                <span>·</span>
                <span>{organizationName || 'Espaço Pessoal'}</span>
                {jobTitle && (<><span>·</span><span>{jobTitle}</span></>)}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onCopyHandle}
              className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-200 transition-colors hover:bg-violet-500/15"
            >
              <iconify-icon icon="solar:copy-bold" class="text-sm" />
              Copiar identidade
            </button>
            <Link
              to="/settings"
              className="inline-flex items-center gap-2 rounded-full border border-app-border bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-app-text-muted transition-colors hover:text-app-text"
            >
              <iconify-icon icon="solar:pen-2-bold" class="text-sm" />
              Editar perfil
            </Link>
          </div>
        </div>

        {bio && <p className="mt-3 max-w-2xl text-sm leading-6 text-app-text-muted">{bio}</p>}

        {socialLinks.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {socialLinks.map((s) => (
              <a
                key={s.label}
                href={s.url!}
                target="_blank"
                rel="noopener noreferrer"
                title={s.label}
                className={`flex h-8 w-8 items-center justify-center rounded-xl border border-app-border bg-white/[0.03] text-app-text-muted transition-colors hover:bg-white/[0.06] ${s.color}`}
              >
                <iconify-icon icon={s.icon} class="text-base" />
              </a>
            ))}
          </div>
        )}
      </div>
    </motion.section>
  );
}
