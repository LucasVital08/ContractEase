import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { useContracts } from '@/hooks/useContractQueries';
import { useOpportunityFeed } from '@/hooks/useOpportunityQueries';
import { useAuthStore, useNotificationStore } from '@/stores';
import type { Contract } from '@/types';
import { api, signingService } from '@/services/supabaseService';
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
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 30 }}
    >
      <Link
        to={to}
        className="group relative flex flex-col overflow-hidden rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015))] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.18)] transition-all hover:-translate-y-0.5 hover:border-cyan-400/16 hover:bg-[linear-gradient(180deg,rgba(16,185,129,0.055),rgba(255,255,255,0.018))]"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/45 to-transparent opacity-70" />
        <div className="absolute -right-10 top-8 h-28 w-28 rounded-full bg-cyan-400/8 blur-3xl transition-opacity group-hover:opacity-90" />

        <div className="relative z-10 mb-3 flex items-start justify-between">
          <motion.div
            className={`flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8 ${bg} transition-transform`}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
          >
            <iconify-icon icon={icon} class={`text-xl ${color}`} />
          </motion.div>
          <motion.div
            animate={{ x: 0, opacity: 0 }}
            whileHover={{ x: 4, opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <iconify-icon icon="solar:arrow-right-up-bold" class={`text-neutral-600 group-hover:text-neutral-400 text-sm transition-colors`} />
          </motion.div>
        </div>

        <div className="relative z-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">{title}</p>
          <motion.h4
            className="mt-3 text-3xl font-bold text-white font-bricolage"
            animate={{ y: 0 }}
            whileHover={{ y: -2 }}
          >
            {value}
          </motion.h4>
          {subtext && <p className="mt-2 text-xs leading-5 text-neutral-500">{subtext}</p>}
        </div>
      </Link>
    </motion.div>
  );
}

