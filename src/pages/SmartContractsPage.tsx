import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  CATEGORIES,
  SMART_CONTRACT_TEMPLATES,
  type SmartContractCategory,
  type SmartContractTemplate,
} from '@/services/smartContractTemplates';
import SmartContractEditor, { type EditorMode } from '@/components/SmartContractEditor';
import ContractCreationModeModal from '@/components/ContractCreationModeModal';
import { SmartContractGlyph, getSmartContractVisual } from '@/components/SmartContractVisual';

const CATEGORY_SHELF_COPY: Record<SmartContractCategory, string> = {
  real_estate: 'Locação, caução, temporada e operações imobiliárias programáveis.',
  payroll: 'Pagamentos recorrentes, bolsas e repasses com gatilhos previsíveis.',
  ecommerce: 'Escrow, entrega, recebimento e liberação de pagamento.',
  finance: 'Recebíveis, renda fixa, crédito e fluxos financeiros on-chain.',
  business: 'Freelancer, royalties, acordos comerciais e operações de negócio.',
  professional: 'Honorários, consultas, contabilidade e serviços profissionais.',
  construction: 'Marcos, obras, retenções e entregas por etapa.',
  automotive: 'Compra, locação, financiamento e devolução com regras claras.',
  rwa: 'Tokenização, captação, distribuição e ativos do mundo real.',
  registry: 'Registros civis e declarações com trilha auditável.',
  insurance: 'Cobertura paramétrica e disparo automático por evento.',
};

