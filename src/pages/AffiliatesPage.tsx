import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { useAuthStore, useNotificationStore } from '@/stores';
import { useOpportunityFeed } from '@/hooks/useOpportunityQueries';
import { formatOpportunityReward, type SmartContractOpportunity } from '@/services/smartContractOpportunityService';

const STORAGE_KEY = 'contractease.affiliate.links.v1';
const DEFAULT_COMMISSION_PCT = 5;

type AffiliateLink = {
  id: string;
  opportunityId: string;
  opportunityTitle: string;
  opportunityCategory: string;
  url: string;
  commissionPct: number;
  estCommission: number;
  rewardAmount: number | null;
  rewardAsset: string;
  createdAt: string;
  clicks: number;
  conversions: number;
};

function loadLinks(): AffiliateLink[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AffiliateLink[]) : [];
  } catch {
    return [];
  }
}

function saveLinks(links: AffiliateLink[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
}

function formatCurrency(amount: number, asset = 'BRZ') {
  return `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount)} ${asset}`;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff) || diff < 0) return 'agora';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days}d`;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(iso));
}

export default function AffiliatesPage() {
  const { user } = useAuthStore();
  const notify = useNotificationStore((s) => s.add);
  const { data: feed = [], isLoading } = useOpportunityFeed({ limit: 24, status: 'open' });

  const [links, setLinks] = useState<AffiliateLink[]>(() => loadLinks());
  const [search, setSearch] = useState('');

  useEffect(() => {
    saveLinks(links);
  }, [links]);

  const handle = user?.handle || user?.id?.slice(0, 8) || 'voce';

  const filteredFeed = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return feed;
    return feed.filter((o) =>
      [o.title, o.summary, o.serviceCategory, o.ownerName].join(' ').toLowerCase().includes(q),
    );
  }, [feed, search]);

  const stats = useMemo(
    () => ({
      total: links.length,
      clicks: links.reduce((acc, l) => acc + l.clicks, 0),
      conversions: links.reduce((acc, l) => acc + l.conversions, 0),
      earnings: links.reduce((acc, l) => acc + l.conversions * l.estCommission, 0),
    }),
    [links],
  );

  const generateLink = async (opportunity: SmartContractOpportunity) => {
    const baseUrl = typeof window === 'undefined' ? '' : window.location.origin;
    const url = `${baseUrl}/opportunities/${encodeURIComponent(opportunity.id)}?ref=${encodeURIComponent('@' + handle)}`;
    const commissionPct = DEFAULT_COMMISSION_PCT;
    const reward = opportunity.rewardAmount ?? 0;
    const estCommission = Math.round((reward * commissionPct) / 100);

    const existing = links.find((l) => l.opportunityId === opportunity.id);
    if (existing) {
      try {
        await navigator.clipboard.writeText(existing.url);
        notify({
          type: 'info',
          title: 'Link copiado',
          message: 'Você já tinha um link para essa oportunidade — copiado de novo.',
        });
      } catch {
        notify({ type: 'info', title: 'Link já existe', message: 'Disponível em "Meus links" abaixo.' });
      }
      return;
    }

    const link: AffiliateLink = {
      id: crypto.randomUUID(),
      opportunityId: opportunity.id,
      opportunityTitle: opportunity.title,
      opportunityCategory: opportunity.serviceCategory,
      url,
      commissionPct,
      estCommission,
      rewardAmount: opportunity.rewardAmount,
      rewardAsset: opportunity.rewardAsset,
      createdAt: new Date().toISOString(),
      clicks: 0,
      conversions: 0,
    };

    setLinks((prev) => [link, ...prev]);

    try {
      await navigator.clipboard.writeText(url);
      notify({
        type: 'success',
        title: 'Link gerado e copiado',
        message:
          estCommission > 0
            ? `Cada contrato fechado por esse link te paga ${formatCurrency(estCommission, opportunity.rewardAsset)}.`
            : 'Link de afiliado pronto. Comissão será calculada quando a oportunidade tiver valor.',
      });
    } catch {
      notify({ type: 'success', title: 'Link gerado', message: 'Disponível em "Meus links" abaixo.' });
    }
  };

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      notify({ type: 'success', title: 'Link copiado', message: 'Cole onde quiser.' });
    } catch {
      notify({ type: 'error', title: 'Falha ao copiar', message: 'Seu browser bloqueou o clipboard.' });
    }
  };

  const shareWhatsApp = (link: AffiliateLink) => {
    const reward = link.rewardAmount != null ? ` (até ${formatCurrency(link.rewardAmount, link.rewardAsset)})` : '';
    const msg = `Oportunidade no ContractEase${reward}: ${link.opportunityTitle}\n\n${link.url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  };

  const removeLink = (id: string) => {
    setLinks((prev) => prev.filter((l) => l.id !== id));
    notify({ type: 'info', title: 'Link removido', message: 'O link continua válido em quem já recebeu, mas saiu do seu painel.' });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Programa de Afiliados</p>
        <h1 className="mt-1 font-bricolage text-4xl font-bold text-white">Compartilhe e ganhe</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-neutral-400">
          Envie oportunidades pra sua rede com seu link de afiliado. Quando o contrato fecha com a sua indicação,
          você recebe <span className="font-semibold text-emerald-300">{DEFAULT_COMMISSION_PCT}% direto na carteira</span>{' '}
          assim que o pagamento da etapa for liberado no smart contract.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Links gerados" value={String(stats.total)} sub="oportunidades compartilhadas" tone="text-white" />
        <StatTile label="Cliques únicos" value={String(stats.clicks)} sub="trackeados em links seus" tone="text-white" />
        <StatTile label="Conversões" value={String(stats.conversions)} sub="contratos fechados via você" tone="text-indigo-300" />
        <StatTile
          label="Ganho estimado"
          value={formatCurrency(stats.earnings, 'BRZ')}
          sub="quando os marcos forem pagos"
          tone="text-emerald-300"
        />
      </div>

      {/* How it works */}
      <div className="rounded-3xl border border-emerald-400/15 bg-emerald-500/[0.04] p-7">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-300/80">Como funciona</p>
        <div className="mt-4 grid gap-5 md:grid-cols-3">
          <StepBox step="1" title="Gera o link" body="Escolhe uma oportunidade do feed e cria um link único com seu @handle." />
          <StepBox step="2" title="Compartilha" body="Envia por WhatsApp, redes sociais, e-mail. Cada clique fica trackeado no seu painel." />
          <StepBox step="3" title="Recebe automático" body={`Quando o smart contract executa a etapa, ${DEFAULT_COMMISSION_PCT}% cai direto na sua carteira on-chain.`} />
        </div>
      </div>

      {/* Opportunity picker */}
      <section className="rounded-3xl border border-white/[0.06] bg-white/[0.018] p-7">
        <div className="mb-5 flex items-end justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Oportunidades abertas</p>
            <h2 className="mt-1 font-bricolage text-xl font-bold text-white">Escolha uma pra compartilhar</h2>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, categoria..."
            className="w-full max-w-xs rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-emerald-400/40"
          />
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/[0.025]" />
            ))}
          </div>
        ) : filteredFeed.length === 0 ? (
          <p className="py-10 text-center text-sm text-neutral-500">Nenhuma oportunidade aberta no momento.</p>
        ) : (
          <div className="space-y-2">
            {filteredFeed.map((opp) => {
              const alreadyShared = links.some((l) => l.opportunityId === opp.id);
              const reward = opp.rewardAmount ?? 0;
              const est = Math.round((reward * DEFAULT_COMMISSION_PCT) / 100);
              return (
                <motion.div
                  key={opp.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4 hover:border-emerald-400/20 hover:bg-white/[0.04] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-300">
                        {opp.serviceCategory}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          opp.opportunityType === 'request'
                            ? 'bg-amber-500/[0.08] text-amber-200'
                            : 'bg-indigo-500/[0.08] text-indigo-300'
                        }`}
                      >
                        {opp.opportunityType === 'request' ? 'Demanda' : 'Oferta'}
                      </span>
                      {alreadyShared && (
                        <span className="rounded-full bg-emerald-500/[0.10] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                          ✓ já compartilhada
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 truncate text-sm font-semibold text-white">{opp.title}</p>
                    <p className="mt-1 text-[11px] text-neutral-500">
                      Valor: <span className="text-neutral-300">{formatOpportunityReward(opp)}</span>
                      {est > 0 && (
                        <>
                          {' '}
                          · sua comissão: <span className="text-emerald-300 font-semibold">{formatCurrency(est, opp.rewardAsset)}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      to={`/opportunities/${opp.id}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs font-semibold text-neutral-300 hover:bg-white/[0.06] transition-colors"
                    >
                      Ver
                    </Link>
                    <button
                      onClick={() => generateLink(opp)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-500/[0.10] px-3 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-500/[0.18] transition-colors"
                    >
                      🔗 {alreadyShared ? 'Copiar link' : 'Gerar link'}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* My links */}
      <section className="rounded-3xl border border-white/[0.06] bg-white/[0.018] p-7">
        <div className="mb-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Seus links de afiliado</p>
          <h2 className="mt-1 font-bricolage text-xl font-bold text-white">Meus links</h2>
        </div>

        {links.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.01] p-10 text-center">
            <p className="text-sm text-neutral-400">Você ainda não gerou nenhum link.</p>
            <p className="mt-1 text-xs text-neutral-500">Escolha uma oportunidade acima pra começar.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {links.map((link) => (
              <div key={link.id} className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                      {link.opportunityCategory} · {formatRelativeTime(link.createdAt)}
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-white">{link.opportunityTitle}</p>
                    <p className="mt-1 truncate text-[11px] font-mono text-emerald-300/80">{link.url}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Comissão</p>
                    <p className="mt-0.5 font-bricolage text-lg font-bold tabular-nums text-emerald-300">
                      {formatCurrency(link.estCommission, link.rewardAsset)}
                    </p>
                    <p className="text-[10px] text-neutral-500">{link.commissionPct}% do valor</p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-white/[0.05] bg-black/20 p-3">
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wide text-neutral-500">Cliques</p>
                    <p className="font-bricolage text-base font-bold tabular-nums text-white">{link.clicks}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wide text-neutral-500">Conversões</p>
                    <p className="font-bricolage text-base font-bold tabular-nums text-indigo-300">{link.conversions}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wide text-neutral-500">Recebido</p>
                    <p className="font-bricolage text-base font-bold tabular-nums text-emerald-300">
                      {formatCurrency(link.conversions * link.estCommission, link.rewardAsset)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => copyLink(link.url)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:bg-white/[0.06] transition-colors"
                  >
                    📋 Copiar link
                  </button>
                  <button
                    onClick={() => shareWhatsApp(link)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/25 bg-emerald-500/[0.10] px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/[0.18] transition-colors"
                  >
                    💬 WhatsApp
                  </button>
                  <Link
                    to={`/opportunities/${link.opportunityId}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:bg-white/[0.06] transition-colors"
                  >
                    🔍 Ver oportunidade
                  </Link>
                  <button
                    onClick={() => removeLink(link.id)}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-rose-400/20 bg-rose-500/[0.06] px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/[0.12] transition-colors"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatTile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.018] p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">{label}</p>
      <p className={`mt-2 font-bricolage text-[2rem] font-bold leading-none tabular-nums ${tone}`}>{value}</p>
      <p className="mt-2 text-[11px] text-neutral-500">{sub}</p>
    </div>
  );
}

function StepBox({ step, title, body }: { step: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/[0.14] font-bricolage text-sm font-bold text-emerald-300">
          {step}
        </span>
        <p className="font-semibold text-white">{title}</p>
      </div>
      <p className="mt-2 text-xs leading-6 text-neutral-400">{body}</p>
    </div>
  );
}
