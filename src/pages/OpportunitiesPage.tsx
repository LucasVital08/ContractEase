import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { CATEGORIES, SMART_CONTRACT_TEMPLATES } from '@/services/smartContractTemplates';
import { SmartContractGlyph, getSmartContractVisual } from '@/components/SmartContractVisual';
import { useAuthStore, useNotificationStore } from '@/stores';
import {
  countActiveProposals,
  formatOpportunityReward,
  formatProposalAmount,
  getBestProposal,
  type CreateSmartContractOpportunityInput,
  type OpportunityEngagementType,
  type OpportunityPayoutMode,
  type OpportunityProposal,
  type OpportunityType,
  type SmartContractOpportunity,
  type SmartContractOpportunityMatch,
} from '@/services/smartContractOpportunityService';
import {
  useAcceptOpportunity,
  useAcceptProposal,
  useCreateOpportunity,
  useOpportunityFeed,
  useOpportunityProposals,
  useSendProposal,
  useWithdrawProposal,
} from '@/hooks/useOpportunityQueries';

type OpportunityMetadata = {
  heroLabel?: string;
  socialCaption?: string;
  detailPoints?: string[];
  urgency?: string;
  bonusLabel?: string;
};

const KIND_FILTERS: Array<{ id: OpportunityType | 'all'; label: string; description: string; icon: string }> = [
  { id: 'all', label: 'Feed completo', description: 'ofertas e demandas', icon: 'solar:widget-5-bold-duotone' },
  { id: 'request', label: 'Quero contratar', description: 'empresas e clientes buscando execução', icon: 'solar:clipboard-check-bold-duotone' },
  { id: 'offer', label: 'Quero ser contratado', description: 'profissionais oferecendo disponibilidade', icon: 'solar:user-hand-up-bold-duotone' },
];

const PAYOUT_COPY: Record<OpportunityPayoutMode, string> = {
  fixed: 'Valor fechado',
  milestone: 'Pagamento por etapa',
  hourly: 'Cobrança por hora',
  success_fee: 'Bônus por resultado',
};

const ENGAGEMENT_COPY: Record<OpportunityEngagementType, string> = {
  one_off: 'Pontual',
  recurring: 'Recorrente',
  milestone: 'Por marcos',
};

function getValueLabel(opportunity: Pick<SmartContractOpportunity, 'opportunityType'>) {
  return opportunity.opportunityType === 'request' ? 'Disposto a pagar até' : 'Pede a partir de';
}

function formatDeadline(iso: string | null | undefined): {
  label: string;
  tone: 'neutral' | 'soon' | 'urgent' | 'expired';
} | null {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return null;
  const now = Date.now();
  const diff = target - now;

  if (diff <= 0) return { label: 'Encerrado', tone: 'expired' };

  const hours = diff / (1000 * 60 * 60);
  const days = hours / 24;

  if (hours < 24) {
    const h = Math.max(1, Math.round(hours));
    return { label: `Encerra em ${h}h`, tone: 'urgent' };
  }
  if (days < 7) {
    const d = Math.floor(days);
    const h = Math.round(hours - d * 24);
    return { label: h > 0 ? `Encerra em ${d}d ${h}h` : `Encerra em ${d}d`, tone: 'soon' };
  }

  const fmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
  return { label: `Encerra ${fmt.format(new Date(iso))}`, tone: 'neutral' };
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
  const fmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
  return fmt.format(new Date(iso));
}

const DEFAULT_FORM = {
  opportunityType: 'request' as OpportunityType,
  title: '',
  summary: '',
  serviceCategory: '',
  templateId: 'freelancer',
  rewardAmount: '',
  rewardAsset: 'BRZ',
  payoutMode: 'milestone' as OpportunityPayoutMode,
  engagementType: 'one_off' as OpportunityEngagementType,
  location: '',
  remoteAllowed: true,
  expiresAt: '',
};

function isFeaturedOpportunity(opportunity: SmartContractOpportunity) {
  return opportunity.id.startsWith('featured-') || opportunity.metadata.source === 'featured-suggestion';
}

function getOpportunityPagePath(opportunity: Pick<SmartContractOpportunity, 'id'>) {
  return `/opportunities/${encodeURIComponent(opportunity.id)}`;
}

function getOpportunityShareUrl(opportunity: Pick<SmartContractOpportunity, 'id'>) {
  const path = getOpportunityPagePath(opportunity);
  return typeof window === 'undefined' ? path : `${window.location.origin}${path}`;
}

function getOpportunityAcceptLabel(opportunity: SmartContractOpportunity) {
  return opportunity.opportunityType === 'request' ? 'Aceitar como executor' : 'Aceitar como contratante';
}