export default function SmartContractsPage() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<SmartContractCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingTemplate, setPendingTemplate] = useState<SmartContractTemplate | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<SmartContractTemplate | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>('questions');

  const filteredTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return SMART_CONTRACT_TEMPLATES.filter(template => {
      const matchCategory = selectedCategory === 'all' || template.category === selectedCategory;
      const matchSearch = !query
        || template.name.toLowerCase().includes(query)
        || template.description.toLowerCase().includes(query)
        || template.useCases.some(useCase => useCase.toLowerCase().includes(query));

      return matchCategory && matchSearch;
    });
  }, [searchQuery, selectedCategory]);

  const categoryShelves = useMemo(() => {
    return CATEGORIES
      .filter((category): category is typeof category & { id: SmartContractCategory } => category.id !== 'all')
      .map(category => ({
        ...category,
        subtitle: CATEGORY_SHELF_COPY[category.id],
        templates: filteredTemplates.filter(template => template.category === category.id),
      }))
      .filter(category => category.templates.length > 0);
  }, [filteredTemplates]);

  const quickSearches = ['aluguel', 'freelancer', 'veículo', 'tokenização'];

  if (editingTemplate) {
    return (
      <SmartContractEditor
        template={editingTemplate}
        initialMode={editorMode}
        onClose={() => setEditingTemplate(null)}
        onDeployed={(contractId) => navigate(`/contracts/${contractId}`)}
      />
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <header className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/18 bg-emerald-500/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300">
              <iconify-icon icon="solar:code-square-bold-duotone" class="text-sm" />
              Smart Contracts IA
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-white font-bricolage sm:text-4xl">
              Escolha um modelo e comece sem ruído.
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-neutral-400 sm:text-base">
              Busca simples no topo, categorias logo abaixo e contratos organizados em prateleiras horizontais para navegar como catálogo de produto.
            </p>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-neutral-950/80 px-5 py-4 backdrop-blur-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Catálogo ativo</p>
            <p className="mt-2 text-2xl font-bold text-white font-bricolage">{SMART_CONTRACT_TEMPLATES.length}</p>
            <p className="mt-1 text-xs text-neutral-500">templates organizados por categoria</p>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-neutral-950/80 p-2.5 backdrop-blur-xl">
          <div className="flex flex-col gap-3 rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/25 text-neutral-400">
                <iconify-icon icon="solar:magnifer-linear" class="text-lg" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Buscar contrato</p>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                  placeholder="Digite o tipo de contrato, profissão, caso de uso ou vertical"
                  className="mt-1 w-full bg-transparent text-sm text-white outline-none placeholder:text-neutral-600"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs font-medium text-neutral-300 hover:bg-white/[0.05] transition-colors"
                >
                  <iconify-icon icon="solar:close-circle-bold" class="text-sm" />
                  Limpar
                </button>
              )}
              <button
                onClick={() => setSelectedCategory('all')}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-400/18 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/14 transition-colors"
              >
                <iconify-icon icon="solar:widget-5-bold-duotone" class="text-sm" />
                Ver todas as categorias
              </button>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {quickSearches.map(term => (
              <button
                key={term}
                onClick={() => setSearchQuery(term)}
                className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-neutral-400 hover:text-white hover:border-white/14 transition-colors"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Filtros</p>
            <h2 className="mt-1 text-xl font-bold text-white font-bricolage">Categorias</h2>
          </div>
          <p className="text-xs text-neutral-500">
            {selectedCategory === 'all' ? 'Todas as categorias visíveis' : `Filtrando por ${CATEGORIES.find(category => category.id === selectedCategory)?.label}`}
          </p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {CATEGORIES.map(category => {
            const count = category.id === 'all'
              ? SMART_CONTRACT_TEMPLATES.length
              : SMART_CONTRACT_TEMPLATES.filter(template => template.category === category.id).length;
            const active = selectedCategory === category.id;

            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`inline-flex items-center gap-3 rounded-2xl border px-4 py-3 whitespace-nowrap transition-all ${
                  active
                    ? 'border-white/20 bg-white text-neutral-950 shadow-[0_12px_36px_rgba(255,255,255,0.08)]'
                    : 'border-white/8 bg-neutral-950/80 text-neutral-400 hover:border-white/14 hover:text-white'
                }`}
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${active ? 'border-black/8 bg-black/5 text-neutral-950' : 'border-white/8 bg-white/[0.03] text-neutral-500'}`}>
                  <iconify-icon icon={category.icon} class="text-base" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold leading-none">{category.label}</p>
                  <p className={`mt-1 text-[10px] ${active ? 'text-neutral-700' : 'text-neutral-600'}`}>{count} opções</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-8">
        <AnimatePresence mode="popLayout">
          {categoryShelves.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-[28px] border border-dashed border-white/10 bg-neutral-950/40 px-6 py-20 text-center"
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/10 bg-white/[0.03] text-neutral-600">
                <iconify-icon icon="solar:ghost-bold-duotone" class="text-3xl" />
              </div>
              <p className="text-lg font-semibold text-white">Nenhum modelo encontrado.</p>
              <p className="mt-2 text-sm text-neutral-500">Ajuste a busca ou volte para todas as categorias.</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/18 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/14 transition-colors"
              >
                <iconify-icon icon="solar:restart-bold" class="text-base" />
                Limpar filtros
              </button>
            </motion.div>
          ) : (
            categoryShelves.map(category => (
              <CategoryShelf
                key={category.id}
                category={category}
                onSelectTemplate={template => setPendingTemplate(template)}
              />
            ))
          )}
        </AnimatePresence>
      </section>

      <ContractCreationModeModal
        template={pendingTemplate}
        onSelect={mode => {
          if (!pendingTemplate) return;
          setEditorMode(mode);
          setEditingTemplate(pendingTemplate);
          setPendingTemplate(null);
        }}
        onClose={() => setPendingTemplate(null)}
      />
    </motion.div>
  );
}

function CategoryShelf({ category, onSelectTemplate }: {
  category: { id: SmartContractCategory; label: string; icon: string; subtitle: string; templates: SmartContractTemplate[] };
  onSelectTemplate: (template: SmartContractTemplate) => void;
}) {
  return (
    <motion.section layout className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
            <iconify-icon icon={category.icon} class="text-sm" />
            {category.label}
          </div>
          <h3 className="mt-1 text-2xl font-bold text-white font-bricolage">{category.label}</h3>
          <p className="mt-1 text-sm text-neutral-400">{category.subtitle}</p>
        </div>
        <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-neutral-400">
          {category.templates.length} opção{category.templates.length !== 1 ? 'ões' : ''}
        </span>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-2 scrollbar-hide">
        <div className="flex min-w-max gap-4 snap-x snap-mandatory">
          {category.templates.map((template, index) => (
            <div key={template.id} className="w-[320px] sm:w-[360px] xl:w-[380px] flex-none snap-start">
              <TemplateCard
                template={template}
                index={index}
                onClick={() => onSelectTemplate(template)}
              />
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

function TemplateCard({ template, index, onClick }: {
  template: SmartContractTemplate;
  index: number;
  onClick: () => void;
}) {
  const visual = getSmartContractVisual(template);
  const readinessLabel = template.isFullyImplemented ? 'Operacional' : 'Beta';

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.02, 0.18) }}
      onClick={onClick}
      className="group relative isolate h-full overflow-hidden rounded-[28px] border border-white/10 bg-neutral-950/95 p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:border-white/16"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${visual.accentGradient}`} />
      <div className="absolute inset-0 bg-[linear-gradient(140deg,rgba(255,255,255,0.08),transparent_34%)] opacity-70" />
      <div className="relative flex h-full flex-col">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <SmartContractGlyph template={template} size="md" />
            <div className="min-w-0">
              <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${visual.accentText}`}>{visual.categoryLabel}</p>
              <p className="mt-1 text-[11px] text-neutral-500">{template.isFullyImplemented ? 'Fluxo em operação' : 'Fluxo em calibração'}</p>
            </div>
          </div>

          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${template.isFullyImplemented ? visual.accentChip : 'border-white/10 bg-white/[0.03] text-neutral-400'}`}>
            {readinessLabel}
          </span>
        </div>

        <h4 className="text-lg font-bold leading-tight text-white font-bricolage">{template.name}</h4>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-neutral-300">{template.description}</p>

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">Complexidade</p>
            <p className={`mt-2 text-sm font-semibold ${visual.accentMetric}`}>{template.difficulty}</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">Entrada</p>
            <p className="mt-2 text-sm font-semibold text-white">{template.variables.length} campos</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {template.useCases.slice(0, 2).map(useCase => (
            <span key={useCase} className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-neutral-300">
              {useCase}
            </span>
          ))}
        </div>

        <div className="mt-auto flex items-center justify-between gap-4 border-t border-white/8 pt-5 text-xs">
          <PopularityDots score={template.popularity} tone={visual.accentStrong} />
          <span className={`inline-flex items-center gap-2 font-semibold ${visual.accentStrong}`}>
            Abrir estúdio
            <iconify-icon icon="solar:arrow-right-linear" class="text-sm transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </motion.button>
  );
}

function PopularityDots({ score, tone }: { score: number; tone: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }, (_, index) => (
          <span
            key={index}
            className={`block h-1.5 w-1.5 rounded-full ${index < score ? `${tone} bg-current` : 'bg-white/12'}`}
          />
        ))}
      </div>
      <span className="text-[11px] text-neutral-500">{score}/5</span>
    </div>
  );
}
