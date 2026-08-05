/**
 * Início — a primeira tela depois do login.
 *
 * Objetivo único: deixar óbvio qual é o próximo passo. Nada de painel com doze
 * indicadores que o usuário comum não sabe ler. Se ainda falta configurar algo,
 * a tela mostra isso e mais nada. Quando está tudo pronto, ela vira um atalho
 * para as duas ações que importam.
 */

import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuthStore, useWalletStore } from '@/stores';
import { useContracts } from '@/hooks/useContractQueries';
import { shortenAddress } from '@/services/wallet';

export default function StartPage() {
  const user = useAuthStore((s) => s.user);
  const wallet = useWalletStore();
  const { data: contracts } = useContracts();

  useEffect(() => {
    void wallet.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = useMemo(() => (Array.isArray(contracts) ? contracts : []), [contracts]);

  const checklist = [
    {
      id: 'account',
      label: 'Criar sua conta',
      detail: 'Feito quando você entrou.',
      done: Boolean(user),
      to: '/settings',
      cta: 'Ver perfil',
    },
    {
      id: 'wallet',
      label: 'Conectar uma carteira',
      detail: 'É o que dá validade às assinaturas. Leva menos de um minuto.',
      done: wallet.isConnected,
      to: '/carteira',
      cta: 'Conectar',
    },
    {
      id: 'funded',
      label: 'Ativar a conta na blockchain',
      detail: 'Na rede de testes é grátis e instantâneo.',
      done: wallet.accountExists,
      to: '/carteira',
      cta: 'Liberar saldo',
    },
    {
      id: 'contract',
      label: 'Criar seu primeiro contrato',
      detail: 'Um fluxo guiado de seis passos, do começo ao registro.',
      done: list.length > 0,
      to: '/criar',
      cta: 'Começar',
    },
  ];

  const doneCount = checklist.filter((c) => c.done).length;
  const allDone = doneCount === checklist.length;
  const nextStep = checklist.find((c) => !c.done);

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-16">
      <header className="space-y-1.5">
        <h1 className="font-bricolage text-2xl font-bold text-white sm:text-3xl">
          Olá{user?.name ? `, ${user.name.split(' ')[0]}` : ''}.
        </h1>
        <p className="text-sm leading-6 text-neutral-400">
          {allDone
            ? 'Tudo configurado. Crie um contrato ou acompanhe os que já existem.'
            : nextStep
              ? `Falta pouco: o próximo passo é ${nextStep.label.toLowerCase()}.`
              : ''}
        </p>
      </header>

      {/* Checklist — some quando tudo está pronto, para não virar ruído permanente. */}
      {!allDone && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
        >
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold text-white">Para deixar tudo pronto</h2>
            <span className="text-xs font-medium text-neutral-500">
              {doneCount} de {checklist.length}
            </span>
          </div>

          <div className="mb-5 h-1 overflow-hidden rounded-full bg-white/8">
            <motion.div
              initial={false}
              animate={{ width: `${(doneCount / checklist.length) * 100}%` }}
              transition={{ type: 'spring', stiffness: 200, damping: 30 }}
              className="h-full rounded-full bg-emerald-400"
            />
          </div>

          <ol className="space-y-1">
            {checklist.map((item) => {
              const isNext = item.id === nextStep?.id;
              return (
                <li
                  key={item.id}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 transition-colors ${
                    isNext ? 'bg-emerald-500/[0.07]' : ''
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${
                      item.done
                        ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
                        : isNext
                          ? 'border-emerald-400/40 text-emerald-300'
                          : 'border-white/12 text-neutral-600'
                    }`}
                  >
                    {item.done ? <iconify-icon icon="solar:check-read-linear" class="text-xs" /> : '·'}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-medium ${item.done ? 'text-neutral-500 line-through' : 'text-white'}`}>
                      {item.label}
                    </span>
                    {!item.done && <span className="mt-0.5 block text-xs leading-5 text-neutral-500">{item.detail}</span>}
                  </span>

                  {!item.done && (
                    <Link
                      to={item.to}
                      className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                        isNext
                          ? 'bg-emerald-500 text-black hover:bg-emerald-400'
                          : 'border border-white/12 text-neutral-300 hover:text-white'
                      }`}
                    >
                      {item.cta}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </motion.section>
      )}

      {/* Duas ações. Só duas. */}
      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/criar"
          className="group rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.06] p-5 transition-colors hover:border-emerald-400/45"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-500/12 text-emerald-300">
            <iconify-icon icon="solar:add-circle-bold-duotone" class="text-xl" />
          </span>
          <p className="mt-4 text-[15px] font-semibold text-white">Criar contrato</p>
          <p className="mt-1 text-sm leading-6 text-neutral-400">
            Seis passos guiados, do que você precisa até a prova registrada.
          </p>
          <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
            Começar
            <iconify-icon icon="solar:arrow-right-linear" class="text-sm transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>

        <Link
          to="/contracts"
          className="group rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-colors hover:border-white/20"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-neutral-300">
            <iconify-icon icon="solar:folder-with-files-bold-duotone" class="text-xl" />
          </span>
          <p className="mt-4 text-[15px] font-semibold text-white">Meus contratos</p>
          <p className="mt-1 text-sm leading-6 text-neutral-400">
            {list.length > 0
              ? `${list.length} ${list.length === 1 ? 'contrato' : 'contratos'} — acompanhe assinaturas e status.`
              : 'Assim que você criar o primeiro, ele aparece aqui.'}
          </p>
          <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-400">
            Abrir
            <iconify-icon icon="solar:arrow-right-linear" class="text-sm transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      </section>

      {/* Os três destinos que não cabem na barra do celular ficam sempre a um
          toque daqui. */}
      <section className="grid gap-3 sm:grid-cols-3">
        <Shortcut
          to="/templates"
          icon="solar:copy-bold-duotone"
          title="Modelos"
          detail="Cláusulas prontas por tipo de contrato"
        />
        <Shortcut
          to="/opportunities"
          icon="solar:bolt-circle-bold-duotone"
          title="Oportunidades"
          detail="Demandas abertas que viram contrato"
        />
        <Shortcut
          to="/painel"
          icon="solar:chart-2-bold-duotone"
          title="Painel"
          detail="Evolução e o que precisa de atenção"
        />
      </section>

      {/* Estado da carteira, discreto. */}
      <section className="rounded-2xl border border-white/8 bg-white/[0.02] px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`h-2 w-2 rounded-full ${wallet.isConnected && wallet.accountExists ? 'bg-emerald-400' : wallet.isConnected ? 'bg-amber-400' : 'bg-neutral-600'}`}
            />
            <div>
              <p className="text-sm font-medium text-white">
                {wallet.isConnected ? 'Carteira conectada' : 'Nenhuma carteira conectada'}
              </p>
              <p className="mt-0.5 text-xs text-neutral-500">
                {wallet.isConnected && wallet.address
                  ? `${shortenAddress(wallet.address, 6, 4)} · ${wallet.network === 'mainnet' ? 'rede real' : 'rede de testes'}${
                      wallet.accountExists ? '' : ' · conta ainda não ativada'
                    }`
                  : 'Você precisa de uma para assinar contratos.'}
              </p>
            </div>
          </div>
          <Link
            to="/carteira"
            className="rounded-xl border border-white/12 px-3.5 py-2 text-xs font-semibold text-neutral-300 transition-colors hover:border-white/25 hover:text-white"
          >
            {wallet.isConnected ? 'Gerenciar' : 'Conectar'}
          </Link>
        </div>
      </section>

      {/* Últimos contratos, no máximo três. */}
      {list.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Últimos contratos</h2>
            <Link to="/contracts" className="text-xs font-medium text-neutral-500 transition-colors hover:text-white">
              Ver todos
            </Link>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/8">
            {list.slice(0, 3).map((contract) => (
              <Link
                key={contract.id}
                to={`/contracts/${contract.id}`}
                className="flex items-center gap-3 border-b border-white/6 bg-white/[0.02] px-5 py-3.5 transition-colors last:border-0 hover:bg-white/[0.05]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-white">{contract.title}</span>
                  <span className="mt-0.5 block text-xs text-neutral-500">
                    {contract.parties?.length ?? 0} {(contract.parties?.length ?? 0) === 1 ? 'participante' : 'participantes'}
                  </span>
                </span>
                <StatusPill status={contract.status} />
                <iconify-icon icon="solar:alt-arrow-right-linear" class="shrink-0 text-sm text-neutral-600" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  draft: { label: 'Rascunho', className: 'border-white/12 text-neutral-400' },
  pending: { label: 'Aguardando assinaturas', className: 'border-amber-400/25 text-amber-300' },
  review: { label: 'Em revisão', className: 'border-sky-400/25 text-sky-300' },
  active: { label: 'Ativo', className: 'border-emerald-400/25 text-emerald-300' },
  completed: { label: 'Concluído', className: 'border-emerald-400/25 text-emerald-300' },
  cancelled: { label: 'Cancelado', className: 'border-white/12 text-neutral-500' },
  failed: { label: 'Falhou', className: 'border-red-400/25 text-red-300' },
  archived: { label: 'Arquivado', className: 'border-white/12 text-neutral-500' },
};

function Shortcut({ to, icon, title, detail }: { to: string; icon: string; title: string; detail: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3.5 transition-colors hover:border-white/20 hover:bg-white/[0.04]"
    >
      <iconify-icon icon={icon} class="shrink-0 text-xl text-neutral-400" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-white">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-neutral-500">{detail}</span>
      </span>
      <iconify-icon
        icon="solar:arrow-right-linear"
        class="shrink-0 text-sm text-neutral-600 transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}

function StatusPill({ status }: { status: string }) {
  const meta = STATUS_LABEL[status] ?? { label: status, className: 'border-white/12 text-neutral-400' };
  return (
    <span className={`hidden shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold sm:inline ${meta.className}`}>
      {meta.label}
    </span>
  );
}
