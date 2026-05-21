import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  SMART_CONTRACT_TEMPLATES,
  CATEGORIES,
  type SmartContractTemplate,
  type SmartContractCategory,
} from '@/services/smartContractTemplates';
import SmartContractEditor from '@/components/SmartContractEditor';

export default function SmartContractsPage() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<SmartContractCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<SmartContractTemplate | null>(null);

  const filteredTemplates = useMemo(() => {
    return SMART_CONTRACT_TEMPLATES.filter(t => {
      const matchCategory = selectedCategory === 'all' || t.category === selectedCategory;
      const matchSearch = !searchQuery ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.useCases.some(u => u.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCategory && matchSearch;
    });
  }, [selectedCategory, searchQuery]);

  const featuredTemplates = SMART_CONTRACT_TEMPLATES.filter(t => t.isFullyImplemented);

  if (editingTemplate) {
    return (
      <SmartContractEditor
        template={editingTemplate}
        onClose={() => setEditingTemplate(null)}
        onDeployed={(contractId) => navigate(`/contracts/${contractId}`)}
      />
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-fuchsia-500/10 via-neutral-900 to-emerald-500/10 p-8">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-fuchsia-500/15 border border-fuchsia-500/30 text-fuchsia-300 text-xs font-bold mb-3">
              <iconify-icon icon="solar:cpu-bolt-bold-duotone" class="text-base" />
              SMART CONTRACT DESCOMPLICADO
            </div>
            <h1 className="text-3xl font-bold font-bricolage text-white mb-2">
              Dinheiro programável <span className="text-fuchsia-400">simples e fácil</span>.
            </h1>
            <p className="text-neutral-400 leading-relaxed">
              Esqueça chaves públicas. Identifique as partes do contrato pelo <strong className="text-fuchsia-300">@usuário</strong> —
              como mandar mensagem no WhatsApp. Nossa IA traduz tudo em código Soroban auditável e explica em português o que cada contrato faz.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium">
                <span>@lucas</span>
              </span>
              <span className="text-neutral-600 text-xs self-center">paga</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-medium">
                <span>@acme</span>
              </span>
              <span className="text-neutral-600 text-xs self-center">via</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/30 text-fuchsia-300 text-xs font-bold">
                <iconify-icon icon="solar:cpu-bolt-bold" />
                Smart Contract
              </span>
              <span className="text-neutral-600 text-xs self-center">— sem chave pública.</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-2 text-neutral-300">
              <iconify-icon icon="solar:at-bold-duotone" class="text-fuchsia-400" />
              <span>Partes por <strong>@handle</strong>, não G...</span>
            </div>
            <div className="flex items-center gap-2 text-neutral-300">
              <iconify-icon icon="solar:magic-stick-3-bold" class="text-emerald-400" />
              <span>IA traduz <strong>natural → código</strong></span>
            </div>
            <div className="flex items-center gap-2 text-neutral-300">
              <iconify-icon icon="solar:shield-check-bold" class="text-blue-400" />
              <span>Deploy direto na <strong>Stellar</strong></span>
            </div>
          </div>
        </div>

        {/* Decorative gradient orb */}
        <div className="absolute -right-20 -top-20 w-72 h-72 bg-fuchsia-500/20 rounded-full blur-3xl" />
        <div className="absolute -left-10 -bottom-10 w-60 h-60 bg-emerald-500/15 rounded-full blur-3xl" />
      </div>

      {/* Search + Categories */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 bg-neutral-900 border border-white/10 rounded-xl px-3 py-2 flex-1">
          <iconify-icon icon="solar:magnifer-bold" class="text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar template (ex: escrow, aluguel, vakinha...)"
            className="bg-transparent text-sm text-white outline-none flex-1 placeholder:text-neutral-600"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-neutral-500 hover:text-white">
              <iconify-icon icon="solar:close-circle-bold" />
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {CATEGORIES.map(cat => {
          const count = cat.id === 'all'
            ? SMART_CONTRACT_TEMPLATES.length
            : SMART_CONTRACT_TEMPLATES.filter(t => t.category === cat.id).length;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30'
                  : 'bg-neutral-900 text-neutral-400 border border-white/5 hover:border-white/20 hover:text-white'
              }`}
            >
              <span className="text-base">{cat.icon}</span>
              {cat.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-md ${
                selectedCategory === cat.id ? 'bg-fuchsia-500/20' : 'bg-neutral-800'
              }`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Featured banner */}
      {selectedCategory === 'all' && !searchQuery && (
        <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <iconify-icon icon="solar:star-bold" class="text-amber-400" />
            <h3 className="text-sm font-bold text-white">Recomendados — implementação completa</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {featuredTemplates.map(t => (
              <FeaturedCard key={t.id} template={t} onClick={() => setEditingTemplate(t)} />
            ))}
          </div>
        </div>
      )}

      {/* All templates grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white">
            {searchQuery ? `Resultados para "${searchQuery}"` :
              selectedCategory === 'all' ? 'Todos os templates' :
                CATEGORIES.find(c => c.id === selectedCategory)?.label}
            <span className="text-neutral-500 font-normal ml-2">({filteredTemplates.length})</span>
          </h3>
        </div>

        <AnimatePresence mode="popLayout">
          {filteredTemplates.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16 bg-neutral-900/30 border border-white/5 rounded-2xl"
            >
              <iconify-icon icon="solar:ghost-bold-duotone" class="text-5xl text-neutral-700 mb-3" />
              <p className="text-neutral-400">Nenhum template encontrado.</p>
              <button onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }} className="text-fuchsia-400 hover:text-fuchsia-300 text-sm mt-2">
                Limpar filtros
              </button>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredTemplates.map((t, i) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  index={i}
                  onClick={() => setEditingTemplate(t)}
                />
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Card components ──────────────────────────────────────────────

function FeaturedCard({ template, onClick }: { template: SmartContractTemplate; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-gradient-to-br from-fuchsia-500/10 to-neutral-900 border border-fuchsia-500/20 rounded-xl p-4 hover:border-fuchsia-500/40 hover:scale-[1.02] transition-all group"
    >
      <div className="flex items-start gap-3 mb-2">
        <div className="text-3xl">{template.icon}</div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-white truncate">{template.name}</h4>
          <p className="text-xs text-neutral-400 line-clamp-2 mt-0.5">{template.description}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 text-xs text-fuchsia-400 group-hover:text-fuchsia-300">
        <iconify-icon icon="solar:magic-stick-3-bold" />
        Começar com IA
        <iconify-icon icon="solar:arrow-right-bold" />
      </div>
    </button>
  );
}

function TemplateCard({ template, index, onClick }: {
  template: SmartContractTemplate;
  index: number;
  onClick: () => void;
}) {
  const categoryMeta = CATEGORIES.find(c => c.id === template.category);
  const difficultyColors = {
    'Iniciante': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'Intermediário': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'Avançado': 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3) }}
      onClick={onClick}
      className="text-left bg-neutral-900 border border-white/10 rounded-2xl p-5 hover:border-fuchsia-500/30 hover:bg-neutral-900/80 transition-all group flex flex-col"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="text-4xl">{template.icon}</div>
        {!template.isFullyImplemented && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-500 border border-white/5">
            BETA
          </span>
        )}
      </div>

      <h4 className="text-base font-bold text-white mb-1 leading-snug">{template.name}</h4>
      <p className="text-xs text-neutral-400 line-clamp-2 mb-3 flex-1">{template.description}</p>

      <div className="flex items-center gap-1 mb-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`w-1 h-3 rounded-sm ${i < template.popularity ? 'bg-fuchsia-500' : 'bg-neutral-800'}`}
          />
        ))}
        <span className="text-[10px] text-neutral-500 ml-1">popular</span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${difficultyColors[template.difficulty]}`}>
          {template.difficulty}
        </span>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-400 flex items-center gap-1">
          <span>{categoryMeta?.icon}</span>
          {categoryMeta?.label}
        </span>
      </div>

      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
        <span className="text-neutral-500">{template.variables.length} campos</span>
        <span className="text-fuchsia-400 flex items-center gap-1 font-medium group-hover:gap-2 transition-all">
          Criar
          <iconify-icon icon="solar:arrow-right-bold" />
        </span>
      </div>
    </motion.button>
  );
}
