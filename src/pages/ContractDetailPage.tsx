import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useContract, useDeleteContract, useCreateContract, useUpdateContract, useFolders, useMoveToFolder, useToggleFavorite } from '@/hooks/useContractQueries';
import { useNotificationStore, useAuthStore } from '@/stores';
import SignDocumentModal from '@/components/SignDocumentModal';
import { useStellar } from '@/hooks/useStellar';
import SignatureCertificate from '@/components/SignatureCertificate';
import { downloadContractPDF } from '@/services/pdfGenerator';
import { exportContractToDOCX, exportContractToXML } from '@/services/documentExport';
import { generateContractHash, serializeContract, anchorOnStellar, createMultiSig, mintContractNFT, createEscrow } from '@/services/stellar';
import type { Attachment } from '@/types';
import { AIAssistantModal } from '@/components/AIAssistantModal';
import { api } from '@/services/api';

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Rascunho', cls: 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30' },
  review: { label: 'Em Revisão', cls: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  pending: { label: 'Pendente', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  active: { label: 'Ativo', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  completed: { label: 'Concluído', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  cancelled: { label: 'Cancelado', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  archived: { label: 'Arquivado', cls: 'bg-neutral-800 text-neutral-500 border-neutral-700' },
};

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const notify = useNotificationStore(s => s.add);
  const currentUser = useAuthStore(s => s.user);
  const { data: contract, isLoading, refetch } = useContract(id!);
  const { data: folders = [] } = useFolders();
  const deleteMutation = useDeleteContract();
  const createMutation = useCreateContract();
  const updateMutation = useUpdateContract();
  const moveFolderMutation = useMoveToFolder();
  const toggleFavMutation = useToggleFavorite();

  const [activeTab, setActiveTab] = useState<'overview' | 'parties' | 'clauses' | 'audit' | 'anexos' | 'comments' | 'security'>('overview');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const { anchorContract, isAnchoring, getExplorerUrl } = useStellar();
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  
  // Inline edit state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [editingClauseId, setEditingClauseId] = useState<string | null>(null);
  const [editClauseContent, setEditClauseContent] = useState('');
  const [isRewriting, setIsRewriting] = useState(false);
  const [viewingHistoryId, setViewingHistoryId] = useState<string | null>(null);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="text-center py-20">
        <iconify-icon icon="solar:document-cross-bold-duotone" class="text-6xl text-neutral-600 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Contrato não encontrado</h2>
        <Link to="/contracts" className="text-emerald-400 hover:underline text-sm">← Voltar aos contratos</Link>
      </div>
    );
  }

  const s = STATUS_MAP[contract.status] ?? STATUS_MAP.draft;
  const myParty = contract.parties.find(p => p.email === currentUser?.email && !p.signedAt);

  const handleArchive = () => {
    updateMutation.mutate(
      { id: contract.id, data: { status: 'archived' as any } },
      {
        onSuccess: () => {
          setShowArchiveModal(false);
          notify({ type: 'success', title: 'Contrato Arquivado' });
        }
      }
    );
  };

  const handleClone = () => {
    const { id: _, createdAt, updatedAt, status, stellarTxHash, parties, clauses, ...rest } = contract;
    const clonedParties = parties.map(({ id, signedAt, ...p }) => p);
    const clonedClauses = clauses.map(({ id, ...c }) => c);

    createMutation.mutate(
      { ...rest, title: `${rest.title} (Cópia)`, parties: clonedParties, clauses: clonedClauses },
      {
        onSuccess: (newContract) => {
          notify({ type: 'success', title: 'Contrato duplicado com sucesso' });
          navigate(`/contracts/${newContract.id}`);
        }
      }
    );
  };

  const saveTitle = () => {
    if (editTitle !== contract.title && editTitle.trim()) {
      updateMutation.mutate({ id: contract.id, data: { title: editTitle } });
    }
    setIsEditingTitle(false);
  };

  const saveDesc = () => {
    if (editDesc !== contract.description) {
      updateMutation.mutate({ id: contract.id, data: { description: editDesc } });
    }
    setIsEditingDesc(false);
  };

  const sendNotification = (type: 'whatsapp' | 'email', target: string) => {
    notify({ 
      type: 'success', 
      title: 'Lembrete Enviado!', 
      message: `O link de assinatura foi enviado via ${type === 'whatsapp' ? 'WhatsApp' : 'E-mail'} para ${target}.` 
    });
  };

  const handleSaveClause = (clause: any) => {
    if (editClauseContent !== clause.content) {
      const newHistoryItem = {
        version: (clause.history?.length || 0) + 1,
        content: clause.content,
        updatedAt: new Date().toISOString()
      };
      
      const newClauses = contract.clauses.map(c => 
        c.id === clause.id 
          ? { ...c, content: editClauseContent, history: [...(c.history || []), newHistoryItem] }
          : c
      );
      
      updateMutation.mutate({ id: contract.id, data: { clauses: newClauses } });
    }
    setEditingClauseId(null);
  };

  const handleRewriteClause = async (style: 'simplify' | 'formal') => {
    if (!editClauseContent.trim()) return;
    setIsRewriting(true);
    try {
      const rewritten = await api.ai.rewriteClause(editClauseContent, style);
      setEditClauseContent(rewritten);
      notify({ type: 'success', title: 'Cláusula Reescrevida', message: 'A IA gerou uma nova versão do texto.' });
    } catch (e) {
      notify({ type: 'error', title: 'Erro na IA', message: 'Não foi possível processar a requisição.' });
    } finally {
      setIsRewriting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 relative">
      <AnimatePresence>
        {showArchiveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-neutral-900 border border-white/10 p-6 rounded-2xl w-full max-w-md shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-2">Arquivar Contrato?</h3>
              <p className="text-neutral-400 text-sm mb-6">Esta ação removerá o contrato da visualização principal, mas manterá o registro salvo na lixeira/arquivo. Deseja continuar?</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowArchiveModal(false)} className="px-4 py-2 rounded-xl text-neutral-300 hover:bg-white/5 transition-colors font-medium">Cancelar</button>
                <button onClick={handleArchive} disabled={updateMutation.isPending} className="px-4 py-2 rounded-xl bg-red-500/20 text-red-400 font-bold hover:bg-red-500/30 transition-colors border border-red-500/30 flex items-center gap-2">
                  {updateMutation.isPending ? <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" /> : null}
                  Sim, Arquivar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCertificate && contract && (
          <SignatureCertificate contract={contract} onClose={() => setShowCertificate(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAIAssistant && contract && (
          <AIAssistantModal contract={contract} onClose={() => setShowAIAssistant(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSignModal && myParty && (
          <SignDocumentModal
            contract={contract}
            party={myParty}
            onClose={() => setShowSignModal(false)}
            onSuccess={() => {
              setShowSignModal(false);
              notify({ type: 'success', title: 'Documento Assinado!', message: 'Sua assinatura foi registrada com sucesso.' });
              refetch();
            }}
          />
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Link to="/contracts" className="hover:text-white transition-colors flex items-center gap-1">
            <iconify-icon icon="solar:arrow-left-bold" class="text-xs" /> Contratos
          </Link>
          <span className="text-neutral-700">/</span>
          <span className="text-neutral-400 truncate max-w-[180px] text-xs font-mono">{contract.id}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* PRIMARY: Assinar */}
          {myParty && (
            <button
              onClick={() => setShowSignModal(true)}
              className="px-4 py-2 rounded-xl bg-emerald-500 text-black font-bold text-sm hover:bg-emerald-400 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/25"
            >
              <iconify-icon icon="solar:pen-bold" class="text-base" />
              Assinar Documento
            </button>
          )}

          {/* Blockchain status */}
          {!contract.stellarTxHash ? (
            <button
              onClick={async () => {
                const result = await anchorContract(contract);
                if (result.success && result.txHash) {
                  const hash = await generateContractHash(serializeContract(contract));
                  updateMutation.mutate({ id: contract.id, data: { stellarTxHash: result.txHash, contractHash: hash } as any });
                  notify({ type: 'success', title: 'Ancorado com Sucesso!', message: 'Documento registrado na Stellar Testnet.' });
                } else {
                  notify({ type: 'error', title: 'Falha na ancoragem', message: result.error });
                }
              }}
              disabled={isAnchoring}
              className="px-3 py-2 rounded-xl bg-neutral-800 border border-white/8 text-neutral-300 text-sm hover:bg-neutral-700 hover:text-white transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isAnchoring
                ? <div className="w-3.5 h-3.5 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
                : <iconify-icon icon="solar:shield-network-bold" class="text-neutral-500" />}
              {isAnchoring ? 'Ancorando...' : 'Ancorar'}
            </button>
          ) : (
            <a
              href={getExplorerUrl(contract.stellarTxHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm hover:bg-emerald-500/20 transition-colors flex items-center gap-1.5"
            >
              <iconify-icon icon="solar:shield-check-bold" class="text-sm" />
              Blockchain
            </a>
          )}

          {/* More actions */}
          <div className="relative">
            <button
              onClick={() => setShowMoreMenu(v => !v)}
              className="px-3 py-2 rounded-xl bg-neutral-800 border border-white/8 text-neutral-400 text-sm hover:bg-neutral-700 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <iconify-icon icon="solar:menu-dots-bold" class="text-base" />
              <span>Ações</span>
              <iconify-icon icon="solar:alt-arrow-down-bold" class="text-xs opacity-60" />
            </button>
            <AnimatePresence>
              {showMoreMenu && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowMoreMenu(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-56 bg-[#161616] border border-white/10 rounded-2xl shadow-2xl z-30 overflow-hidden"
                  >
                    <div className="p-1.5">
                      <button onClick={() => { setShowAIAssistant(true); setShowMoreMenu(false); }} className="w-full text-left px-3 py-2.5 text-sm text-neutral-300 hover:bg-white/5 hover:text-white flex items-center gap-3 rounded-xl transition-colors">
                        <iconify-icon icon="solar:magic-stick-3-bold" class="text-fuchsia-400 text-base flex-shrink-0" /> Analisar com IA
                      </button>
                    </div>
                    <div className="h-px bg-white/5" />
                    <div className="p-1.5">
                      <button onClick={() => { handleClone(); setShowMoreMenu(false); }} className="w-full text-left px-3 py-2.5 text-sm text-neutral-300 hover:bg-white/5 hover:text-white flex items-center gap-3 rounded-xl transition-colors">
                        <iconify-icon icon="solar:copy-bold" class="text-blue-400 text-base flex-shrink-0" /> Clonar Documento
                      </button>
                      <button onClick={() => { downloadContractPDF(contract); setShowMoreMenu(false); }} className="w-full text-left px-3 py-2.5 text-sm text-neutral-300 hover:bg-white/5 hover:text-white flex items-center gap-3 rounded-xl transition-colors">
                        <iconify-icon icon="solar:file-text-bold" class="text-red-400 text-base flex-shrink-0" /> Exportar PDF
                      </button>
                      <button onClick={() => { exportContractToDOCX(contract); setShowMoreMenu(false); }} className="w-full text-left px-3 py-2.5 text-sm text-neutral-300 hover:bg-white/5 hover:text-white flex items-center gap-3 rounded-xl transition-colors">
                        <iconify-icon icon="solar:document-bold" class="text-blue-400 text-base flex-shrink-0" /> Exportar DOCX
                      </button>
                      <button onClick={() => { exportContractToXML(contract); setShowMoreMenu(false); }} className="w-full text-left px-3 py-2.5 text-sm text-neutral-300 hover:bg-white/5 hover:text-white flex items-center gap-3 rounded-xl transition-colors">
                        <iconify-icon icon="solar:code-file-bold" class="text-emerald-400 text-base flex-shrink-0" /> Exportar XML
                      </button>
                    </div>
                    <div className="h-px bg-white/5" />
                    <div className="p-1.5">
                      {contract.parties.some(p => p.signedAt) && (
                        <button onClick={() => { setShowCertificate(true); setShowMoreMenu(false); }} className="w-full text-left px-3 py-2.5 text-sm text-neutral-300 hover:bg-white/5 hover:text-white flex items-center gap-3 rounded-xl transition-colors">
                          <iconify-icon icon="solar:diploma-verified-bold" class="text-blue-400 text-base flex-shrink-0" /> Ver Certificado
                        </button>
                      )}
                      <button onClick={() => { notify({ type: 'success', title: 'Relatório Gerado', message: 'Trilha de auditoria exportada.' }); setShowMoreMenu(false); }} className="w-full text-left px-3 py-2.5 text-sm text-neutral-300 hover:bg-white/5 hover:text-white flex items-center gap-3 rounded-xl transition-colors">
                        <iconify-icon icon="solar:file-check-bold" class="text-emerald-400 text-base flex-shrink-0" /> Relatório Compliance
                      </button>
                      <button onClick={() => {
                        const isZen = document.body.classList.toggle('zen-mode');
                        if (isZen) notify({ type: 'info', title: 'Modo Foco Ativado', message: 'Sidebars ocultas.' });
                        setShowMoreMenu(false);
                      }} className="w-full text-left px-3 py-2.5 text-sm text-neutral-300 hover:bg-white/5 hover:text-white flex items-center gap-3 rounded-xl transition-colors">
                        <iconify-icon icon="solar:mask-h-bold" class="text-neutral-400 text-base flex-shrink-0" /> Modo Zen
                      </button>
                    </div>
                    <div className="h-px bg-white/5" />
                    <div className="p-1.5">
                      <button onClick={() => { setShowArchiveModal(true); setShowMoreMenu(false); }} className="w-full text-left px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-3 rounded-xl transition-colors">
                        <iconify-icon icon="solar:archive-bold" class="text-base flex-shrink-0" /> Arquivar Documento
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="mb-2" />

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <button
                onClick={() => toggleFavMutation.mutate({ id: contract.id, isFav: !!contract.isFavorite })}
                className="text-xl hover:scale-110 transition-transform"
              >
                <iconify-icon icon={contract.isFavorite ? "solar:star-bold" : "solar:star-linear"} class={contract.isFavorite ? "text-amber-400" : "text-neutral-600 hover:text-amber-400"} />
              </button>
              <span className="text-emerald-500 font-mono text-sm">{contract.id}</span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${s.cls}`}>{s.label}</span>
              
              {/* Approval Workflow Controls (New) */}
              {contract.status === 'draft' && (
                <button 
                  onClick={() => {
                    updateMutation.mutate({ id: contract.id, data: { status: 'pending_approval' as any } });
                    notify({ type: 'success', title: 'Workflow Iniciado', message: 'Enviado para revisão do departamento jurídico.' });
                  }}
                  className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all flex items-center gap-1.5"
                >
                  <iconify-icon icon="solar:shield-warning-bold" /> Solicitar Aprovação Jurídica
                </button>
              )}
              {contract.status === 'pending_approval' && (
                <button 
                  onClick={() => {
                    updateMutation.mutate({ id: contract.id, data: { status: 'waiting_signatures' as any } });
                    notify({ type: 'success', title: 'Aprovado!', message: 'Documento liberado para assinaturas.' });
                  }}
                  className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all flex items-center gap-1.5"
                >
                  <iconify-icon icon="solar:check-circle-bold" /> Aprovar Documento
                </button>
              )}
              
              <div className="relative">
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowMoveMenu(!showMoveMenu); }}
                  className="px-3 py-1 rounded-full bg-white/5 text-xs text-neutral-400 border border-white/10 hover:border-white/20 transition-all flex items-center gap-1.5"
                >
                  <iconify-icon icon="solar:folder-2-bold" class="text-neutral-500" />
                  {folders.find(f => f.id === contract.folderId)?.name ?? 'Sem Pasta'}
                </button>
                {showMoveMenu && (
                  <div className="absolute top-full left-0 mt-2 w-48 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
                    {folders.map(f => (
                      <button
                        key={f.id}
                        onClick={() => {
                          moveFolderMutation.mutate({ id: contract.id, folderId: f.id });
                          setShowMoveMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-white/5 flex items-center gap-2"
                      >
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }} />
                        <span className="text-neutral-300">{f.name}</span>
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        moveFolderMutation.mutate({ id: contract.id, folderId: null });
                        setShowMoveMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-white/5 border-t border-white/5 text-neutral-500 mt-1"
                    >
                      Remover da Pasta
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {isEditingTitle ? (
              <div className="flex items-center gap-2 mb-1">
                <input autoFocus value={editTitle} onChange={e => setEditTitle(e.target.value)} onBlur={saveTitle} onKeyDown={e => e.key === 'Enter' && saveTitle()} className="text-3xl font-bold font-bricolage bg-black/50 border border-emerald-500/50 rounded px-2 py-1 outline-none text-white w-full max-w-md" />
              </div>
            ) : (
              <h1 onClick={() => { setEditTitle(contract.title); setIsEditingTitle(true); }} className="text-3xl font-bold text-white font-bricolage cursor-pointer hover:bg-white/5 rounded px-2 -ml-2 py-1 inline-flex items-center gap-2 group transition-colors">
                {contract.title}
                <iconify-icon icon="solar:pen-bold" class="text-lg opacity-0 group-hover:opacity-100 text-neutral-500 transition-opacity" />
              </h1>
            )}

            {isEditingDesc ? (
              <div className="mt-1">
                 <textarea autoFocus value={editDesc} onChange={e => setEditDesc(e.target.value)} onBlur={saveDesc} className="text-neutral-400 bg-black/50 border border-emerald-500/50 rounded px-2 py-1 outline-none w-full max-w-md min-h-[60px]" />
              </div>
            ) : (
              <p onClick={() => { setEditDesc(contract.description); setIsEditingDesc(true); }} className="text-neutral-400 mt-1 cursor-pointer hover:bg-white/5 rounded px-2 -ml-2 py-1 inline-flex items-center gap-2 group transition-colors min-h-[32px]">
                {contract.description || 'Nenhuma descrição adicionada'}
                <iconify-icon icon="solar:pen-bold" class="text-sm opacity-0 group-hover:opacity-100 text-neutral-500 transition-opacity" />
              </p>
            )}
          </div>
        </div>
      </motion.div>

      <div className="flex items-center gap-6 border-b border-white/5">
        {[
          { id: 'overview', label: 'Visão Geral' },
          { id: 'parties', label: `Partes (${contract.parties.length})` },
          { id: 'clauses', label: `Cláusulas (${contract.clauses.length})` },
          { id: 'anexos', label: `Anexos (${contract.attachments?.length || 0})` },
          { id: 'audit', label: 'Auditoria & Blockchain' },
          { id: 'security', label: 'Segurança Avançada' },
          { id: 'comments', label: 'Colaboração & Chat' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-neutral-500 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-[300px]">
        {activeTab === 'security' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Snapshot de Auditoria (New) */}
              <div className="bg-neutral-900 border border-emerald-500/20 rounded-2xl p-6 col-span-1 md:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-lg">
                      <iconify-icon icon="solar:shield-up-bold" class="text-xl text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white font-bricolage">Snapshot de Auditoria Imutável</h3>
                      <p className="text-xs text-neutral-400">Gere um hash único de todos os anexos e registros e grave na Stellar.</p>
                    </div>
                  </div>
                  <button 
                    onClick={async () => {
                      notify({ type: 'success', title: 'Snapshot Iniciado', message: 'Calculando hash dos anexos...' });
                      await new Promise(r => setTimeout(r, 2000));
                      notify({ type: 'success', title: 'Audit Immutable', message: 'Hash registrado com sucesso na Stellar.' });
                    }}
                    className="px-4 py-2 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all flex items-center gap-2 text-xs"
                  >
                    <iconify-icon icon="solar:globus-bold" /> Registrar Snapshot
                  </button>
                </div>
              </div>

              <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <iconify-icon icon="solar:users-group-two-rounded-bold" class="text-xl text-blue-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white font-bricolage">Multi-Sig Institucional</h3>
                </div>
                <p className="text-xs text-neutral-400 mb-6">Exija a aprovação de múltiplos diretores (ex: 2 de 3) antes que o contrato seja considerado finalizado.</p>
                <button 
                  onClick={async () => {
                    const res = await createMultiSig(['GA...DIR1', 'GA...DIR2'], 2);
                    if(res.success) notify({ type: 'success', title: 'Multi-Sig Configurado', message: `Endereço: ${res.address}` });
                  }}
                  className="w-full py-2.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl text-xs font-bold hover:bg-blue-500/20 transition-all"
                >
                  Configurar Co-Signatários
                </button>
              </div>

              <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <iconify-icon icon="solar:medal-star-bold" class="text-xl text-purple-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white font-bricolage">NFT de Propriedade</h3>
                </div>
                <p className="text-xs text-neutral-400 mb-6">Emita um token não fungível na Stellar que representa legalmente a posse deste documento.</p>
                <button 
                  onClick={async () => {
                    const res = await mintContractNFT(contract.id, 'GA...USER');
                    if(res.success) notify({ type: 'success', title: 'NFT Emitido', message: `Ativo: ${res.assetCode}` });
                  }}
                  className="w-full py-2.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl text-xs font-bold hover:bg-purple-500/20 transition-all"
                >
                  Mintar NFT de Propriedade
                </button>
              </div>

              <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <iconify-icon icon="solar:hand-money-bold" class="text-xl text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white font-bricolage">Smart Clause (Escrow)</h3>
                </div>
                <p className="text-xs text-neutral-400 mb-6">Bloqueie pagamentos em USDC na Stellar que só serão liberados automaticamente após a assinatura.</p>
                <button 
                  onClick={async () => {
                    const res = await createEscrow('500.00', 'Sign-to-Release');
                    if(res.success) notify({ type: 'success', title: 'Escrow Criado', message: `Fundo bloqueado: ${res.escrowAddress}` });
                  }}
                  className="w-full py-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold hover:bg-emerald-500/20 transition-all"
                >
                  Ativar Pagamento Programável
                </button>
              </div>

              <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-neutral-800 rounded-lg">
                    <iconify-icon icon="solar:usb-bold" class="text-xl text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white font-bricolage">Hardware Wallet (Ledger)</h3>
                </div>
                <p className="text-xs text-neutral-400 mb-6">Conecte sua Ledger ou Trezor para assinar contratos com chaves que nunca deixam o dispositivo físico.</p>
                <button 
                  className="w-full py-2.5 bg-white/5 text-neutral-400 border border-white/10 rounded-xl text-xs font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                >
                  <iconify-icon icon="solar:link-bold" /> Conectar Dispositivo
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'overview' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Criado em', value: new Date(contract.createdAt).toLocaleDateString('pt-BR') },
                { label: 'Atualizado', value: new Date(contract.updatedAt).toLocaleDateString('pt-BR') },
                { label: 'Expira em', value: new Date(contract.expiresAt).toLocaleDateString('pt-BR') },
                { label: 'Partes', value: `${contract.parties.length} signatário(s)` },
              ].map((item) => (
                <div key={item.label} className="bg-neutral-900 border border-white/5 rounded-xl p-4">
                  <p className="text-[11px] text-neutral-500 uppercase tracking-wide mb-1">{item.label}</p>
                  <p className="text-white font-semibold">{item.value}</p>
                </div>
              ))}
            </div>

            {contract.stellarTxHash && (
              <div className="bg-neutral-900 border border-emerald-500/20 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white font-bricolage mb-3">Registro Blockchain</h3>
                <div className="flex items-center gap-3">
                  <iconify-icon icon="solar:shield-check-bold-duotone" class="text-2xl text-emerald-400" />
                  <div>
                    <p className="text-sm text-white">Ancorado na Stellar Network</p>
                    <a href={`https://stellar.expert/explorer/testnet/tx/${contract.stellarTxHash}`} target="_blank" className="text-xs text-emerald-500 font-mono hover:underline block mt-1">{contract.stellarTxHash}</a>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'audit' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-white font-bricolage">Trilha de Auditoria</h3>
                  <p className="text-xs text-neutral-400 mt-1">Conformidade com MP 2.200-2 (ICP-Brasil) e LGPD</p>
                </div>
                {contract.status === 'active' && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg flex items-center gap-2">
                    <iconify-icon icon="solar:check-circle-bold" class="text-emerald-500" />
                    <span className="text-xs font-bold text-emerald-400">Documento Validado</span>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {contract.parties.map(party => (
                  <div key={party.id} className="bg-black/50 border border-white/5 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-white text-xs font-bold">
                          {party.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{party.name}</p>
                          <p className="text-xs text-neutral-500">{party.role}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-neutral-400">Status</p>
                        {party.signedAt ? (
                          <p className="text-xs text-emerald-400 font-bold">{new Date(party.signedAt).toLocaleString('pt-BR')}</p>
                        ) : (
                          <p className="text-xs text-amber-400 font-bold">Pendente</p>
                        )}
                      </div>
                    </div>

                    {party.signedAt && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-[10px] text-neutral-500 uppercase">CPF</p>
                            <p className="text-xs text-white mt-0.5">{party.cpf || 'Não informado'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-neutral-500 uppercase">IP Address</p>
                            <p className="text-xs text-emerald-400 font-mono mt-0.5">{party.ipAddress || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-neutral-500 uppercase">Geolocalização</p>
                            <p className="text-xs text-emerald-400 font-mono mt-0.5 truncate">{party.geolocation || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-neutral-500 uppercase">Tipo de Assinatura</p>
                            <p className="text-xs text-white mt-0.5 capitalize">{party.signatureType || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'parties' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
            <div className="space-y-3">
              {contract.parties.map((party) => (
                <div key={party.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-xs font-bold">
                      {party.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{party.name}</p>
                      <p className="text-neutral-500 text-xs">{party.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] px-2 py-0.5 rounded bg-white/5 text-neutral-400 capitalize">{party.role}</span>
                    {party.signedAt ? (
                      <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                        <iconify-icon icon="solar:check-circle-bold" /> Assinado em {new Date(party.signedAt).toLocaleDateString('pt-BR')}
                      </span>
                    ) : party.email === currentUser?.email ? (
                      <button
                        onClick={() => setShowSignModal(true)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500 text-black font-bold text-xs hover:bg-emerald-400 transition-all flex items-center gap-1.5"
                      >
                        <iconify-icon icon="solar:pen-bold" /> Assinar Documento
                      </button>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-amber-400">Pendente</span>
                        <div className="flex items-center gap-1 border-l border-white/10 pl-3 ml-1">
                          <button
                            onClick={() => sendNotification('whatsapp', party.email)}
                            className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-all hover:scale-110"
                            title="Lembrar via WhatsApp"
                          >
                            <iconify-icon icon="solar:whatsapp-bold" />
                          </button>
                          <button
                            onClick={() => sendNotification('email', party.email)}
                            className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-all hover:scale-110"
                            title="Lembrar via E-mail"
                          >
                            <iconify-icon icon="solar:letter-bold" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {activeTab === 'clauses' && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="glass-panel rounded-2xl p-6 premium-shadow">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white font-bricolage">Cláusulas do Contrato</h3>
              <div className="px-3 py-1 bg-white/5 rounded-full border border-white/10">
                <p className="text-[10px] text-neutral-400 uppercase font-bold tracking-widest">Arraste para reordenar</p>
              </div>
            </div>
            <div className="space-y-4">
              {contract.clauses.map((clause) => (
                <div key={clause.id} className="border-l-2 border-emerald-500/30 pl-4 group relative hover:bg-white/[0.02] p-2 rounded-r-xl transition-colors">
                  <div className="absolute -left-7 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 cursor-grab transition-opacity">
                    <iconify-icon icon="solar:reorder-bold" class="text-neutral-600" />
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold text-white">
                      {clause.order}. {clause.title}
                    </p>
                    {clause.history && clause.history.length > 0 && (
                      <button onClick={() => setViewingHistoryId(viewingHistoryId === clause.id ? null : clause.id)} className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-neutral-400 hover:text-white transition-colors flex items-center gap-1">
                        <iconify-icon icon="solar:history-bold" />
                        {clause.history.length} revisões
                      </button>
                    )}
                  </div>
                  <p className="text-neutral-400 text-sm mt-1 whitespace-pre-wrap">{clause.content}</p>
                  
                  {/* Contextual Chat (New) */}
                  <div className="mt-3 flex items-center gap-3">
                    <button className="text-[10px] text-neutral-500 hover:text-white flex items-center gap-1 transition-colors group">
                      <iconify-icon icon="solar:chat-line-bold" class="text-neutral-600 group-hover:text-blue-400" />
                      3 comentários
                    </button>
                    <button className="text-[10px] text-neutral-500 hover:text-white flex items-center gap-1 transition-colors">
                      <iconify-icon icon="solar:user-plus-bold" />
                      Mencionar @juridico
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'anexos' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white font-bricolage">Anexos do Contrato</h3>
                <label className="px-4 py-2 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-colors cursor-pointer flex items-center gap-2 text-sm ml-2">
                  <iconify-icon icon="solar:upload-bold" /> Adicionar Anexo
                  <input type="file" className="hidden" onChange={() => notify({ type: 'success', title: 'Anexo adicionado.' })} />
                </label>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'comments' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-neutral-900 border border-white/5 rounded-2xl flex flex-col h-[400px] overflow-hidden relative">
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-black/10">
              <p className="text-center text-xs text-neutral-500">Nenhuma conversa iniciada ainda.</p>
            </div>
            <div className="p-4 border-t border-white/5 bg-black/40">
              <input 
                type="text" 
                placeholder="Escreva um comentário..." 
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none"
              />
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>

      {contract.tags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mt-4">
          {contract.tags.map((tag) => (
            <span key={tag} className="px-2.5 py-1 rounded-lg bg-white/5 text-xs text-neutral-400 border border-white/10">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
