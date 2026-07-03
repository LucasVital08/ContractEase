import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '@/services/api';
import {
  TEMPLATE_CATEGORIES,
  mergeVariables,
  type ContractTemplate,
  type TemplateVariable,
} from '@/services/templateEngine';
import {
  CATEGORIES as SMART_CATEGORIES,
  SMART_CONTRACT_TEMPLATES,
  type SmartContractCategory,
  type SmartContractTemplate,
} from '@/services/smartContractTemplates';

type LibraryType = 'documents' | 'smart';

export default function TemplatesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialLibraryType = searchParams.get('library') === 'smart' ? 'smart' : 'documents';

  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const [libraryType, setLibraryType] = useState<LibraryType>(initialLibraryType);
  const [showLibraryChooser, setShowLibraryChooser] = useState(() => !searchParams.has('library'));
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSmartCategory, setSelectedSmartCategory] = useState<SmartContractCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, [selectedCategory]);

  useEffect(() => {
    if (!loading) {
      setLoadingTimedOut(false);
      return;
    }

    const timer = window.setTimeout(() => setLoadingTimedOut(true), 5000);
    return () => window.clearTimeout(timer);
  }, [loading]);

  async function loadTemplates() {
    try {
      setLoading(true);
      const data = await api.templates.list(selectedCategory);
      // Normalização de snake_case para camelCase (ContractTemplate interface)
      const normalized = (data || []).map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.category,
        icon: t.icon,
        content: t.content || '',
        clauses: t.clauses || [],
        variables: t.variables || [],
        tags: t.tags || [],
        rating: Number(t.rating) || 0,
        usageCount: t.usage_count || 0,
        author: t.author || 'ContractEase',
        language: t.language || 'pt-BR',
        version: parseInt(t.version) || 1,
        createdAt: t.created_at,
        updatedAt: t.updated_at || t.created_at,
        isPublic: true,
        isFeatured: t.is_featured || false
      })) as ContractTemplate[];
      
      setTemplates(normalized);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  const selectLibraryType = (type: LibraryType) => {
    setLibraryType(type);
    setSelectedTemplate(null);
    setShowLibraryChooser(false);
    setSearchParams({ library: type });
  };

  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      const matchSearch = !searchQuery || 
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchSearch;
    });
  }, [templates, searchQuery]);

  const filteredSmartTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return SMART_CONTRACT_TEMPLATES.filter(template => {
      const matchCategory = selectedSmartCategory === 'all' || template.category === selectedSmartCategory;
      const matchSearch = !query
        || template.name.toLowerCase().includes(query)
        || template.description.toLowerCase().includes(query)
        || template.useCases.some(useCase => useCase.toLowerCase().includes(query));

      return matchCategory && matchSearch;
    });
  }, [searchQuery, selectedSmartCategory]);

  const handleSelectTemplate = (template: ContractTemplate) => {
    setSelectedTemplate(template);
    const defaults: Record<string, string> = {};
    template.variables.forEach(v => {
      if (v.defaultValue) defaults[v.name] = v.defaultValue;
    });
    setVariableValues(defaults);
    setPreviewMode(false);
  };

  const CATEGORY_TO_TYPE: Record<string, string> = {
    servico: 'service', nda: 'nda', supply: 'supply', employment: 'employment',
    rental: 'rental', real_estate: 'sale', family: 'declaration',
  };

  const handleUseTemplate = () => {
    if (!selectedTemplate) return;
    const clauses = selectedTemplate.clauses
      .filter(c => !c.conditional || variableValues[c.conditional] === 'true')
      .map(c => ({
        order: c.order,
        title: mergeVariables(c.title, variableValues),
        content: mergeVariables(c.content, variableValues),
      }));
    const title = mergeVariables(selectedTemplate.name, variableValues);
    // Navega para criação de contrato com dados do template pré-preenchidos
    // O usuário ainda pode adicionar parties, expiração, etc.
    navigate('/contracts/new', {
      state: {
        fromTemplate: true,
        title,
        description: selectedTemplate.description || '',
        type: CATEGORY_TO_TYPE[selectedTemplate.category] || 'partnership',
        clauses,
        tags: selectedTemplate.tags || [],
      },
    });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold font-bricolage text-white">Biblioteca</h2>
          <p className="text-neutral-400 mt-1">Modelos para documentos contratuais e contratos inteligentes.</p>
        </div>
        <div className="flex items-center gap-2 bg-neutral-900 border border-white/10 rounded-xl px-3 py-2 w-full sm:w-auto sm:min-w-[280px]">
          <iconify-icon icon="solar:magnifer-bold" class="text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar templates..."
            className="bg-transparent text-sm text-white outline-none flex-1 placeholder:text-neutral-600"
          />
        </div>
      </div>

      <AnimatePresence>
        {showLibraryChooser && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 14 }}
              className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-neutral-950 p-6 shadow-[0_24px_90px_rgba(0,0,0,0.55)]"
            >
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-emerald-300">Biblioteca</p>
                  <h3 className="mt-2 text-2xl font-bold text-white font-bricolage">Por onde você quer começar?</h3>
                  <p className="mt-2 text-sm leading-6 text-neutral-400">Você pode alternar entre as opções depois, dentro da própria biblioteca.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLibraryChooser(false)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 text-neutral-500 hover:bg-white/[0.05] hover:text-white"
                  title="Fechar"
                >
                  <iconify-icon icon="solar:close-circle-bold" class="text-xl" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => selectLibraryType('documents')}
                  className="group rounded-2xl border border-emerald-400/18 bg-emerald-500/8 p-5 text-left transition-all hover:border-emerald-400/34 hover:bg-emerald-500/12"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/18 bg-emerald-500/12 text-emerald-300">
                    <iconify-icon icon="solar:document-text-bold-duotone" class="text-2xl" />
                  </div>
                  <h4 className="text-base font-bold text-white">Documentos Contratuais</h4>
                  <p className="mt-2 text-sm leading-6 text-neutral-400">Templates com cláusulas, partes, assinatura digital e registro de prova na blockchain.</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-emerald-300">
                    Ver templates
                    <iconify-icon icon="solar:arrow-right-linear" class="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => selectLibraryType('smart')}
                  className="group rounded-2xl border border-cyan-400/18 bg-cyan-500/8 p-5 text-left transition-all hover:border-cyan-400/34 hover:bg-cyan-500/12"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/18 bg-cyan-500/12 text-cyan-300">
                    <iconify-icon icon="solar:cpu-bolt-bold-duotone" class="text-2xl" />
                  </div>
                  <h4 className="text-base font-bold text-white">Contratos Inteligentes</h4>
                  <p className="mt-2 text-sm leading-6 text-neutral-400">Templates com dinheiro programável, automação e execução on-chain.</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-cyan-300">
                    Ver templates
                    <iconify-icon icon="solar:arrow-right-linear" class="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {([
          { id: 'documents', label: 'Documentos Contratuais', description: 'Templates com cláusulas, partes e assinatura digital', icon: 'solar:document-text-bold-duotone' },
          { id: 'smart', label: 'Contratos Inteligentes', description: 'Templates com dinheiro programável e execução on-chain', icon: 'solar:cpu-bolt-bold-duotone' },
        ] as const).map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => selectLibraryType(tab.id)}
            className={`group rounded-2xl border p-4 text-left transition-all ${
              libraryType === tab.id
                ? 'border-emerald-400/30 bg-emerald-500/10 text-white'
                : 'border-white/8 bg-neutral-900/60 text-neutral-400 hover:border-white/14 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
                libraryType === tab.id ? 'border-emerald-400/20 bg-emerald-500/14 text-emerald-300' : 'border-white/8 bg-white/[0.03] text-neutral-500 group-hover:text-neutral-200'
              }`}>
                <iconify-icon icon={tab.icon} class="text-xl" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm">{tab.label}</p>
                <p className="mt-1 text-xs leading-5 text-neutral-500">{tab.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Categories */}
      {libraryType === 'documents' ? (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {TEMPLATE_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-neutral-900 text-neutral-400 border border-white/5 hover:border-white/20 hover:text-white'
              }`}
            >
              <iconify-icon icon={cat.icon} class="text-lg" />
              {cat.label}
            </button>
          ))}
        </div>
      ) : (
        <SmartTemplateLibrary
          templates={filteredSmartTemplates}
          selectedCategory={selectedSmartCategory}
          onSelectCategory={setSelectedSmartCategory}
          onSelectTemplate={(template) => navigate('/smart-contracts', { state: { autoSelectTemplateId: template.id } })}
        />
      )}

      {/* Grid / Detail View */}
      {libraryType === 'documents' && <AnimatePresence mode="wait">
        {selectedTemplate ? (
          <motion.div key="detail" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            {/* Back button */}
            <button onClick={() => setSelectedTemplate(null)} className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors mb-6">
              <iconify-icon icon="solar:arrow-left-bold" /> Voltar ao Marketplace
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Template Info & Variables */}
              <div className="space-y-6">
                <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <iconify-icon icon={selectedTemplate.icon} class="text-2xl text-emerald-500" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{selectedTemplate.name}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-neutral-400">v{selectedTemplate.version}</span>
                        <span className="text-xs text-neutral-500">·</span>
                        <span className="text-xs text-amber-400 flex items-center gap-1">
                          <iconify-icon icon="solar:star-bold" /> {selectedTemplate.rating}
                        </span>
                        <span className="text-xs text-neutral-500">·</span>
                        <span className="text-xs text-neutral-400">{selectedTemplate.usageCount.toLocaleString()} usos</span>
                        <span className="text-xs text-neutral-500">·</span>
                        <span className="text-xs text-neutral-400">{selectedTemplate.language}</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-neutral-400 mb-4">{selectedTemplate.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.tags.map(tag => (
                      <span key={tag} className="text-[10px] px-2 py-1 rounded-full bg-white/5 text-neutral-400 border border-white/10">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Variables Form */}
                <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6">
                  <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <iconify-icon icon="solar:tuning-4-bold" class="text-emerald-500" />
                    Variáveis do Template
                  </h4>
                  <div className="space-y-4">
                    {selectedTemplate.variables.map(v => (
                      <VariableInput
                        key={v.name}
                        variable={v}
                        value={variableValues[v.name] || ''}
                        onChange={val => setVariableValues(prev => ({ ...prev, [v.name]: val }))}
                      />
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setPreviewMode(!previewMode)}
                    className="flex-1 py-3 bg-white/5 border border-white/10 text-white font-bold rounded-xl hover:bg-white/10 transition-colors flex items-center justify-center gap-2 lg:hidden"
                  >
                    <iconify-icon icon={previewMode ? "solar:document-text-bold" : "solar:eye-bold"} />
                    {previewMode ? 'Editar Variáveis' : 'Preview'}
                  </button>
                  <button
                    type="button"
                    onClick={handleUseTemplate}
                    className="flex-1 py-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2"
                  >
                    <iconify-icon icon="solar:arrow-right-up-bold" />
                    Usar Template
                  </button>
                </div>
              </div>

              {/* Preview — sempre visível em desktop, toggled no mobile */}
              <div className={`bg-neutral-900 border border-white/10 rounded-2xl p-6 max-h-[80vh] overflow-y-auto custom-scrollbar ${previewMode ? 'block' : 'hidden lg:block'}`}>
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <iconify-icon icon="solar:document-text-bold" class="text-emerald-500" />
                    Preview do Contrato
                  </h4>
                </div>
                <div className="space-y-6">
                  {selectedTemplate.clauses
                    .filter(c => !c.conditional || variableValues[c.conditional] === 'true')
                    .map(clause => (
                      <div key={clause.order} className="border-l-2 border-emerald-500/30 pl-4">
                        <h5 className="text-sm font-bold text-white mb-2">
                          {clause.order}. {mergeVariables(clause.title, variableValues)}
                        </h5>
                        <p className="text-sm text-neutral-400 leading-relaxed text-justify">
                          {mergeVariables(clause.content, variableValues)}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {loading && !loadingTimedOut ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }, (_, index) => (
                  <motion.div
                    key={index}
                    className="h-56 rounded-2xl border border-white/5 bg-neutral-900"
                    animate={{ opacity: [0.45, 0.75, 0.45] }}
                    transition={{ duration: 1.4, repeat: Infinity, delay: index * 0.06 }}
                  />
                ))}
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-20">
                <iconify-icon icon="solar:folder-error-bold-duotone" class="text-5xl text-neutral-600 mb-4" />
                <p className="text-neutral-400">Nenhum template encontrado para esta busca.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTemplates.map(template => (
                  <motion.div
                    key={template.id}
                    whileHover={{ y: -4 }}
                    onClick={() => handleSelectTemplate(template)}
                    className="bg-neutral-900 border border-white/5 rounded-2xl p-6 hover:border-emerald-500/30 transition-all cursor-pointer group relative overflow-hidden"
                  >
                    {template.isFeatured && (
                      <div className="absolute top-3 right-3">
                        <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold">
                          ★ Destaque
                        </span>
                      </div>
                    )}
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
                      <iconify-icon icon={template.icon} class="text-2xl text-emerald-500" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">{template.name}</h3>
                    <p className="text-neutral-400 text-sm mb-4 line-clamp-2">{template.description}</p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-neutral-500">
                        <span className="flex items-center gap-1">
                          <iconify-icon icon="solar:star-bold" class="text-amber-400" /> {template.rating}
                        </span>
                        <span>{template.usageCount.toLocaleString()} usos</span>
                      </div>
                      <span className="text-xs text-neutral-500">{template.author}</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-white/5">
                      {template.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-neutral-500">
                          {tag}
                        </span>
                      ))}
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-neutral-500">
                        {template.clauses.length} cláusulas
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-neutral-500">
                        v{template.version}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>}
    </motion.div>
  );
}

function SmartTemplateLibrary({
  templates,
  selectedCategory,
  onSelectCategory,
  onSelectTemplate,
}: {
  templates: SmartContractTemplate[];
  selectedCategory: SmartContractCategory | 'all';
  onSelectCategory: (category: SmartContractCategory | 'all') => void;
  onSelectTemplate: (template: SmartContractTemplate) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {SMART_CATEGORIES.map(category => (
          <button
            key={category.id}
            onClick={() => onSelectCategory(category.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              selectedCategory === category.id
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'bg-neutral-900 text-neutral-400 border border-white/5 hover:border-white/20 hover:text-white'
            }`}
          >
            <iconify-icon icon={category.icon} class="text-lg" />
            {category.label}
          </button>
        ))}
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl">
          <iconify-icon icon="solar:folder-error-bold-duotone" class="text-5xl text-neutral-600 mb-4" />
          <p className="text-neutral-400">Nenhum template inteligente encontrado para esta busca.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map(template => (
            <motion.button
              key={template.id}
              whileHover={{ y: -4 }}
              onClick={() => onSelectTemplate(template)}
              className="bg-neutral-900 border border-white/5 rounded-2xl p-6 hover:border-cyan-500/30 transition-all cursor-pointer group text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4 group-hover:bg-cyan-500/20 transition-colors">
                <iconify-icon icon="solar:cpu-bolt-bold-duotone" class="text-2xl text-cyan-300" />
              </div>
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-cyan-300 transition-colors">{template.name}</h3>
                <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold ${
                  template.isFullyImplemented ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                }`}>
                  {template.isFullyImplemented ? 'Operacional' : 'Beta'}
                </span>
              </div>
              <p className="text-neutral-400 text-sm mb-4 line-clamp-3">{template.description}</p>

              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Campos</p>
                  <p className="mt-1 text-sm font-semibold text-white">{template.variables.length}</p>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Complexidade</p>
                  <p className="mt-1 text-sm font-semibold text-cyan-300">{template.difficulty}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-4 border-t border-white/5">
                {template.useCases.slice(0, 3).map(useCase => (
                  <span key={useCase} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-neutral-500">
                    {useCase}
                  </span>
                ))}
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Variable Input Component ---
function VariableInput({ variable, value, onChange }: { variable: TemplateVariable; value: string; onChange: (val: string) => void }) {
  if (variable.type === 'boolean') {
    return (
      <label className="flex items-center justify-between cursor-pointer group">
        <span className="text-sm text-neutral-300 group-hover:text-white transition-colors">
          {variable.label}
          {variable.required && <span className="text-red-400 ml-1">*</span>}
        </span>
        <div className="relative">
          <input
            type="checkbox"
            checked={value === 'true'}
            onChange={e => onChange(e.target.checked ? 'true' : 'false')}
            className="peer sr-only"
          />
          <div className="w-10 h-5 bg-neutral-700 rounded-full peer-checked:bg-emerald-500 transition-colors" />
          <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-5" />
        </div>
      </label>
    );
  }

  if (variable.type === 'select') {
    return (
      <div>
        <label className="block text-xs font-medium text-neutral-400 mb-1">
          {variable.label}
          {variable.required && <span className="text-red-400 ml-1">*</span>}
        </label>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-black border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
        >
          <option value="">Selecione...</option>
          {variable.options?.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-xs font-medium text-neutral-400 mb-1">
        {variable.label}
        {variable.required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <input
        type={variable.type === 'date' ? 'date' : variable.type === 'number' || variable.type === 'currency' ? 'number' : 'text'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={variable.defaultValue || `Digite ${variable.label.toLowerCase()}...`}
        className="w-full bg-black border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
      />
    </div>
  );
}
