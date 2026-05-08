import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useContracts, useDeleteContract, useFolders, useToggleFavorite, useMoveToFolder, useCreateFolder } from '@/hooks/useContractQueries';
import { useNotificationStore } from '@/stores';
import type { Contract, ContractStatus, Folder } from '@/types';

const STATUS_MAP: Record<ContractStatus, { label: string; cls: string }> = {
  draft: { label: 'Rascunho', cls: 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30' },
  review: { label: 'Em Revisão', cls: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  pending: { label: 'Pendente', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  active: { label: 'Ativo', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  completed: { label: 'Concluído', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  cancelled: { label: 'Cancelado', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  failed: { label: 'Falhou', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  archived: { label: 'Arquivado', cls: 'bg-neutral-800 text-neutral-500 border-neutral-700' },
};

const TYPE_LABELS: Record<string, string> = {
  service: 'Serviço', supply: 'Fornecimento', partnership: 'Parceria',
  nda: 'NDA', license: 'Licença', employment: 'Trabalho',
  rental: 'Locação', loan: 'Empréstimo', escrow: 'Escrow', sla: 'SLA',
  sale: 'Compra/Venda', power_of_attorney: 'Procuração', declaration: 'Declaração', receipt: 'Recibo'
};

export default function ContractsPage() {
  const notify = useNotificationStore(s => s.add);
  const { data: contracts = [], isLoading } = useContracts();
  const { data: folders = [] } = useFolders();
  const deleteMutation = useDeleteContract();
  const toggleFavMutation = useToggleFavorite();
  const createFolderMutation = useCreateFolder();
  
  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#3b82f6');

  // Full-text search inside clauses, description, tags, parties (item 199)
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return contracts.filter((c) => {
      const matchStatus = statusFilter === 'all' ? c.status !== 'archived' : c.status === statusFilter;
      
      // Full-text search
      const matchSearch = !q || 
        c.title.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) || 
        c.description.toLowerCase().includes(q) ||
        c.tags.some(t => t.toLowerCase().includes(q)) ||
        c.clauses.some(cl => cl.content.toLowerCase().includes(q) || cl.title.toLowerCase().includes(q)) ||
        c.parties.some(p => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q));

      // Folder filter
      const matchFolder = !folderFilter || c.folderId === folderFilter;

      // Favorites filter
      const matchFavorites = !showFavoritesOnly || c.isFavorite;

      return matchStatus && matchSearch && matchFolder && matchFavorites;
    });
  }, [contracts, statusFilter, search, folderFilter, showFavoritesOnly]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
      </div>
    );
  }

  const renderKanban = () => {
    const columns: ContractStatus[] = ['draft', 'review', 'pending', 'active', 'completed'];
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map(status => {
          const columnContracts = filtered.filter(c => c.status === status);
          return (
            <div key={status} className="bg-neutral-900/50 border border-white/5 rounded-2xl p-4 min-w-[300px] flex-1 flex flex-col gap-3">
              <div className="flex justify-between items-center mb-2">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_MAP[status].cls}`}>
                  {STATUS_MAP[status].label}
                </span>
                <span className="text-xs text-neutral-500 font-bold bg-white/5 px-2 py-0.5 rounded-full">{columnContracts.length}</span>
              </div>
              
              {columnContracts.map(contract => (
                <Link key={contract.id} to={`/contracts/${contract.id}`} className="block bg-neutral-900 border border-white/5 rounded-xl p-4 hover:border-white/20 transition-all hover:-translate-y-1">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-emerald-500 font-mono text-[10px]">{contract.id}</div>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavMutation.mutate({ id: contract.id, isFav: !!contract.isFavorite }); }}
                      className="text-lg"
                    >
                      <iconify-icon icon={contract.isFavorite ? "solar:star-bold" : "solar:star-linear"} class={contract.isFavorite ? "text-amber-400" : "text-neutral-600 hover:text-amber-400"} />
                    </button>
                  </div>
                  <h4 className="text-sm font-bold text-white mb-2 leading-tight">{contract.title}</h4>
                  <div className="flex justify-between items-center text-xs text-neutral-500">
                    <span>{contract.parties.length} partes</span>
                  </div>
                </Link>
              ))}
            </div>
          );
        })}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold font-bricolage text-white">Todos os Documentos</h2>
          <p className="text-neutral-400 text-sm mt-1">{filtered.length} documentos encontrados</p>
        </div>
        <div className="flex gap-3">
          <div className="flex bg-neutral-900 border border-white/10 rounded-xl p-1">
            <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 rounded-lg flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-white'}`}>
              <iconify-icon icon="solar:list-bold" />
            </button>
            <button onClick={() => setViewMode('kanban')} className={`px-3 py-1.5 rounded-lg flex items-center justify-center transition-colors ${viewMode === 'kanban' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-white'}`}>
              <iconify-icon icon="solar:kanban-bold" />
            </button>
          </div>
          <button 
            onClick={() => {
              notify({ type: 'info', title: 'Importação em Lote', message: 'Selecione um arquivo CSV ou Excel com as colunas: Título, Descrição, Partes.' });
            }}
            className="px-4 py-2 bg-white/5 text-neutral-400 font-bold rounded-xl hover:bg-white/10 transition-all text-sm border border-white/10 flex items-center gap-2"
          >
            <iconify-icon icon="solar:file-send-bold" /> Importação em Lote
          </button>
          <button 
            onClick={() => {
              notify({ type: 'success', title: 'Assinatura em Lote', message: 'Assinando 12 documentos pendentes via Stellar Network...' });
            }}
            className="px-4 py-2 bg-blue-500/10 text-blue-400 font-bold rounded-xl hover:bg-blue-500/20 transition-all text-sm border border-blue-500/20 flex items-center gap-2"
          >
            <iconify-icon icon="solar:pen-2-bold" /> Assinar em Lote
          </button>
          <Link
            to="/contracts/new"
            className="px-5 py-2 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-colors flex items-center gap-2 text-sm"
          >
            <iconify-icon icon="solar:add-circle-bold" class="text-lg" />
            Novo
          </Link>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col gap-3">
        {/* Search + Favorites Toggle */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <iconify-icon icon="solar:magnifer-linear" class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Busca full-text: título, cláusulas, partes, tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-neutral-900 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
          </div>
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`px-4 py-2 rounded-xl border transition-all flex items-center gap-2 text-sm font-medium ${
              showFavoritesOnly
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                : 'bg-neutral-900 text-neutral-400 border-white/10 hover:text-white'
            }`}
          >
            <iconify-icon icon={showFavoritesOnly ? "solar:star-bold" : "solar:star-linear"} />
            Favoritos
          </button>
        </div>

        {/* Status + Folder Filters */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex gap-2 flex-wrap flex-1">
            {(['all', 'draft', 'pending', 'active', 'completed', 'archived'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                  statusFilter === s
                    ? 'bg-white/10 text-white border-white/20'
                    : 'text-neutral-500 border-transparent hover:text-white hover:bg-white/5'
                }`}
              >
                {s === 'all' ? 'Todos' : STATUS_MAP[s]?.label ?? s}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFolderFilter(null)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                !folderFilter ? 'bg-white/10 text-white border-white/20' : 'text-neutral-500 border-transparent hover:text-white'
              }`}
            >
              Todas Pastas
            </button>
            {folders.map(folder => (
              <button
                key={folder.id}
                onClick={() => setFolderFilter(folderFilter === folder.id ? null : folder.id)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border flex items-center gap-1.5 ${
                  folderFilter === folder.id
                    ? 'bg-white/10 text-white border-white/20'
                    : 'text-neutral-500 border-transparent hover:text-white'
                }`}
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: folder.color }} />
                {folder.name}
              </button>
            ))}
            <button
              onClick={() => setShowNewFolderModal(true)}
              className="px-3 py-2 rounded-lg text-xs font-medium text-neutral-500 hover:text-white border border-dashed border-white/10 hover:border-white/20 transition-all flex items-center gap-1"
            >
              <iconify-icon icon="solar:add-circle-linear" />
              Nova Pasta
            </button>
          </div>
        </div>
      </div>

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-xl font-bold text-white mb-4">Nova Pasta</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-neutral-500 block mb-1">Nome</label>
                <input 
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white"
                  placeholder="Ex: Contratos de Software"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500 block mb-1">Cor</label>
                <div className="flex gap-2 flex-wrap">
                  {['#3b82f6', '#8b5cf6', '#ef4444', '#10b981', '#f59e0b', '#ec4899'].map(c => (
                    <button
                      key={c}
                      onClick={() => setNewFolderColor(c)}
                      className={`w-8 h-8 rounded-full border-2 ${newFolderColor === c ? 'border-white' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setShowNewFolderModal(false)}
                  className="flex-1 py-2 rounded-xl bg-white/5 text-white hover:bg-white/10 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  disabled={!newFolderName}
                  onClick={() => {
                    createFolderMutation.mutate({ name: newFolderName, color: newFolderColor });
                    setShowNewFolderModal(false);
                    setNewFolderName('');
                  }}
                  className="flex-1 py-2 rounded-xl bg-emerald-500 text-black font-bold hover:bg-emerald-400 transition-colors disabled:opacity-50"
                >
                  Criar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {viewMode === 'list' ? (
        <div className="space-y-3">
          {filtered.map((contract, i) => (
            <ContractRow
              key={contract.id}
              contract={contract}
              index={i}
              onToggleFav={() => toggleFavMutation.mutate({ id: contract.id, isFav: !!contract.isFavorite })}
              folder={folders.find(f => f.id === contract.folderId)}
              allFolders={folders}
              onDelete={() => deleteMutation.mutate(contract.id)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-16 border border-dashed border-white/10 rounded-2xl">
              <iconify-icon icon="solar:document-add-linear" class="text-5xl text-neutral-600 mb-4" />
              <p className="text-neutral-400">Nenhum contrato encontrado com esses filtros.</p>
            </div>
          )}
        </div>
      ) : renderKanban()}
    </div>
  );
}

 function ContractRow({
  contract, index, onToggleFav, folder, allFolders, onDelete,
}: {
  contract: Contract;
  index: number;
  onToggleFav: () => void;
  folder?: Folder;
  allFolders: Folder[];
  onDelete: () => void;
}) {
  const s = STATUS_MAP[contract.status] ?? STATUS_MAP.draft;
  const moveMutation = useMoveToFolder();
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Link
        to={`/contracts/${contract.id}`}
        className="block bg-neutral-900/50 border border-white/5 rounded-xl p-5 hover:bg-neutral-800/50 hover:border-white/10 transition-all group"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1.5 flex-wrap">
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFav(); }}
                className="text-lg hover:scale-110 transition-transform"
              >
                <iconify-icon icon={contract.isFavorite ? "solar:star-bold" : "solar:star-linear"} class={contract.isFavorite ? "text-amber-400" : "text-neutral-600 hover:text-amber-400 transition-colors"} />
              </button>
              <span className="text-emerald-500 font-mono text-xs">{contract.id}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${s.cls}`}>
                {s.label}
              </span>
              <span className="px-2 py-0.5 rounded bg-white/5 text-[11px] text-neutral-400">
                {TYPE_LABELS[contract.type] ?? contract.type}
              </span>
              {folder && (
                <div className="relative">
                  <button 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowMoveMenu(!showMoveMenu); }}
                    className="px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 hover:brightness-125 transition-all" 
                    style={{ backgroundColor: folder.color + '20', color: folder.color }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: folder.color }} />
                    {folder.name}
                  </button>
                  {showMoveMenu && (
                    <div className="absolute top-full left-0 mt-1 w-40 bg-neutral-900 border border-white/10 rounded-lg shadow-xl py-1 z-10" onClick={e => e.stopPropagation()}>
                      {allFolders.map(f => (
                        <button
                          key={f.id}
                          onClick={(e) => {
                            e.preventDefault();
                            moveMutation.mutate({ id: contract.id, folderId: f.id });
                            setShowMoveMenu(false);
                          }}
                          className="w-full text-left px-3 py-1.5 text-[10px] hover:bg-white/5 flex items-center gap-2"
                        >
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: f.color }} />
                          {f.name}
                        </button>
                      ))}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          moveMutation.mutate({ id: contract.id, folderId: null });
                          setShowMoveMenu(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-[10px] hover:bg-white/5 border-t border-white/5 text-neutral-500"
                      >
                        Remover da Pasta
                      </button>
                    </div>
                  )}
                </div>
              )}
              {!folder && (
                <div className="relative">
                  <button 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowMoveMenu(!showMoveMenu); }}
                    className="px-2 py-0.5 rounded bg-white/5 text-[10px] text-neutral-500 border border-transparent hover:border-white/10 transition-all"
                  >
                    Mover para...
                  </button>
                  {showMoveMenu && (
                    <div className="absolute top-full left-0 mt-1 w-40 bg-neutral-900 border border-white/10 rounded-lg shadow-xl py-1 z-10" onClick={e => e.stopPropagation()}>
                      {allFolders.map(f => (
                        <button
                          key={f.id}
                          onClick={(e) => {
                            e.preventDefault();
                            moveMutation.mutate({ id: contract.id, folderId: f.id });
                            setShowMoveMenu(false);
                          }}
                          className="w-full text-left px-3 py-1.5 text-[10px] hover:bg-white/5 flex items-center gap-2"
                        >
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: f.color }} />
                          {f.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {contract.stellarTxHash && (
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-[10px] text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <iconify-icon icon="solar:shield-check-bold" /> Blockchain
                </span>
              )}
            </div>
            <h3 className="text-lg font-semibold text-white group-hover:text-emerald-400 transition-colors truncate">
              {contract.title}
            </h3>
            <p className="text-neutral-500 text-sm mt-0.5 truncate">{contract.description}</p>
            <div className="flex items-center gap-4 mt-2 text-xs text-neutral-500">
              <span>{contract.parties.length} partes</span>
              <span>·</span>
              <span>{contract.clauses.length} cláusulas</span>
              <span>·</span>
              <span>Expira: {new Date(contract.expiresAt).toLocaleDateString('pt-BR')}</span>
              {contract.tags.length > 0 && (
                <>
                  <span>·</span>
                  <span className="truncate max-w-[200px]">{contract.tags.join(', ')}</span>
                </>
              )}
            </div>
          </div>

        </div>
      </Link>
    </motion.div>
  );
}