function RecentRow({ contract }: { contract: Contract }) {
  const statusMap: Record<string, { label: string; cls: string }> = {
    active: { label: 'Ativo', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    pending: { label: 'Pendente', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    completed: { label: 'Concluído', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    draft: { label: 'Rascunho', cls: 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30' },
    cancelled: { label: 'Cancelado', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
    archived: { label: 'Arquivado', cls: 'bg-neutral-600/20 text-neutral-500 border-neutral-600/30' },
  };
  const s = statusMap[contract.status] ?? statusMap.draft;
  const smart = isSmartContract(contract);

  return (
    <Link to={`/contracts/${contract.id}`} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] px-2 -mx-2 rounded-lg transition-colors">
      <div className="flex items-center gap-3">
        <span className="text-emerald-500 font-mono text-xs">{contract.id}</span>
        <span className="text-white text-sm font-medium">{contract.title}</span>
        {smart && (
          <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[10px] font-bold uppercase tracking-wide">
            Inteligente
          </span>
        )}
        {contract.stellarTxHash && (
          <iconify-icon icon="solar:shield-check-bold" class="text-emerald-500 text-sm" />
        )}
      </div>
      <div className="flex items-center gap-4">
        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${s.cls}`}>
          {s.label}
        </span>
      </div>
    </Link>
  );
}

const DEFAULT_WIDGETS = {
  stats: true,
  blockchain: true,
  expirations: true,
  activity: true
};

export default function DashboardPage() {
  const { data: contracts = [], isLoading, error: contractsError } = useContracts();
  const { data: opportunityFeed = [] } = useOpportunityFeed({ limit: 3, status: 'open' });
  if (contractsError) console.error('[Dashboard] contracts query failed:', contractsError);
  const { user, organization } = useAuthStore();
  const notify = useNotificationStore(s => s.add);
  const [isEditing, setIsEditing] = useState(false);
  const [pendingSignatures, setPendingSignatures] = useState<any[]>([]);
  const [identitySettings, setIdentitySettings] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!user?.email) return;
    signingService.getPendingForUser(user.email).then(setPendingSignatures);
  }, [user?.email]);

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
          <h1 className="text-3xl font-bold text-white font-bricolage">Dashboard</h1>
          <p className="text-neutral-400 text-sm">Bem-vindo de volta, {user?.name?.split(' ')[0] ?? 'usuário'}!</p>
        </div>
        <button 
          onClick={() => setIsEditing(!isEditing)}
          className={`px-3 py-1.5 rounded-lg border transition-all flex items-center gap-2 text-xs font-bold ${
            isEditing 
              ? 'bg-emerald-500 border-emerald-400 text-black' 
              : 'bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10'
          }`}
        >
          <iconify-icon icon={isEditing ? 'solar:check-read-bold' : 'solar:widget-add-bold'} />
          {isEditing ? 'Salvar Layout' : 'Customizar Painel'}
        </button>
      </div>

      {user && (
        <ProfileStrip
          user={user}
          organizationName={organization?.name}
          jobTitle={identitySettings.jobTitle}
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
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-wrap gap-4 items-center">
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mr-2">Widgets Disponíveis:</p>
              {Object.keys(DEFAULT_WIDGETS).map((id) => (
                <button
                  key={id}
                  onClick={() => toggleWidget(id as any)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${
                    visibleWidgets[id as keyof typeof DEFAULT_WIDGETS]
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-white/5 border-white/10 text-neutral-500 opacity-50'
                  }`}
                >
                  <iconify-icon icon={
                    id === 'stats' ? 'solar:chart-2-bold' :
                    id === 'blockchain' ? 'solar:shield-check-bold' :
                    id === 'expirations' ? 'solar:calendar-bold' : 'solar:list-bold'
                  } />
                  {id.charAt(0).toUpperCase() + id.slice(1)}
                  {visibleWidgets[id as keyof typeof DEFAULT_WIDGETS] && <iconify-icon icon="solar:check-circle-bold" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats & AI Insight */}
      {visibleWidgets.stats && (
        <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 transition-all ${isEditing ? 'opacity-50 scale-[0.98]' : ''}`}>
          <StatCard title="Total" value={contracts.length.toString()} icon="solar:document-text-bold-duotone" color="text-neutral-300" bg="bg-white/5" to="/contracts" subtext="todos os documentos" delay={0} />
          <StatCard title="Ativos" value={active.toString()} icon="solar:check-circle-bold-duotone" color="text-emerald-400" bg="bg-emerald-500/10" to="/contracts?status=active" subtext="em vigência" delay={0.04} />
          <StatCard title="Rascunhos" value={draft.toString()} icon="solar:pen-new-round-bold-duotone" color="text-neutral-400" bg="bg-white/5" to="/contracts?status=draft" subtext="aguardando revisão" delay={0.08} />
          <StatCard title="Assinatura Pendente" value={pending.toString()} icon="solar:hourglass-bold-duotone" color="text-amber-400" bg="bg-amber-500/10" to="/contracts?status=pending" subtext="aguardando partes" delay={0.12} />
          <StatCard title="Concluídos" value={completed.toString()} icon="solar:diploma-verified-bold-duotone" color="text-blue-400" bg="bg-blue-500/10" to="/contracts?status=completed" subtext="todos assinaram" delay={0.16} />
        </div>
      )}

      {smartContracts.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className={`rounded-[28px] border border-cyan-400/12 bg-[linear-gradient(180deg,rgba(8,12,16,0.96),rgba(9,14,18,0.88))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.22)] ${isEditing ? 'opacity-50 scale-[0.98]' : ''}`}>
          <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
            <div>
              <h3 className="text-lg font-bold text-white font-bricolage flex items-center gap-2">
                <iconify-icon icon="solar:code-square-bold-duotone" class="text-cyan-300 text-xl" /> Contratos Inteligentes
              </h3>
              <p className="text-xs text-neutral-400 mt-1">Leitura operacional dos fluxos programáveis: execução, pendências, rascunhos e provas ancoradas.</p>
            </div>
            <Link to="/contracts" className="text-xs text-cyan-400 hover:underline">Abrir documentos</Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: 'Total', value: smartContracts.length, tone: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20', subtext: 'contratos inteligentes' },
              { label: 'Ativos', value: smartActive, tone: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', subtext: 'em execução' },
              { label: 'Pendentes', value: smartPending, tone: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', subtext: 'pendente de ciência' },
              { label: 'Rascunhos', value: smartDraft, tone: 'text-neutral-300', bg: 'bg-white/5 border-white/10', subtext: 'ainda não publicados' },
              { label: 'Ancorados', value: smartAnchored, tone: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', subtext: 'com hash na Stellar' },
            ].map(card => (
              <div key={card.label} className={`rounded-2xl border p-4 ${card.bg}`}>
                <p className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1">{card.label}</p>
                <p className={`text-2xl font-bold ${card.tone}`}>{card.value}</p>
                <p className="text-[11px] text-neutral-500 mt-1">{card.subtext}</p>
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
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className={`bg-gradient-to-r from-emerald-500/5 to-cyan-500/5 border border-emerald-500/10 rounded-2xl p-6 ${isEditing ? 'opacity-50 scale-[0.98]' : ''}`}>
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-emerald-500/10 rounded-xl">
              <iconify-icon icon="solar:shield-network-bold-duotone" class="text-2xl text-emerald-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-bricolage">Stellar Blockchain</h3>
              <p className="text-xs text-neutral-400">Testnet · Proof of Existence</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-black/30 rounded-xl p-4 border border-white/5">
              <p className="text-xs text-neutral-500 mb-1">Documentos Ancorados</p>
              <p className="text-2xl font-bold text-emerald-400 font-bricolage">{anchored}</p>
            </div>
            <div className="bg-black/30 rounded-xl p-4 border border-white/5">
              <p className="text-xs text-neutral-500 mb-1">Assinaturas Coletadas</p>
              <p className="text-2xl font-bold text-blue-400 font-bricolage">{totalSignatures}</p>
            </div>
            <div className="bg-black/30 rounded-xl p-4 border border-white/5">
              <p className="text-xs text-neutral-500 mb-1">Taxa de Ancoragem</p>
              <p className="text-2xl font-bold text-amber-400 font-bricolage">
                {contracts.length > 0 ? Math.round((anchored / contracts.length) * 100) : 0}%
              </p>
            </div>
            <div className="bg-black/30 rounded-xl p-4 border border-white/5">
              <p className="text-xs text-neutral-500 mb-1">Rede</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-sm font-semibold text-emerald-400">Testnet Ativa</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Pending signatures for current user */}
      {pendingSignatures.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-500/10 rounded-xl">
              <iconify-icon icon="solar:pen-bold-duotone" class="text-xl text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-bricolage">Aguardando sua Assinatura</h3>
              <p className="text-xs text-neutral-400">{pendingSignatures.length} documento(s) aguardam sua assinatura eletrônica.</p>
            </div>
          </div>
          <div className="space-y-2">
            {pendingSignatures.map((party: any) => (
              <Link
                key={party.id}
                to={`/contracts/${party.contract_id}`}
                className="flex items-center justify-between p-3 bg-black/30 border border-white/5 rounded-xl hover:border-emerald-500/30 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 border border-emerald-500/20 flex items-center justify-center">
                    <iconify-icon icon="solar:document-text-bold" class="text-emerald-400 text-sm" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm text-white font-medium group-hover:text-emerald-400 transition-colors">
                        {(party.contracts as any)?.title ?? 'Documento'}
                      </p>
                      {isSmartContract((party.contracts as any) ?? undefined) && (
                        <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-bold uppercase tracking-wide">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent contracts */}
        {visibleWidgets.activity && (
          <div className={`bg-neutral-900 border border-white/5 rounded-2xl p-6 lg:col-span-2 ${isEditing ? 'opacity-50 scale-[0.98]' : ''}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white font-bricolage">Documentos Recentes</h3>
              <Link to="/contracts" className="text-xs text-emerald-400 hover:underline">Ver todos</Link>
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
          <div className={`bg-neutral-900 border border-white/5 rounded-2xl p-6 ${isEditing ? 'opacity-50 scale-[0.98]' : ''}`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white font-bricolage flex items-center gap-2">
                <iconify-icon icon="solar:alarm-bold" class="text-amber-500" /> Próximos Vencimentos
              </h3>
              <span className="text-[10px] text-neutral-500 uppercase font-bold">30 dias</span>
            </div>
            <div className="space-y-4">
              {contracts.filter(c => c.status === 'active').slice(0, 3).map(c => (
                <div key={c.id} className="p-3 bg-black/30 border border-white/5 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-bold text-white truncate max-w-[120px]">{c.title}</p>
                      {isSmartContract(c) && (
                        <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[9px] font-bold uppercase tracking-wide">
                          Smart
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-neutral-500">{new Date(c.expiresAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">Em breve</span>
                  </div>
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
  onCopyHandle,
}: {
  user: NonNullable<ReturnType<typeof useAuthStore.getState>['user']>;
  organizationName?: string;
  jobTitle?: string;
  onCopyHandle: () => void;
}) {
  const initials = user.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'CE';

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-white/8 bg-neutral-900/70 px-5 py-4"
    >
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-base font-bold text-white">
          {user.avatar
            ? <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
            : initials}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-bold text-white font-bricolage">{user.name}</h2>
            <span className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{user.plan || 'free'}</span>
            {user.walletAddress && (
              <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">Carteira ativa</span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-neutral-400">
            <span className="text-cyan-300">{user.handle ? `@${user.handle}` : user.email}</span>
            <span>·</span>
            <span>{organizationName || 'Espaço Pessoal'}</span>
            {jobTitle && (
              <>
                <span>·</span>
                <span>{jobTitle}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onCopyHandle}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/15"
          >
            <iconify-icon icon="solar:copy-bold" class="text-sm" />
            Copiar identidade
          </button>
          <Link
            to="/settings"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:border-white/16 hover:text-white"
          >
            <iconify-icon icon="solar:pen-2-bold" class="text-sm" />
            Editar perfil
          </Link>
        </div>
      </div>
    </motion.section>
  );
}
