/**
 * Painel — a leitura dos números, em página própria.
 *
 * O painel antigo empilhava perfil, customizador de widgets, cinco cartões,
 * o gráfico, um bloco de smart contracts, o feed e mais dois blocos de
 * blockchain na mesma tela. Aqui ficam só as três camadas que respondem
 * "como está minha operação": números, evolução no tempo e o que precisa de
 * atenção. O painel completo continua acessível em "Mais".
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useContracts } from '@/hooks/useContractQueries';
import ContractsTrendChart, { isSmartContract } from '@/components/dashboard/ContractsTrendChart';
import type { Contract } from '@/types';

export default function PainelPage() {
  const { data: contracts = [], isLoading } = useContracts();

  const stats = useMemo(() => {
    const list = contracts as Contract[];
    const now = Date.now();
    const isOverdue = (c: Contract) => {
      const at = c.expiresAt ? new Date(c.expiresAt).getTime() : NaN;
      return (
        !Number.isNaN(at) &&
        at < now &&
        !['completed', 'cancelled', 'archived'].includes(c.status)
      );
    };
    return {
      total: list.length,
      active: list.filter((c) => c.status === 'active').length,
      pending: list.filter((c) => c.status === 'pending').length,
      completed: list.filter((c) => c.status === 'completed').length,
      anchored: list.filter((c) => Boolean(c.stellarTxHash)).length,
      smart: list.filter(isSmartContract).length,
      overdue: list.filter(isOverdue),
      awaiting: list.filter((c) => c.status === 'pending').slice(0, 5),
    };
  }, [contracts]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-white/10" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-2xl bg-white/[0.03]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      <header className="space-y-1.5">
        <h1 className="font-bricolage text-2xl font-bold text-white sm:text-3xl">Painel</h1>
        <p className="text-sm text-neutral-400">
          {stats.total === 0
            ? 'Assim que você criar contratos, os números aparecem aqui.'
            : `${stats.total} ${stats.total === 1 ? 'contrato' : 'contratos'} · ${stats.anchored} com prova na blockchain`}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Total" value={stats.total} to="/contracts" />
        <Tile label="Ativos" value={stats.active} to="/contracts?status=active" tone="text-emerald-300" />
        <Tile
          label="Aguardando assinatura"
          value={stats.pending}
          to="/contracts?status=pending"
          tone={stats.pending > 0 ? 'text-amber-200' : undefined}
        />
        <Tile label="Concluídos" value={stats.completed} to="/contracts?status=completed" tone="text-indigo-300" />
      </section>

      <ContractsTrendChart contracts={contracts as Contract[]} />

      {/* Só aparece quando existe algo realmente a fazer. */}
      {stats.overdue.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-amber-400/20 bg-amber-500/[0.05] p-5"
        >
          <h2 className="text-sm font-semibold text-amber-200">
            {stats.overdue.length} {stats.overdue.length === 1 ? 'contrato passou' : 'contratos passaram'} do prazo
          </h2>
          <div className="mt-3 space-y-1">
            {stats.overdue.slice(0, 5).map((c) => (
              <Link
                key={c.id}
                to={`/contracts/${c.id}`}
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.04]"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-neutral-200">{c.title}</span>
                <span className="shrink-0 text-xs text-amber-200/80">
                  venceu em {new Date(c.expiresAt).toLocaleDateString('pt-BR')}
                </span>
              </Link>
            ))}
          </div>
        </motion.section>
      )}

      {stats.awaiting.length > 0 && (
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.018] p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Aguardando assinatura</h2>
            <Link to="/contracts?status=pending" className="text-xs text-neutral-500 transition-colors hover:text-white">
              Ver todos
            </Link>
          </div>
          <div className="space-y-1">
            {stats.awaiting.map((c) => {
              const parties = c.parties ?? [];
              const signed = parties.filter((p) => p.signedAt).length;
              return (
                <Link
                  key={c.id}
                  to={`/contracts/${c.id}`}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.04]"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-neutral-200">{c.title}</span>
                  <span className="shrink-0 text-xs tabular-nums text-neutral-500">
                    {signed} de {parties.length} assinaram
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {stats.total === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
          <p className="text-sm text-neutral-400">Nenhum contrato ainda.</p>
          <Link
            to="/criar"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-black transition-colors hover:bg-emerald-400"
          >
            Criar o primeiro
          </Link>
        </div>
      )}

      <p className="text-center text-xs text-neutral-600">
        Precisa de mais recortes?{' '}
        <Link to="/painel/completo" className="underline decoration-white/20 underline-offset-4 hover:text-neutral-400">
          Abrir painel completo
        </Link>
      </p>
    </div>
  );
}

function Tile({ label, value, to, tone }: { label: string; value: number; to: string; tone?: string }) {
  return (
    <Link
      to={to}
      className="rounded-2xl border border-white/[0.06] bg-white/[0.018] p-4 transition-colors hover:border-emerald-400/25 hover:bg-white/[0.035]"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">{label}</p>
      <p className={`mt-2 font-bricolage text-3xl font-bold leading-none tabular-nums ${tone ?? 'text-white'}`}>
        {value}
      </p>
    </Link>
  );
}
