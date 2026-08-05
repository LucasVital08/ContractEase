/**
 * Contratos por mês — o gráfico que abre o painel.
 *
 * Extraído do DashboardPage para poder ser reusado pelo painel enxuto sem
 * duplicar código. Comportamento preservado: curva suave dos últimos 6 meses,
 * clique num mês abre a lista daquele mês separada entre documentos e
 * contratos inteligentes.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import type { Contract } from '@/types';

export function isSmartContract(contract: Pick<Contract, 'tags'> | null | undefined) {
  return Boolean(contract?.tags?.includes('smart-contract'));
}

/** Curva Catmull-Rom convertida em Bézier — evita os bicos de uma polilinha. */
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

export default function ContractsTrendChart({ contracts }: { contracts: Contract[] }) {
  const [selected, setSelected] = useState<number | null>(null);

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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl border border-white/[0.06] bg-white/[0.018] p-6"
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-bricolage text-xl font-bold text-white">Contratos por mês</h2>
          <p className="mt-1 text-xs text-neutral-500">Últimos 6 meses · clique num mês para ver a lista</p>
        </div>
        {selectedData && (
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
              {selectedData.fullLabel}
            </p>
            <p className="font-bricolage text-3xl font-bold tabular-nums text-emerald-300">{selectedData.count}</p>
          </div>
        )}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 'auto' }} role="img" aria-label="Contratos por mês">
        <defs>
          <linearGradient id="trendAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line
          x1={PX}
          x2={W - PX}
          y1={PT + innerH / 2}
          y2={PT + innerH / 2}
          stroke="rgba(255,255,255,0.04)"
          strokeDasharray="2 4"
        />
        {areaPath && <path d={areaPath} fill="url(#trendAreaGrad)" />}
        {linePath && (
          <path d={linePath} fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {points.map((p, i) => (
          <g key={i}>
            {selected === i && (
              <line
                x1={p.x}
                x2={p.x}
                y1={PT}
                y2={PT + innerH}
                stroke="#34d399"
                strokeOpacity="0.35"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
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
            <span
              className={`mt-0.5 font-bricolage text-sm font-bold tabular-nums ${selected === i ? 'text-emerald-300' : 'text-neutral-400'}`}
            >
              {s.count}
            </span>
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
            <div className="mt-5 space-y-2.5 border-t border-white/[0.06] pt-5">
              {selectedData.items.length === 0 ? (
                <p className="text-xs text-neutral-500">Nenhum contrato criado neste mês.</p>
              ) : (
                <>
                  <MonthGroup
                    icon="solar:document-text-linear"
                    title="Documentos"
                    items={selectedData.items.filter((c) => !isSmartContract(c))}
                  />
                  <MonthGroup
                    icon="solar:cpu-bolt-linear"
                    title="Contratos inteligentes"
                    accent
                    items={selectedData.items.filter((c) => isSmartContract(c))}
                  />
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function MonthGroup({
  icon,
  title,
  items,
  accent,
}: {
  icon: string;
  title: string;
  items: Contract[];
  accent?: boolean;
}) {
  const [open, setOpen] = useState(true);
  if (items.length === 0) return null;

  return (
    <div
      className={`overflow-hidden rounded-2xl border ${accent ? 'border-emerald-400/[0.12] bg-emerald-500/[0.025]' : 'border-white/[0.06] bg-white/[0.015]'}`}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-white/[0.025]"
      >
        <iconify-icon icon={icon} class={`shrink-0 ${accent ? 'text-emerald-300' : 'text-neutral-400'}`} />
        <span className={`flex-1 text-sm font-semibold ${accent ? 'text-emerald-100/90' : 'text-neutral-200'}`}>
          {title}
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums ${accent ? 'bg-emerald-500/[0.12] text-emerald-300' : 'bg-white/[0.06] text-neutral-300'}`}
        >
          {items.length}
        </span>
        <iconify-icon
          icon="solar:alt-arrow-down-linear"
          class={`text-sm text-neutral-500 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-1 px-3 pb-3">
              {items.map((contract) => (
                <Link
                  key={contract.id}
                  to={`/contracts/${contract.id}`}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.04]"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-neutral-200">{contract.title}</span>
                  {contract.stellarTxHash && (
                    <iconify-icon
                      icon="solar:shield-check-linear"
                      class="shrink-0 text-sm text-emerald-400/70"
                      title="Registrado na blockchain"
                    />
                  )}
                  <span className="shrink-0 text-[11px] text-neutral-500">
                    {(contract.parties ?? []).filter((p) => p.signedAt).length}/{(contract.parties ?? []).length}
                  </span>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