export default function OpportunitiesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { opportunityId } = useParams<{ opportunityId?: string }>();
  const notify = useNotificationStore((state) => state.add);
  const { user } = useAuthStore();
  const initialized = useAuthStore((s) => s.initialized);
  const stateOpportunity = (location.state as { opportunity?: SmartContractOpportunity } | null)?.opportunity;

  const [kindFilter, setKindFilter] = useState<OpportunityType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selectedService, setSelectedService] = useState<string>('all');
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<SmartContractOpportunity | null>(null);
  const [proposalDraftOpportunity, setProposalDraftOpportunity] = useState<SmartContractOpportunity | null>(null);

  const { data: feed = [], isLoading } = useOpportunityFeed({ limit: opportunityId ? 100 : 24, status: opportunityId ? 'all' : 'open' });
  const createOpportunity = useCreateOpportunity();
  const acceptOpportunity = useAcceptOpportunity();
  const sendProposal = useSendProposal();
  const acceptProposal = useAcceptProposal();
  const withdrawProposal = useWithdrawProposal();

  const filteredFeed = useMemo(() => {
    const query = search.trim().toLowerCase();

    return feed.filter((opportunity) => {
      const matchesKind = kindFilter === 'all' || opportunity.opportunityType === kindFilter;
      const matchesService = selectedService === 'all' || opportunity.serviceCategory === selectedService;
      const haystack = [
        opportunity.title,
        opportunity.summary,
        opportunity.serviceCategory,
        opportunity.ownerName,
        opportunity.ownerHandle,
        opportunity.location ?? '',
      ].join(' ').toLowerCase();
      const matchesSearch = !query || haystack.includes(query);
      return matchesKind && matchesService && matchesSearch;
    });
  }, [feed, kindFilter, search, selectedService]);

  const serviceFilters = useMemo(
    () => Array.from(new Set(feed.map((opportunity) => opportunity.serviceCategory))).sort((left, right) => left.localeCompare(right, 'pt-BR')),
    [feed],
  );

  const routeOpportunity = useMemo(() => {
    if (!opportunityId) return null;
    if (stateOpportunity?.id === opportunityId) return stateOpportunity;
    return feed.find((opportunity) => opportunity.id === opportunityId) ?? null;
  }, [feed, opportunityId, stateOpportunity]);

  const feedStats = useMemo(() => ({
    total: feed.length,
    requests: feed.filter((opportunity) => opportunity.opportunityType === 'request').length,
    offers: feed.filter((opportunity) => opportunity.opportunityType === 'offer').length,
  }), [feed]);

  const handleOpenComposer = () => {
    if (!user) {
      navigate('/login');
      return;
    }

    setComposerOpen(true);
  };

  const handleOpenSmartContract = (opportunity: SmartContractOpportunity, match?: SmartContractOpportunityMatch | null) => {
    navigate('/smart-contracts', {
      state: {
        marketplaceOpportunity: opportunity,
        marketplaceMatch: match ?? null,
        autoSelectTemplateId: opportunity.templateId,
      },
    });
  };

  const handleOpenOpportunityPage = (opportunity: SmartContractOpportunity) => {
    setSelectedOpportunity(null);
    navigate(getOpportunityPagePath(opportunity), { state: { opportunity } });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleShareOpportunity = (opportunity: SmartContractOpportunity) => {
    const url = getOpportunityShareUrl(opportunity);
    const message = [
      `Oportunidade no ContractEase: ${opportunity.title}`,
      `${formatOpportunityReward(opportunity)} · ${opportunity.serviceCategory}`,
      url,
    ].join('\n');

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  const handleAcceptOpportunity = async (opportunity: SmartContractOpportunity) => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (user.id === opportunity.ownerId) {
      notify({
        type: 'warning',
        title: 'Você publicou essa oportunidade',
        message: 'O match precisa ser aceito pela outra parte para ligar contratante e executor.',
      });
      return;
    }

    if (isFeaturedOpportunity(opportunity)) {
      notify({
        type: 'info',
        title: 'Mockup demonstrativo',
        message: 'Esse card é um mockup do feed. Para persistir o match no banco, aceite uma oportunidade publicada por um perfil real.',
      });
      setSelectedOpportunity(null);
      handleOpenSmartContract(opportunity);
      return;
    }

    try {
      const match = await acceptOpportunity.mutateAsync(opportunity.id);
      notify({
        type: 'success',
        title: 'Match criado',
        message: `${match.contractorName} agora contrata ${match.executorName}. Formalize o fluxo no contrato inteligente.`,
      });
      setSelectedOpportunity(null);
      handleOpenSmartContract(opportunity, match);
    } catch (error: any) {
      notify({
        type: 'error',
        title: 'Não foi possível aceitar',
        message: error?.message || 'Tente novamente em alguns instantes.',
      });
    }
  };

  const handleOpenSendProposal = (opportunity: SmartContractOpportunity) => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.id === opportunity.ownerId) {
      notify({
        type: 'warning',
        title: 'Você publicou essa oportunidade',
        message: 'Quem envia proposta é a outra parte interessada em fechar.',
      });
      return;
    }
    setProposalDraftOpportunity(opportunity);
  };

  const handleSendProposal = async (opportunity: SmartContractOpportunity, amount: number, note: string) => {
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      await sendProposal.mutateAsync({
        opportunityId: opportunity.id,
        proposerId: user.id,
        proposerName: user.name || user.handle || 'Você',
        proposerHandle: user.handle || user.id.slice(0, 8),
        proposerAvatarUrl: user.avatar ?? null,
        proposerJobTitle: null,
        proposerVerificationLevel: 'none',
        proposerTrustScore: 0,
        amount,
        asset: opportunity.rewardAsset,
        note: note.trim() ? note.trim() : null,
      });
      notify({
        type: 'success',
        title: 'Proposta enviada',
        message: `Sua proposta de ${new Intl.NumberFormat('pt-BR').format(amount)} ${opportunity.rewardAsset} foi publicada na página do contrato.`,
      });
      setProposalDraftOpportunity(null);
    } catch (error: any) {
      notify({
        type: 'error',
        title: 'Não foi possível enviar',
        message: error?.message || 'Tente novamente em alguns instantes.',
      });
    }
  };

  const handleAcceptProposal = async (opportunity: SmartContractOpportunity, proposal: OpportunityProposal) => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.id !== opportunity.ownerId) {
      notify({
        type: 'warning',
        title: 'Apenas o autor pode aceitar',
        message: 'Só quem publicou a oportunidade pode escolher qual proposta fechar.',
      });
      return;
    }
    try {
      const { match } = await acceptProposal.mutateAsync({
        opportunityId: opportunity.id,
        proposalId: proposal.id,
        opportunity,
        acceptedById: user.id,
      });
      notify({
        type: 'success',
        title: 'Proposta aceita',
        message: `${match.contractorName} agora contrata ${match.executorName}. Formalize o fluxo no contrato inteligente.`,
      });
      setSelectedOpportunity(null);
      handleOpenSmartContract(opportunity, match);
    } catch (error: any) {
      notify({
        type: 'error',
        title: 'Não foi possível aceitar',
        message: error?.message || 'Tente novamente em alguns instantes.',
      });
    }
  };

  const handleWithdrawProposal = async (proposal: OpportunityProposal) => {
    try {
      await withdrawProposal.mutateAsync(proposal.id);
      notify({
        type: 'info',
        title: 'Proposta retirada',
        message: 'Sua proposta foi removida da página do contrato.',
      });
    } catch (error: any) {
      notify({
        type: 'error',
        title: 'Não foi possível retirar',
        message: error?.message || 'Tente novamente em alguns instantes.',
      });
    }
  };

  const handlePublishOpportunity = async (form: typeof DEFAULT_FORM) => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!form.title.trim() || !form.summary.trim() || !form.serviceCategory.trim()) {
      notify({
        type: 'warning',
        title: 'Dados incompletos',
        message: 'Preencha título, resumo e serviço antes de publicar a oportunidade.',
      });
      return;
    }

    const payload: CreateSmartContractOpportunityInput = {
      ownerId: user.id,
      opportunityType: form.opportunityType,
      title: form.title,
      summary: form.summary,
      serviceCategory: form.serviceCategory,
      templateId: form.templateId,
      rewardAmount: form.rewardAmount ? Number(form.rewardAmount) : null,
      rewardAsset: form.rewardAsset,
      payoutMode: form.payoutMode,
      engagementType: form.engagementType,
      location: form.location || null,
      remoteAllowed: form.remoteAllowed,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      metadata: {
        published_from: 'marketplace_feed',
      },
    };

    try {
      await createOpportunity.mutateAsync(payload);
      setComposerOpen(false);
      notify({
        type: 'success',
        title: 'Oportunidade publicada',
        message: 'Seu card agora entra no feed e pode ser convertido em contrato inteligente.',
      });
    } catch (error: any) {
      notify({
        type: 'error',
        title: 'Não foi possível publicar',
        message: error?.message || 'Aplique a migration nova do feed e tente novamente.',
      });
    }
  };

  if (opportunityId) {
    if (isLoading || !initialized) {
      return (
        <div className="min-h-screen p-6 lg:p-10">
          <div className="mx-auto max-w-6xl animate-pulse space-y-5">
            <div className="h-8 w-48 rounded-full bg-white/8" />
            <div className="h-[520px] rounded-[34px] border border-white/8 bg-neutral-900/60" />
          </div>
        </div>
      );
    }

    if (!routeOpportunity) {
      return (
        <div className="min-h-screen p-6 lg:p-10">
          <div className="mx-auto max-w-3xl rounded-[30px] border border-dashed border-white/10 bg-neutral-950/50 px-6 py-20 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/10 bg-white/[0.03] text-neutral-600">
              <iconify-icon icon="solar:link-broken-bold-duotone" class="text-3xl" />
            </div>
            <p className="text-xl font-bold text-white font-bricolage">Oportunidade não encontrada</p>
            <p className="mt-2 text-sm text-neutral-500">Esse link pode ter expirado, sido removido ou ainda não estar no feed carregado.</p>
            <Link
              to="/opportunities"
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/18 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/14"
            >
              <iconify-icon icon="solar:arrow-left-bold-duotone" class="text-base" />
              Voltar ao feed
            </Link>
          </div>
        </div>
      );
    }

    return (
      <>
        <OpportunityStandalonePage
          opportunity={routeOpportunity}
          currentUserId={user?.id ?? null}
          accepting={acceptOpportunity.isPending && acceptOpportunity.variables === routeOpportunity.id}
          onBack={() => navigate('/opportunities')}
          onAccept={() => handleAcceptOpportunity(routeOpportunity)}
          onOpenSmartContract={() => handleOpenSmartContract(routeOpportunity)}
          onSendProposal={() => handleOpenSendProposal(routeOpportunity)}
          onShareWhatsApp={() => handleShareOpportunity(routeOpportunity)}
        />

        <AnimatePresence>
          {proposalDraftOpportunity && (
            <SendProposalModal
              opportunity={proposalDraftOpportunity}
              onClose={() => setProposalDraftOpportunity(null)}
              onSubmit={(amount, note) => handleSendProposal(proposalDraftOpportunity, amount, note)}
              submitting={sendProposal.isPending}
            />
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/18 bg-emerald-500/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300">
              <iconify-icon icon="solar:bolt-circle-bold-duotone" class="text-sm" />
              Feed de oportunidades
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-white font-bricolage sm:text-4xl">
              Publique trabalho. Assuma demanda. Feche tudo em contrato inteligente.
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-neutral-400 sm:text-base">
              Em vez de posts genéricos, o marketplace mostra oportunidades contratuais. Quem precisa contratar publica a demanda. Quem quer ser contratado publica disponibilidade. O próximo passo já é abrir o contrato inteligente com valor, etapas e regras claras.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="rounded-[24px] border border-white/10 bg-neutral-950/80 px-5 py-4 backdrop-blur-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Marketplace ativo</p>
              <p className="mt-2 text-2xl font-bold text-white font-bricolage">{feedStats.total}</p>
              <p className="mt-1 text-xs text-neutral-500">oportunidades abertas no feed</p>
            </div>
            <button
              onClick={handleOpenComposer}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/12 px-5 py-3 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/18"
            >
              <iconify-icon icon="solar:add-circle-bold-duotone" class="text-base" />
              Publicar oportunidade
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <FeedStatCard label="Empresas contratando" value={feedStats.requests} detail="demandas com execução pedida" tone="text-emerald-300" icon="solar:clipboard-check-bold-duotone" />
          <FeedStatCard label="Profissionais disponíveis" value={feedStats.offers} detail="ofertas de serviço com contrato pronto" tone="text-cyan-300" icon="solar:user-hand-up-bold-duotone" />
          <FeedStatCard label="Próximo passo" value="1 clique" detail="abre o template certo e já leva o contexto do feed" tone="text-amber-300" icon="solar:cursor-bold-duotone" />
        </div>
      </header>

      <section className="rounded-[28px] border border-white/10 bg-neutral-950/80 p-2.5 backdrop-blur-xl">
        <div className="flex flex-col gap-3 rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/25 text-neutral-400">
              <iconify-icon icon="solar:magnifer-linear" class="text-lg" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Buscar oportunidade</p>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Procure por serviço, contratante, profissão, cidade ou valor"
                className="mt-1 w-full bg-transparent text-sm text-white outline-none placeholder:text-neutral-600"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {KIND_FILTERS.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setKindFilter(filter.id)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                  kindFilter === filter.id
                    ? 'border-emerald-400/24 bg-emerald-500/10 text-emerald-300'
                    : 'border-white/10 bg-black/20 text-neutral-300 hover:bg-white/[0.05]'
                }`}
              >
                <iconify-icon icon={filter.icon} class="text-sm" />
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedService('all')}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors ${
              selectedService === 'all'
                ? 'border-cyan-500/24 bg-cyan-500/10 text-cyan-300'
                : 'border-white/8 bg-white/[0.03] text-neutral-400 hover:text-white hover:border-white/14'
            }`}
          >
            Todos os serviços
          </button>
          {serviceFilters.map((service) => (
            <button
              key={service}
              onClick={() => setSelectedService(service)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                selectedService === service
                  ? 'border-cyan-500/24 bg-cyan-500/10 text-cyan-300'
                  : 'border-white/8 bg-white/[0.03] text-neutral-400 hover:text-white hover:border-white/14'
              }`}
            >
              {service}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Feed</p>
            <h2 className="mt-1 text-xl font-semibold text-white font-bricolage">Oportunidades abertas</h2>
          </div>
          <p className="text-xs text-neutral-500">{filteredFeed.length} card{filteredFeed.length !== 1 ? 's' : ''} visível{filteredFeed.length !== 1 ? 'eis' : ''}</p>
        </div>

        {isLoading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="h-64 animate-pulse rounded-[28px] border border-white/8 bg-neutral-900/60" />
            ))}
          </div>
        ) : filteredFeed.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-white/10 bg-neutral-950/40 px-6 py-20 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/10 bg-white/[0.03] text-neutral-600">
              <iconify-icon icon="solar:ghost-bold-duotone" class="text-3xl" />
            </div>
            <p className="text-lg font-semibold text-white">Nenhuma oportunidade encontrada.</p>
            <p className="mt-2 text-sm text-neutral-500">Ajuste filtros ou publique a primeira oportunidade do seu nicho.</p>
            <button
              onClick={handleOpenComposer}
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/18 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/14 transition-colors"
            >
              <iconify-icon icon="solar:add-circle-bold" class="text-base" />
              Publicar agora
            </button>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl space-y-5">
            {filteredFeed.map((opportunity) => (
              <OpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
                currentUserId={user?.id ?? null}
                onViewDetails={() => setSelectedOpportunity(opportunity)}
                onAccept={() => handleAcceptOpportunity(opportunity)}
                accepting={acceptOpportunity.isPending && acceptOpportunity.variables === opportunity.id}
                onOpenSmartContract={() => handleOpenSmartContract(opportunity)}
                onSendProposal={() => handleOpenSendProposal(opportunity)}
              />
            ))}
          </div>
        )}
      </section>

      <AnimatePresence>
        {selectedOpportunity && (
          <OpportunityDetailModal
            opportunity={selectedOpportunity}
            currentUserId={user?.id ?? null}
            onClose={() => setSelectedOpportunity(null)}
            onAccept={() => handleAcceptOpportunity(selectedOpportunity)}
            accepting={acceptOpportunity.isPending && acceptOpportunity.variables === selectedOpportunity.id}
            onOpenSmartContract={() => {
              handleOpenSmartContract(selectedOpportunity);
              setSelectedOpportunity(null);
            }}
            onOpenPage={() => handleOpenOpportunityPage(selectedOpportunity)}
            onShareWhatsApp={() => handleShareOpportunity(selectedOpportunity)}
            onSendProposal={() => handleOpenSendProposal(selectedOpportunity)}
            onAcceptProposal={(proposal) => handleAcceptProposal(selectedOpportunity, proposal)}
            onWithdrawProposal={(proposal) => handleWithdrawProposal(proposal)}
            pendingAcceptProposalId={acceptProposal.isPending ? acceptProposal.variables?.proposalId ?? null : null}
          />
        )}

        {proposalDraftOpportunity && (
          <SendProposalModal
            opportunity={proposalDraftOpportunity}
            onClose={() => setProposalDraftOpportunity(null)}
            onSubmit={(amount, note) => handleSendProposal(proposalDraftOpportunity, amount, note)}
            submitting={sendProposal.isPending}
          />
        )}

        {composerOpen && (
          <OpportunityComposerModal
            loading={createOpportunity.isPending}
            onClose={() => setComposerOpen(false)}
            onSubmit={handlePublishOpportunity}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function FeedStatCard({ label, value, detail, tone, icon }: {
  label: string;
  value: number | string;
  detail: string;
  tone: string;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-neutral-900/60 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-neutral-500">{label}</p>
          <p className={`mt-2 text-2xl font-bold font-bricolage ${tone}`}>{value}</p>
          <p className="mt-1 text-xs text-neutral-500">{detail}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.03] text-neutral-300">
          <iconify-icon icon={icon} class="text-lg" />
        </div>
      </div>
    </div>
  );
}

function OpportunityCard({ opportunity, currentUserId, onViewDetails, onAccept, accepting, onOpenSmartContract, onSendProposal }: {
  opportunity: SmartContractOpportunity;
  currentUserId: string | null;
  onViewDetails: () => void;
  onAccept: () => void;
  accepting: boolean;
  onOpenSmartContract: () => void;
  onSendProposal: () => void;
}) {
  const metadata = getOpportunityMetadata(opportunity);
  const template = SMART_CONTRACT_TEMPLATES.find((candidate) => candidate.id === opportunity.templateId) ?? SMART_CONTRACT_TEMPLATES[0];
  const visual = getSmartContractVisual(template);
  const category = CATEGORIES.find((candidate) => candidate.id === template.category);
  const isMine = currentUserId === opportunity.ownerId;
  const actionLabel = opportunity.opportunityType === 'request'
    ? 'Executar com contrato inteligente'
    : 'Contratar com contrato inteligente';
  const acceptLabel = getOpportunityAcceptLabel(opportunity);
  const featured = opportunity.metadata.source === 'featured-suggestion';
  const { data: proposals = [] } = useOpportunityProposals(opportunity.id);
  const activeProposalsCount = countActiveProposals(proposals);
  const bestProposal = getBestProposal(opportunity, proposals);
  const deadline = formatDeadline(opportunity.expiresAt);
  const hasAuctionBar = Boolean(deadline) || activeProposalsCount > 0;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      role="button"
      tabIndex={0}
      onClick={onViewDetails}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onViewDetails();
        }
      }}
      className="cursor-pointer overflow-hidden rounded-[32px] border border-white/8 bg-neutral-900/75 shadow-[0_24px_90px_rgba(0,0,0,0.24)] transition-transform hover:-translate-y-0.5"
    >
      <div className="flex items-center justify-between gap-4 px-5 pb-3 pt-4">
        <Link
          to={`/@${opportunity.ownerHandle}`}
          onClick={(event) => event.stopPropagation()}
          className="flex min-w-0 items-center gap-3"
        >
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-xs font-bold text-white">
            {opportunity.ownerAvatarUrl
              ? <img src={opportunity.ownerAvatarUrl} alt={opportunity.ownerName} className="h-full w-full object-cover" />
              : opportunity.ownerName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{opportunity.ownerName}</p>
            <p className="truncate text-[11px] text-neutral-500">@{opportunity.ownerHandle}{opportunity.ownerJobTitle ? ` · ${opportunity.ownerJobTitle}` : ''}</p>
          </div>
        </Link>

        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.22em] text-neutral-500">Valor</p>
          <p className="mt-1 text-lg font-bold font-bricolage text-emerald-300">{formatOpportunityReward(opportunity)}</p>
        </div>
      </div>

      <div className={`relative mx-4 overflow-hidden rounded-[28px] border border-white/8 bg-gradient-to-br ${visual.accentGradient}`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.15),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(0,0,0,0.35),transparent_35%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.32))]" />
        <div className="relative flex min-h-[220px] flex-col justify-between gap-4 p-5 sm:min-h-[260px]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${opportunity.opportunityType === 'request' ? 'border-white/15 bg-black/20 text-white' : 'border-cyan-200/24 bg-cyan-950/30 text-cyan-100'}`}>
                {opportunity.opportunityType === 'request' ? 'Quero contratar' : 'Disponível para executar'}
              </span>
              {featured && (
                <span className="rounded-full border border-amber-200/25 bg-amber-950/25 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100">
                  Mockup premium
                </span>
              )}
            </div>

            <div className="rounded-2xl border border-white/14 bg-black/18 p-2.5 text-white/90 backdrop-blur-sm">
              <SmartContractGlyph template={template} size="md" />
            </div>
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/65">{metadata.heroLabel || opportunity.serviceCategory}</p>
            <h3 className="mt-2 max-w-2xl text-2xl font-bold leading-tight text-white font-bricolage sm:text-[1.85rem]">{opportunity.title}</h3>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80">{metadata.socialCaption || opportunity.summary}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <OpportunityHeroMetric label="Pagamento" value={PAYOUT_COPY[opportunity.payoutMode]} />
            <OpportunityHeroMetric label="Formato" value={ENGAGEMENT_COPY[opportunity.engagementType]} />
            <OpportunityHeroMetric label="Operação" value={opportunity.remoteAllowed ? 'Remoto / híbrido' : 'Presencial'} />
          </div>
        </div>
      </div>

      <div className="space-y-4 px-5 pb-5 pt-4">
        <p className="text-sm leading-7 text-neutral-300">
          <span className="font-semibold text-white">@{opportunity.ownerHandle}</span>{' '}
          {metadata.socialCaption || opportunity.summary}
        </p>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[11px] text-neutral-300">{opportunity.serviceCategory}</span>
          {category && (
            <span className="rounded-full border border-cyan-500/18 bg-cyan-500/10 px-3 py-1.5 text-[11px] text-cyan-300">{category.label}</span>
          )}
          {metadata.urgency && (
            <span className="rounded-full border border-amber-500/18 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-200">{metadata.urgency}</span>
          )}
          {opportunity.location && (
            <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[11px] text-neutral-400">{opportunity.location}</span>
          )}
        </div>

        {hasAuctionBar && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            {deadline && (
              <span className={`inline-flex items-center gap-1.5 ${
                deadline.tone === 'urgent' ? 'text-rose-300' :
                deadline.tone === 'soon' ? 'text-amber-300' :
                deadline.tone === 'expired' ? 'text-neutral-500 line-through' :
                'text-neutral-400'
              }`}>
                <iconify-icon icon="solar:clock-circle-bold-duotone" class="text-sm" />
                {deadline.label}
              </span>
            )}
            {activeProposalsCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-neutral-300">
                <iconify-icon icon="solar:document-text-bold-duotone" class="text-sm" />
                {activeProposalsCount} proposta{activeProposalsCount !== 1 ? 's' : ''} em aberto
              </span>
            )}
            {bestProposal && (
              <span className="inline-flex items-center gap-1.5 text-cyan-200">
                <iconify-icon icon="solar:medal-ribbons-star-bold-duotone" class="text-sm" />
                <span className="text-neutral-500">{opportunity.opportunityType === 'request' ? 'Menor proposta:' : 'Melhor proposta:'}</span>
                <span className="font-semibold">{formatProposalAmount(bestProposal)}</span>
                <span className="text-neutral-500">· @{bestProposal.proposerHandle}</span>
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap border-t border-white/6 pt-4">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onViewDetails();
            }}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-neutral-200 transition hover:bg-white/[0.06]"
          >
            <iconify-icon icon="solar:eye-bold-duotone" class="text-base" />
            Ver detalhes da oportunidade
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            {isMine && (
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-semibold text-neutral-300">
                Publicado por você
              </span>
            )}
            {!isMine && (
              <>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onSendProposal();
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-neutral-100 transition hover:bg-white/[0.08]"
                >
                  <iconify-icon icon="solar:document-add-bold-duotone" class="text-base" />
                  Enviar proposta
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onAccept();
                  }}
                  disabled={accepting}
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-400/22 bg-cyan-500/12 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/18 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <iconify-icon icon={accepting ? 'solar:refresh-circle-bold-duotone' : 'solar:hand-shake-bold-duotone'} class="text-base" />
                  {accepting ? 'Fechando match...' : acceptLabel}
                </button>
              </>
            )}
            <button
              onClick={(event) => {
                event.stopPropagation();
                onOpenSmartContract();
              }}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/12 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/18"
            >
              <iconify-icon icon="solar:play-circle-bold-duotone" class="text-base" />
              {isMine ? actionLabel : 'Abrir template base'}
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function OpportunityHeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/12 bg-black/18 px-4 py-3 backdrop-blur-sm">
      <p className="text-[10px] uppercase tracking-[0.22em] text-white/55">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function OpportunityStandalonePage({
  opportunity,
  currentUserId,
  accepting,
  onBack,
  onAccept,
  onOpenSmartContract,
  onSendProposal,
  onShareWhatsApp,
}: {
  opportunity: SmartContractOpportunity;
  currentUserId: string | null;
  accepting: boolean;
  onBack: () => void;
  onAccept: () => void;
  onOpenSmartContract: () => void;
  onSendProposal: () => void;
  onShareWhatsApp: () => void;
}) {
  const template = SMART_CONTRACT_TEMPLATES.find((candidate) => candidate.id === opportunity.templateId) ?? SMART_CONTRACT_TEMPLATES[0];
  const visual = getSmartContractVisual(template);
  const category = CATEGORIES.find((candidate) => candidate.id === template.category);
  const metadata = getOpportunityMetadata(opportunity);
  const isMine = currentUserId === opportunity.ownerId;
  const acceptLabel = getOpportunityAcceptLabel(opportunity);
  const { data: proposals = [] } = useOpportunityProposals(opportunity.id);
  const activeProposalsCount = countActiveProposals(proposals);
  const deadline = formatDeadline(opportunity.expiresAt);
  const detailPoints = metadata.detailPoints.length > 0
    ? metadata.detailPoints
    : [
      'Definir as partes, o escopo e a forma de aceite.',
      'Travar a remuneracao ou o marco financeiro no template escolhido.',
      'Executar a oportunidade com liberacao programada conforme a regra combinada.',
    ];

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-neutral-200 transition hover:bg-white/[0.06]"
          >
            <iconify-icon icon="solar:arrow-left-bold-duotone" class="text-base" />
            Voltar ao feed
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onShareWhatsApp}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/12 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/18"
            >
              <iconify-icon icon="mdi:whatsapp" class="text-base" />
              Compartilhar
            </button>
            <button
              onClick={onOpenSmartContract}
              className="inline-flex items-center gap-2 rounded-full border border-cyan-400/22 bg-cyan-500/12 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/18"
            >
              <iconify-icon icon="solar:play-circle-bold-duotone" class="text-base" />
              Abrir template
            </button>
          </div>
        </div>

        <article className="overflow-hidden rounded-[34px] border border-white/10 bg-neutral-950/90 shadow-[0_32px_120px_rgba(0,0,0,0.42)]">
          <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
            <section className={`relative bg-gradient-to-br ${visual.accentGradient} p-6 sm:p-8 lg:min-h-[620px] lg:p-10`}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(0,0,0,0.34),transparent_38%)]" />
              <div className="relative flex flex-col justify-between gap-6 lg:min-h-[540px] lg:gap-10">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/15 bg-black/18 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white">
                      {opportunity.opportunityType === 'request' ? 'Demanda publicada' : 'Disponibilidade publicada'}
                    </span>
                    {deadline && (
                      <span className="rounded-full border border-amber-200/25 bg-amber-950/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-100">
                        {deadline.label}
                      </span>
                    )}
                  </div>
                  <SmartContractGlyph template={template} size="lg" className="shrink-0" />
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">{metadata.heroLabel || opportunity.serviceCategory}</p>
                  <h1 className="mt-4 max-w-3xl text-2xl font-bold leading-tight text-white font-bricolage sm:text-4xl lg:text-6xl">
                    {opportunity.title}
                  </h1>
                  <p className="mt-5 max-w-2xl text-base leading-8 text-white/82">{opportunity.summary}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <OpportunityHeroMetric label="Valor" value={formatOpportunityReward(opportunity)} />
                  <OpportunityHeroMetric label="Pagamento" value={PAYOUT_COPY[opportunity.payoutMode]} />
                  <OpportunityHeroMetric label="Formato" value={ENGAGEMENT_COPY[opportunity.engagementType]} />
                </div>
              </div>
            </section>

            <aside className="space-y-5 p-6 sm:p-8 lg:p-10">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-sm font-bold text-white">
                  {opportunity.ownerAvatarUrl
                    ? <img src={opportunity.ownerAvatarUrl} alt={opportunity.ownerName} className="h-full w-full object-cover" />
                    : opportunity.ownerName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <Link to={`/@${opportunity.ownerHandle}`} className="truncate text-sm font-semibold text-white hover:underline">
                    {opportunity.ownerName}
                  </Link>
                  <p className="truncate text-xs text-neutral-500">@{opportunity.ownerHandle}{opportunity.ownerJobTitle ? ` · ${opportunity.ownerJobTitle}` : ''}</p>
                </div>
              </div>

              <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-5">
                <p className="text-[10px] uppercase tracking-[0.22em] text-neutral-500">Resumo compartilhavel</p>
                <p className="mt-3 text-sm leading-7 text-neutral-300">{metadata.socialCaption || opportunity.summary}</p>
              </div>

              <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-5">
                <p className="text-[10px] uppercase tracking-[0.22em] text-neutral-500">Como essa oportunidade roda</p>
                <ul className="mt-4 space-y-3">
                  {detailPoints.map((point) => (
                    <li key={point} className="flex items-start gap-3 text-sm leading-7 text-neutral-300">
                      <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-emerald-400/85" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[11px] text-neutral-300">{opportunity.serviceCategory}</span>
                {category && (
                  <span className="rounded-full border border-cyan-500/18 bg-cyan-500/10 px-3 py-1.5 text-[11px] text-cyan-300">{category.label}</span>
                )}
                <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[11px] text-neutral-400">{opportunity.remoteAllowed ? 'Aceita remoto' : 'Execucao presencial'}</span>
                {opportunity.location && (
                  <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[11px] text-neutral-400">{opportunity.location}</span>
                )}
              </div>

              <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-neutral-500">Propostas</p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {activeProposalsCount > 0 ? `${activeProposalsCount} em aberto` : 'Nenhuma proposta aberta'}
                    </p>
                  </div>
                  <p className="text-right text-lg font-bold text-emerald-300 font-bricolage">{formatOpportunityReward(opportunity)}</p>
                </div>
                {proposals.slice(0, 2).map((proposal) => (
                  <div key={proposal.id} className="mt-4 rounded-2xl border border-white/10 bg-black/18 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{proposal.proposerName}</p>
                        <p className="text-[11px] text-neutral-500">@{proposal.proposerHandle}</p>
                      </div>
                      <p className="text-sm font-bold text-emerald-300">{formatProposalAmount(proposal)}</p>
                    </div>
                    {proposal.note && <p className="mt-3 line-clamp-2 text-xs leading-5 text-neutral-400">{proposal.note}</p>}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {!isMine && (
                  <>
                    <button
                      onClick={onSendProposal}
                      className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-neutral-100 transition hover:bg-white/[0.08]"
                    >
                      <iconify-icon icon="solar:document-add-bold-duotone" class="text-base" />
                      Enviar proposta
                    </button>
                    <button
                      onClick={onAccept}
                      disabled={accepting}
                      className="inline-flex items-center gap-2 rounded-full border border-cyan-400/22 bg-cyan-500/12 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/18 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <iconify-icon icon={accepting ? 'solar:refresh-circle-bold-duotone' : 'solar:hand-shake-bold-duotone'} class="text-base" />
                      {accepting ? 'Fechando match...' : acceptLabel}
                    </button>
                  </>
                )}
                <button
                  onClick={onOpenSmartContract}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/12 px-5 py-3 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/18"
                >
                  <iconify-icon icon="solar:play-circle-bold-duotone" class="text-base" />
                  {isMine ? 'Abrir no contrato inteligente' : 'Abrir template base'}
                </button>
              </div>
            </aside>
          </div>
        </article>
      </div>
    </div>
  );
}

function OpportunityDetailModal({
  opportunity,
  currentUserId,
  onClose,
  onAccept,
  accepting,
  onOpenSmartContract,
  onOpenPage,
  onShareWhatsApp,
  onSendProposal,
  onAcceptProposal,
  onWithdrawProposal,
  pendingAcceptProposalId,
}: {
  opportunity: SmartContractOpportunity;
  currentUserId: string | null;
  onClose: () => void;
  onAccept: () => void;
  accepting: boolean;
  onOpenSmartContract: () => void;
  onOpenPage: () => void;
  onShareWhatsApp: () => void;
  onSendProposal: () => void;
  onAcceptProposal: (proposal: OpportunityProposal) => void;
  onWithdrawProposal: (proposal: OpportunityProposal) => void;
  pendingAcceptProposalId: string | null;
}) {
  const template = SMART_CONTRACT_TEMPLATES.find((candidate) => candidate.id === opportunity.templateId) ?? SMART_CONTRACT_TEMPLATES[0];
  const visual = getSmartContractVisual(template);
  const category = CATEGORIES.find((candidate) => candidate.id === template.category);
  const metadata = getOpportunityMetadata(opportunity);
  const isMine = currentUserId === opportunity.ownerId;
  const acceptLabel = getOpportunityAcceptLabel(opportunity);
  const { data: proposals = [] } = useOpportunityProposals(opportunity.id);
  const activeProposalsCount = countActiveProposals(proposals);
  const deadline = formatDeadline(opportunity.expiresAt);
  const detailPoints = metadata.detailPoints.length > 0
    ? metadata.detailPoints
    : [
      'Definir as partes, o escopo e a forma de aceite.',
      'Travar a remuneração ou o marco financeiro no template escolhido.',
      'Executar a oportunidade com liberação programada conforme a regra combinada.',
    ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/85 p-3 backdrop-blur-md sm:p-5"
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.96 }}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[34px] border border-white/10 bg-neutral-950 shadow-[0_40px_120px_rgba(0,0,0,0.58)]"
      >
        <div className="grid max-h-[92vh] overflow-y-auto lg:grid-cols-[1.1fr_0.9fr]">
          <div className={`relative min-h-[380px] bg-gradient-to-br ${visual.accentGradient} p-6 sm:p-8`}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.15),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(0,0,0,0.3),transparent_36%)]" />
            <div className="relative flex h-full flex-col justify-between">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/15 bg-black/18 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white">
                    {opportunity.opportunityType === 'request' ? 'Demanda publicada' : 'Disponibilidade publicada'}
                  </span>
                  {metadata.urgency && (
                    <span className="rounded-full border border-amber-200/25 bg-amber-950/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-100">
                      {metadata.urgency}
                    </span>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-white/70 transition hover:text-white"
                >
                  <iconify-icon icon="solar:close-circle-linear" class="text-2xl" />
                </button>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">{metadata.heroLabel || opportunity.serviceCategory}</p>
                <h2 className="mt-4 text-4xl font-bold leading-tight text-white font-bricolage sm:text-5xl">{opportunity.title}</h2>
                <p className="mt-4 max-w-xl text-sm leading-7 text-white/82 sm:text-base">{opportunity.summary}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <OpportunityHeroMetric label="Valor" value={formatOpportunityReward(opportunity)} />
                <OpportunityHeroMetric label="Template" value={template.shortName || template.name} />
                <OpportunityHeroMetric label="Categoria" value={category?.label || opportunity.serviceCategory} />
              </div>
            </div>
          </div>

          <div className="space-y-6 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-sm font-bold text-white">
                {opportunity.ownerAvatarUrl
                  ? <img src={opportunity.ownerAvatarUrl} alt={opportunity.ownerName} className="h-full w-full object-cover" />
                  : opportunity.ownerName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <Link to={`/@${opportunity.ownerHandle}`} onClick={onClose} className="truncate text-sm font-semibold text-white hover:underline">
                  {opportunity.ownerName}
                </Link>
                <p className="truncate text-xs text-neutral-500">@{opportunity.ownerHandle}{opportunity.ownerJobTitle ? ` · ${opportunity.ownerJobTitle}` : ''}</p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-5">
              <p className="text-[10px] uppercase tracking-[0.22em] text-neutral-500">Visão de post</p>
              <p className="mt-3 text-sm leading-7 text-neutral-300">{metadata.socialCaption || opportunity.summary}</p>
            </div>

            <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-5">
              <p className="text-[10px] uppercase tracking-[0.22em] text-neutral-500">Como essa oportunidade roda</p>
              <ul className="mt-4 space-y-3">
                {detailPoints.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-sm leading-7 text-neutral-300">
                    <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-emerald-400/85" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[11px] text-neutral-300">{opportunity.serviceCategory}</span>
              <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[11px] text-neutral-400">{PAYOUT_COPY[opportunity.payoutMode]}</span>
              <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[11px] text-neutral-400">{ENGAGEMENT_COPY[opportunity.engagementType]}</span>
              <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[11px] text-neutral-400">{opportunity.remoteAllowed ? 'Aceita remoto' : 'Execução presencial'}</span>
              {opportunity.location && (
                <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[11px] text-neutral-400">{opportunity.location}</span>
              )}
            </div>

            <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-neutral-500">Propostas recebidas</p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {activeProposalsCount > 0
                      ? `${activeProposalsCount} aberta${activeProposalsCount !== 1 ? 's' : ''}`
                      : 'Nenhuma proposta ainda'}
                  </p>
                </div>
                {deadline && (
                  <span className={`inline-flex items-center gap-1.5 text-xs ${
                    deadline.tone === 'urgent' ? 'text-rose-300' :
                    deadline.tone === 'soon' ? 'text-amber-300' :
                    deadline.tone === 'expired' ? 'text-neutral-500' :
                    'text-neutral-400'
                  }`}>
                    <iconify-icon icon="solar:clock-circle-bold-duotone" class="text-sm" />
                    {deadline.label}
                  </span>
                )}
              </div>

              {proposals.length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {proposals.map((proposal) => {
                    const isMyProposal = proposal.proposerId === currentUserId;
                    const isAccepted = proposal.status === 'accepted';
                    const isRejected = proposal.status === 'rejected';
                    const isWithdrawn = proposal.status === 'withdrawn';
                    const isPending = proposal.status === 'pending';
                    const cardTone = isAccepted
                      ? 'border-emerald-400/40 bg-emerald-500/8'
                      : isRejected || isWithdrawn
                        ? 'border-white/8 bg-white/[0.02] opacity-60'
                        : 'border-white/10 bg-white/[0.03]';

                    return (
                      <li key={proposal.id} className={`rounded-2xl border p-4 ${cardTone}`}>
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <Link
                            to={`/@${proposal.proposerHandle}`}
                            onClick={onClose}
                            className="flex items-center gap-3 min-w-0"
                          >
                            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-xs font-bold text-white">
                              {proposal.proposerAvatarUrl
                                ? <img src={proposal.proposerAvatarUrl} alt={proposal.proposerName} className="h-full w-full object-cover" />
                                : proposal.proposerName.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-white">{proposal.proposerName}</p>
                              <p className="truncate text-[11px] text-neutral-500">
                                @{proposal.proposerHandle}{proposal.proposerJobTitle ? ` · ${proposal.proposerJobTitle}` : ''}
                              </p>
                            </div>
                          </Link>
                          <div className="text-right">
                            <p className="text-base font-bold font-bricolage text-emerald-300">{formatProposalAmount(proposal)}</p>
                            <p className="text-[10px] uppercase tracking-[0.22em] text-neutral-500">{formatRelativeTime(proposal.createdAt)}</p>
                          </div>
                        </div>

                        {proposal.note && (
                          <p className="mt-3 text-sm leading-6 text-neutral-300">{proposal.note}</p>
                        )}

                        <div className="mt-3 flex items-center gap-2 flex-wrap">
                          {proposal.proposerTrustScore > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/18 bg-cyan-500/8 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-cyan-200">
                              <iconify-icon icon="solar:shield-check-bold-duotone" class="text-xs" />
                              Trust {proposal.proposerTrustScore}
                            </span>
                          )}
                          {proposal.proposerVerificationLevel === 'kyc' && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/18 bg-emerald-500/8 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-emerald-200">
                              <iconify-icon icon="solar:verified-check-bold-duotone" class="text-xs" />
                              KYC
                            </span>
                          )}
                          {isAccepted && (
                            <span className="rounded-full border border-emerald-400/24 bg-emerald-500/14 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                              Proposta aceita
                            </span>
                          )}
                          {isRejected && (
                            <span className="rounded-full border border-white/12 bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                              Recusada
                            </span>
                          )}
                          {isWithdrawn && (
                            <span className="rounded-full border border-white/12 bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                              Retirada
                            </span>
                          )}
                        </div>

                        {isPending && (isMine || isMyProposal) && (
                          <div className="mt-3 flex items-center gap-2 flex-wrap">
                            {isMine && (
                              <button
                                onClick={() => onAcceptProposal(proposal)}
                                disabled={pendingAcceptProposalId === proposal.id}
                                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/24 bg-emerald-500/14 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-60"
                              >
                                <iconify-icon icon="solar:check-circle-bold-duotone" class="text-sm" />
                                {pendingAcceptProposalId === proposal.id ? 'Aceitando...' : 'Aceitar esta proposta'}
                              </button>
                            )}
                            {isMyProposal && (
                              <button
                                onClick={() => onWithdrawProposal(proposal)}
                                className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:bg-white/[0.08]"
                              >
                                <iconify-icon icon="solar:trash-bin-trash-bold-duotone" class="text-sm" />
                                Retirar minha proposta
                              </button>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-4 text-xs text-neutral-500">
                  {isMine
                    ? 'Quando alguém enviar uma proposta, ela aparece aqui pública e você escolhe com quem fechar.'
                    : 'Ainda ninguém enviou proposta. Seja o primeiro.'}
                </p>
              )}

              {!isMine && (
                <button
                  onClick={onSendProposal}
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/22 bg-cyan-500/12 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/18"
                >
                  <iconify-icon icon="solar:document-add-bold-duotone" class="text-base" />
                  Enviar proposta
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap pt-2">
              <button
                onClick={onOpenPage}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-neutral-200 transition hover:bg-white/[0.06]"
              >
                <iconify-icon icon="solar:document-text-bold-duotone" class="text-base" />
                Ver página completa
              </button>
              <button
                onClick={onShareWhatsApp}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/12 px-5 py-3 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/18"
              >
                <iconify-icon icon="mdi:whatsapp" class="text-base" />
                Compartilhar WhatsApp
              </button>
              {!isMine && (
                <button
                  onClick={onAccept}
                  disabled={accepting}
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-400/22 bg-cyan-500/12 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/18 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <iconify-icon icon={accepting ? 'solar:refresh-circle-bold-duotone' : 'solar:hand-shake-bold-duotone'} class="text-base" />
                  {accepting ? 'Fechando match...' : acceptLabel}
                </button>
              )}
              <button
                onClick={onOpenSmartContract}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/12 px-5 py-3 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/18"
              >
                <iconify-icon icon="solar:play-circle-bold-duotone" class="text-base" />
                {isMine ? 'Abrir no contrato inteligente' : 'Abrir template base'}
              </button>
              <Link
                to={`/@${opportunity.ownerHandle}`}
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-neutral-200 transition hover:bg-white/[0.06]"
              >
                <iconify-icon icon="solar:user-id-bold-duotone" class="text-base" />
                Ver perfil público
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function getOpportunityMetadata(opportunity: SmartContractOpportunity): Required<OpportunityMetadata> {
  const metadata = opportunity.metadata as OpportunityMetadata;
  return {
    heroLabel: metadata.heroLabel || opportunity.serviceCategory,
    socialCaption: metadata.socialCaption || opportunity.summary,
    detailPoints: Array.isArray(metadata.detailPoints) ? metadata.detailPoints.filter(Boolean) : [],
    urgency: metadata.urgency || '',
    bonusLabel: metadata.bonusLabel || '',
  };
}

function OpportunityComposerModal({
  loading,
  onClose,
  onSubmit,
}: {
  loading: boolean;
  onClose: () => void;
  onSubmit: (form: typeof DEFAULT_FORM) => Promise<void>;
}) {
  const [form, setForm] = useState(DEFAULT_FORM);

  const templateOptions = useMemo(
    () => [...SMART_CONTRACT_TEMPLATES].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR')),
    [],
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/85 p-4 backdrop-blur-md"
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.96 }}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-3xl overflow-hidden rounded-[30px] border border-white/10 bg-neutral-950 shadow-[0_32px_120px_rgba(0,0,0,0.55)]"
      >
        <div className="border-b border-white/6 p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Nova oportunidade</p>
              <h2 className="mt-2 text-2xl font-bold text-white font-bricolage">Publicar no feed de contratos inteligentes</h2>
              <p className="mt-2 text-sm leading-7 text-neutral-400">Defina a demanda ou a disponibilidade. O card vira ponto de entrada para um contrato programável no catálogo.</p>
            </div>
            <button
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-neutral-500 transition-colors hover:text-white"
              aria-label="Fechar"
            >
              <iconify-icon icon="solar:close-circle-linear" class="text-2xl" />
            </button>
          </div>
        </div>

        <div className="space-y-5 p-6 sm:p-7">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo da oportunidade">
              <select
                value={form.opportunityType}
                onChange={(event) => setForm((current) => ({ ...current, opportunityType: event.target.value as OpportunityType }))}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/40"
              >
                <option value="request">Quero contratar / preciso de execução</option>
                <option value="offer">Quero ser contratado / estou disponível</option>
              </select>
            </Field>

            <Field label="Template de contrato">
              <select
                value={form.templateId}
                onChange={(event) => setForm((current) => ({ ...current, templateId: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/40"
              >
                {templateOptions.map((template) => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Título da oportunidade">
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Ex: Procuro engenheiro para laudo estrutural com pagamento por etapa"
              className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-emerald-500/40"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
            <Field label="Serviço / nicho">
              <input
                value={form.serviceCategory}
                onChange={(event) => setForm((current) => ({ ...current, serviceCategory: event.target.value }))}
                placeholder="Serralheria, engenharia, manutenção elétrica, consultoria..."
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-emerald-500/40"
              />
            </Field>
            <Field label="Local / região">
              <input
                value={form.location}
                onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                placeholder="São Paulo, remoto, híbrido"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-emerald-500/40"
              />
            </Field>
          </div>

          <Field label="Resumo do que será executado">
            <textarea
              value={form.summary}
              onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
              placeholder="Explique entregas, resultado esperado, como a outra parte recebe o valor e qualquer regra crítica do acordo."
              rows={4}
              className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-emerald-500/40 resize-none"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-4">
            <Field label={getValueLabel({ opportunityType: form.opportunityType })}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.rewardAmount}
                onChange={(event) => setForm((current) => ({ ...current, rewardAmount: event.target.value }))}
                placeholder="0"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-emerald-500/40"
              />
            </Field>
            <Field label="Ativo">
              <input
                value={form.rewardAsset}
                onChange={(event) => setForm((current) => ({ ...current, rewardAsset: event.target.value.toUpperCase() }))}
                placeholder="BRZ"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-emerald-500/40"
              />
            </Field>
            <Field label="Pagamento">
              <select
                value={form.payoutMode}
                onChange={(event) => setForm((current) => ({ ...current, payoutMode: event.target.value as OpportunityPayoutMode }))}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/40"
              >
                <option value="fixed">Valor fechado</option>
                <option value="milestone">Por etapa</option>
                <option value="hourly">Por hora</option>
                <option value="success_fee">Por resultado</option>
              </select>
            </Field>
            <Field label="Formato">
              <select
                value={form.engagementType}
                onChange={(event) => setForm((current) => ({ ...current, engagementType: event.target.value as OpportunityEngagementType }))}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/40"
              >
                <option value="one_off">Pontual</option>
                <option value="recurring">Recorrente</option>
                <option value="milestone">Por marcos</option>
              </select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-neutral-300">
              <input
                type="checkbox"
                checked={form.remoteAllowed}
                onChange={(event) => setForm((current) => ({ ...current, remoteAllowed: event.target.checked }))}
                className="h-4 w-4 rounded border-white/20 bg-black/30 text-emerald-500"
              />
              Aceita execução remota ou híbrida
            </label>
            <Field label="Prazo de encerramento">
              <input
                type="date"
                value={form.expiresAt}
                onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/40"
              />
            </Field>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/6 px-6 py-5 sm:px-7">
          <p className="text-xs text-neutral-500">O valor publicado vira referência pública. Outros usuários podem aceitar pelo valor ou enviar propostas diferentes até o prazo de encerramento.</p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-neutral-300 hover:bg-white/[0.06]"
            >
              Cancelar
            </button>
            <button
              onClick={() => onSubmit(form)}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/12 px-5 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/18 disabled:opacity-60"
            >
              {loading
                ? <iconify-icon icon="svg-spinners:ring-resize" class="text-base" />
                : <iconify-icon icon="solar:rocket-bold-duotone" class="text-base" />}
              Publicar no feed
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SendProposalModal({
  opportunity,
  onClose,
  onSubmit,
  submitting,
}: {
  opportunity: SmartContractOpportunity;
  onClose: () => void;
  onSubmit: (amount: number, note: string) => Promise<void>;
  submitting: boolean;
}) {
  const initialAmount = opportunity.rewardAmount ? String(opportunity.rewardAmount) : '';
  const [amount, setAmount] = useState(initialAmount);
  const [note, setNote] = useState('');

  const directionCopy = opportunity.opportunityType === 'request'
    ? {
        title: 'Enviar proposta como executor',
        body: 'Você está propondo executar essa oportunidade. O autor publicou que está disposto a pagar até o valor de referência — sua proposta pode ser igual, menor (mais competitiva) ou maior (justificada na nota).',
        valueLabel: 'Quanto você cobra',
        valueHint: opportunity.rewardAmount
          ? `Autor está disposto a pagar até ${formatOpportunityReward(opportunity)}`
          : 'Valor a combinar — você define o piso',
        noteHint: 'Ex: prazo de entrega, escopo coberto, garantia.',
      }
    : {
        title: 'Enviar proposta como contratante',
        body: 'Você está propondo contratar essa pessoa. O autor publicou que aceita receber a partir do valor de referência — sua proposta pode ser igual, maior (mais competitiva) ou menor (justificada na nota).',
        valueLabel: 'Quanto você paga',
        valueHint: opportunity.rewardAmount
          ? `Autor pede a partir de ${formatOpportunityReward(opportunity)}`
          : 'Valor a combinar',
        noteHint: 'Ex: cronograma, volume previsto, condições.',
      };

  const numericAmount = Number(amount);
  const canSubmit = !submitting && amount.trim().length > 0 && Number.isFinite(numericAmount) && numericAmount > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/85 p-4 backdrop-blur-md"
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.96 }}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-[30px] border border-white/10 bg-neutral-950 shadow-[0_32px_120px_rgba(0,0,0,0.55)]"
      >
        <div className="border-b border-white/6 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Nova proposta</p>
              <h2 className="mt-2 text-2xl font-bold text-white font-bricolage">{directionCopy.title}</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-400">{directionCopy.body}</p>
            </div>
            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-neutral-500 transition hover:text-white"
              aria-label="Fechar"
            >
              <iconify-icon icon="solar:close-circle-linear" class="text-2xl" />
            </button>
          </div>
        </div>

        <div className="space-y-5 p-6">
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-neutral-500">Oportunidade</p>
            <p className="mt-1 text-sm font-semibold text-white">{opportunity.title}</p>
            <p className="mt-1 text-xs text-neutral-500">@{opportunity.ownerHandle} · {opportunity.serviceCategory}</p>
          </div>

          <Field label={directionCopy.valueLabel}>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                min="0"
                step="0.01"
                placeholder="0"
                className="flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-lg font-semibold font-bricolage text-white outline-none focus:border-cyan-500/40"
                autoFocus
              />
              <span className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-semibold text-neutral-300">
                {opportunity.rewardAsset}
              </span>
            </div>
            <p className="mt-2 text-[11px] text-neutral-500">{directionCopy.valueHint}</p>
          </Field>

          <Field label="Nota opcional">
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder={directionCopy.noteHint}
              className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-cyan-500/40 resize-none"
            />
          </Field>

          <div className="rounded-2xl border border-amber-200/12 bg-amber-500/6 p-3">
            <p className="text-[11px] leading-5 text-amber-100/80">
              <iconify-icon icon="solar:info-circle-bold-duotone" class="mr-1.5 align-text-bottom text-sm" />
              Sua proposta fica pública na página do contrato. O autor escolhe com quem fechar.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-white/6 pt-4">
            <button
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-neutral-300 transition hover:bg-white/[0.06]"
            >
              Cancelar
            </button>
            <button
              onClick={() => { if (canSubmit) onSubmit(numericAmount, note); }}
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded-full border border-cyan-400/22 bg-cyan-500/12 px-5 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/18 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting
                ? <iconify-icon icon="svg-spinners:ring-resize" class="text-base" />
                : <iconify-icon icon="solar:document-add-bold-duotone" class="text-base" />}
              Enviar proposta
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{label}</span>
      {children}
    </label>
  );
}
