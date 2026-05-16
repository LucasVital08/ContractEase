import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useContract, useDeleteContract, useCreateContract, useUpdateContract, useToggleFavorite } from '@/hooks/useContractQueries';
import { useNotificationStore, useAuthStore } from '@/stores';
import SignDocumentModal from '@/components/SignDocumentModal';
import { useStellar } from '@/hooks/useStellar';
import SignatureCertificate from '@/components/SignatureCertificate';
import { downloadContractPDF } from '@/services/pdfGenerator';
import { exportContractToDOCX, exportContractToXML } from '@/services/documentExport';
import { AIAssistantModal } from '@/components/AIAssistantModal';
import { supabase } from '@/lib/supabase';

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Rascunho', cls: 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30' },
  review: { label: 'Em Revisão', cls: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  pending: { label: 'Pendente', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  active: { label: 'Ativo', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  completed: { label: 'Concluído', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  cancelled: { label: 'Cancelado', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  archived: { label: 'Arquivado', cls: 'bg-neutral-800 text-neutral-500 border-neutral-700' },
};

type TabType = 'overview' | 'parties' | 'clauses' | 'audit' | 'attachments' | 'comments' | 'security';

const TABS: { id: TabType; label: string; icon: string }[] = [
  { id: 'overview', label: 'Visão Geral', icon: 'solar:document-bold-duotone' },
  { id: 'parties', label: 'Partes', icon: 'solar:users-group-rounded-bold' },
  { id: 'clauses', label: 'Cláusulas', icon: 'solar:menu-dots-bold' },
  { id: 'audit', label: 'Auditoria', icon: 'solar:shield-check-bold' },
  { id: 'attachments', label: 'Anexos', icon: 'solar:file-bold' },
  { id: 'comments', label: 'Comentários', icon: 'solar:chat-round-bold' },
  { id: 'security', label: 'Segurança', icon: 'solar:lock-bold' },
];

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const notify = useNotificationStore(s => s.add);
  const currentUser = useAuthStore(s => s.user);
  const { data: contract, isLoading, refetch } = useContract(id!);
  const deleteMutation = useDeleteContract();
  const createMutation = useCreateContract();
  const updateMutation = useUpdateContract();
  const toggleFavMutation = useToggleFavorite();
  const { getExplorerUrl } = useStellar();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showSignModal, setShowSignModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);

  // Comments
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [savingComment, setSavingComment] = useState(false);

  // Attachments
  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Privacy
  const [privacy, setPrivacy] = useState<'private' | 'organization'>('private');

  // Realtime + load tabs data
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`contract-detail-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contract_parties', filter: `contract_id=eq.${id}` }, () => refetch())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'contracts', filter: `id=eq.${id}` }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contract_comments', filter: `contract_id=eq.${id}` }, () => loadComments())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, refetch]);

  useEffect(() => {
    if (contract) setPrivacy((contract as any).privacy || 'private');
  }, [contract]);

  useEffect(() => {
    if (activeTab === 'comments') loadComments();
    if (activeTab === 'attachments') loadAttachments();
  }, [activeTab, id]);

  const loadComments = async () => {
    const { data } = await supabase
      .from('contract_comments')
      .select('*, profiles(name, avatar_url)')
      .eq('contract_id', id!)
      .order('created_at', { ascending: true });
    setComments(data || []);
  };

  const addComment = async () => {
    if (!newComment.trim() || !currentUser) return;
    setSavingComment(true);
    const { error } = await supabase.from('contract_comments').insert({
      contract_id: id!,
      user_id: currentUser.id,
      content: newComment.trim(),
    });
    if (!error) { setNewComment(''); loadComments(); }
    else notify({ type: 'error', title: 'Erro ao comentar', message: error.message });
    setSavingComment(false);
  };

  const loadAttachments = async () => {
    const { data } = await supabase
      .from('attachments')
      .select('*')
      .eq('contract_id', id!)
      .order('created_at', { ascending: false });
    setAttachments(data || []);
  };

  const uploadAttachment = async (files: FileList | null) => {
    if (!files || !currentUser) return;
    setUploadingFile(true);
    for (const file of Array.from(files)) {
      const path = `${currentUser.id}/${id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('attachments').upload(path, file);
      if (!uploadError) {
        await supabase.from('attachments').insert({
          contract_id: id!, name: file.name, file_path: path,
          mime_type: file.type, size_bytes: file.size, uploaded_by: currentUser.id,
        });
      }
    }
    loadAttachments();
    setUploadingFile(false);
    notify({ type: 'success', title: 'Anexo(s) enviado(s)' });
  };

  const deleteAttachment = async (attachment: any) => {
    await supabase.storage.from('attachments').remove([attachment.file_path]);
    await supabase.from('attachments').delete().eq('id', attachment.id);
    loadAttachments();
  };

  const savePrivacy = async (value: 'private' | 'organization') => {
    setPrivacy(value);
    await supabase.from('contracts').update({ privacy: value }).eq('id', id!);
    notify({ type: 'success', title: 'Privacidade atualizada' });
  };

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

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
  const signedCount = contract.parties.filter(p => p.signedAt).length;
  const allSigned = signedCount === contract.parties.length;

  const handleArchive = () => {
    updateMutation.mutate(
      { id: contract.id, data: { status: 'archived' as any } },
      { onSuccess: () => { setShowArchiveModal(false); navigate('/contracts'); notify({ type: 'success', title: 'Contrato arquivado' }); } }
    );
  };

  const handleClone = () => {
    const { id: _, createdAt, updatedAt, status, stellarTxHash, parties, clauses, ...rest } = contract;
    const clonedParties = parties.map(({ id, signedAt, ...p }) => p);
    const clonedClauses = clauses.map(({ id, ...c }) => c);
    createMutation.mutate(
      { ...rest, title: `${rest.title} (Cópia)`, parties: clonedParties, clauses: clonedClauses },
      { onSuccess: (nc) => { notify({ type: 'success', title: 'Contrato duplicado' }); navigate(`/contracts/${nc.id}`); } }
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">

      {/* Modals */}
      <AnimatePresence>
        {showArchiveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-neutral-900 border border-white/10 p-6 rounded-2xl w-full max-w-md shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-2">Arquivar Contrato?</h3>
              <p className="text-neutral-400 text-sm mb-6">O contrato será movido para o arquivo e removido da lista principal.</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowArchiveModal(false)} className="px-4 py-2 rounded-xl text-neutral-300 hover:bg-white/5 transition-colors font-medium">Cancelar</button>
                <button onClick={handleArchive} disabled={updateMutation.isPending} className="px-4 py-2 rounded-xl bg-red-500/20 text-red-400 font-bold hover:bg-red-500/30 transition-colors border border-red-500/30 flex items-center gap-2">
                  {updateMutation.isPending && <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />}
                  Arquivar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCertificate && <SignatureCertificate contract={contract} onClose={() => setShowCertificate(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {showAIAssistant && <AIAssistantModal contract={contract} onClose={() => setShowAIAssistant(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {showSignModal && myParty && (
          <SignDocumentModal
            contract={contract}
            party={myParty}
            onClose={() => { setShowSignModal(false); refetch(); }}
            onSuccess={() => refetch()}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-neutral-500 mb-4">
          <Link to="/contracts" className="hover:text-white transition-colors flex items-center gap-1">
            <iconify-icon icon="solar:arrow-left-bold" class="text-xs" /> Contratos
          </Link>
          <span className="text-neutral-700">/</span>
          <span className="text-neutral-600 text-xs font-mono truncate max-w-[160px]">{contract.id}</span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <button onClick={() => toggleFavMutation.mutate({ id: contract.id, isFav: !!contract.isFavorite })} className="hover:scale-110 transition-transform">
                <iconify-icon icon={contract.isFavorite ? 'solar:star-bold' : 'solar:star-linear'} class={contract.isFavorite ? 'text-amber-400' : 'text-neutral-600 hover:text-amber-400'} />
              </button>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${s.cls}`}>{s.label}</span>
              {contract.stellarTxHash && (
                <a href={getExplorerUrl(contract.stellarTxHash)} target="_blank" rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs hover:bg-emerald-500/20 transition-colors flex items-center gap-1">
                  <iconify-icon icon="solar:shield-check-bold" class="text-xs" />
                  Blockchain
                </a>
              )}
            </div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>{contract.title}</h1>
            {contract.description && <p className="text-neutral-400 text-sm mt-1">{contract.description}</p>}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {myParty && (
              <button
                onClick={() => setShowSignModal(true)}
                className="px-4 py-2 rounded-xl bg-emerald-500 text-black font-bold text-sm hover:bg-emerald-400 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/25"
              >
                <iconify-icon icon="solar:pen-bold" class="text-base" />
                Assinar
              </button>
            )}

            <div className="relative">
              <button
                onClick={() => setShowMoreMenu(v => !v)}
                className="px-3 py-2 rounded-xl bg-neutral-800 border border-white/8 text-neutral-400 text-sm hover:bg-neutral-700 hover:text-white transition-colors flex items-center gap-1.5"
              >
                <iconify-icon icon="solar:menu-dots-bold" class="text-base" />
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
                      transition={{ duration: 0.12 }}
                      className="absolute right-0 top-full mt-2 w-52 bg-[#161616] border border-white/10 rounded-2xl shadow-2xl z-30 overflow-hidden"
                    >
                      <div className="p-1.5">
                        <button onClick={() => { setShowAIAssistant(true); setShowMoreMenu(false); }} className="w-full text-left px-3 py-2.5 text-sm text-neutral-300 hover:bg-white/5 hover:text-white flex items-center gap-3 rounded-xl transition-colors">
                          <iconify-icon icon="solar:magic-stick-3-bold" class="text-fuchsia-400 text-base flex-shrink-0" /> Analisar com IA
                        </button>
                      </div>
                      <div className="h-px bg-white/5" />
                      <div className="p-1.5">
                        <button onClick={() => { handleClone(); setShowMoreMenu(false); }} className="w-full text-left px-3 py-2.5 text-sm text-neutral-300 hover:bg-white/5 hover:text-white flex items-center gap-3 rounded-xl transition-colors">
                          <iconify-icon icon="solar:copy-bold" class="text-blue-400 text-base flex-shrink-0" /> Clonar
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
                      {contract.parties.some(p => p.signedAt) && (
                        <>
                          <div className="h-px bg-white/5" />
                          <div className="p-1.5">
                            <button onClick={() => { setShowCertificate(true); setShowMoreMenu(false); }} className="w-full text-left px-3 py-2.5 text-sm text-neutral-300 hover:bg-white/5 hover:text-white flex items-center gap-3 rounded-xl transition-colors">
                              <iconify-icon icon="solar:diploma-verified-bold" class="text-blue-400 text-base flex-shrink-0" /> Ver Certificado
                            </button>
                          </div>
                        </>
                      )}
                      <div className="h-px bg-white/5" />
                      <div className="p-1.5">
                        <button onClick={() => { setShowArchiveModal(true); setShowMoreMenu(false); }} className="w-full text-left px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-3 rounded-xl transition-colors">
                          <iconify-icon icon="solar:archive-bold" class="text-base flex-shrink-0" /> Arquivar
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Meta strip */}
        <div className="flex items-center gap-5 mt-4 text-xs text-neutral-500">
          <span>Criado {new Date(contract.createdAt).toLocaleDateString('pt-BR')}</span>
          <span className="text-neutral-700">·</span>
          <span>Validade {new Date(contract.expiresAt).toLocaleDateString('pt-BR')}</span>
          <span className="text-neutral-700">·</span>
          <span>{contract.clauses.length} cláusula{contract.clauses.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="sticky top-16 z-20 bg-neutral-950/95 backdrop-blur-xl border-b border-white/5">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-neutral-500 hover:text-white'
              }`}
            >
              <iconify-icon icon={tab.icon} class="text-base" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <section className="bg-neutral-900 border border-white/5 rounded-2xl p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Status</p>
                  <p className="text-lg font-bold text-white">{s.label}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Valor</p>
                  <p className="text-lg font-bold text-emerald-400">{contract.value?.toLocaleString('pt-BR', { style: 'currency', currency: contract.currency || 'BRL' })}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Assinado</p>
                  <p className="text-lg font-bold text-white">{signedCount}/{contract.parties.length}</p>
                </div>
              </div>
              {contract.description && (
                <div>
                  <h3 className="text-sm font-bold text-white mb-2">Descrição</h3>
                  <p className="text-neutral-400 text-sm leading-relaxed whitespace-pre-wrap">{contract.description}</p>
                </div>
              )}
            </section>
          </motion.div>
        )}

        {/* Parties Tab */}
        {activeTab === 'parties' && (
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-bold text-white">Signatários</h2>
              <span className="text-xs text-neutral-500">
                {signedCount}/{contract.parties.length} assinado{signedCount !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-white/5 rounded-full mb-5 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${contract.parties.length > 0 ? (signedCount / contract.parties.length) * 100 : 0}%` }}
          />
        </div>

        <div className="space-y-3">
          {contract.parties.map(party => (
            <div key={party.id} className={`flex items-center justify-between p-4 rounded-xl border ${party.signedAt ? 'bg-emerald-500/5 border-emerald-500/15' : 'bg-white/[0.02] border-white/5'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white ${party.signedAt ? 'bg-emerald-500' : 'bg-neutral-700'}`}>
                  {party.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{party.name}</p>
                  <p className="text-xs text-neutral-500">{party.email}</p>
                </div>
              </div>
              <div className="text-right">
                {party.signedAt ? (
                  <div>
                    <p className="text-xs font-bold text-emerald-400 flex items-center gap-1 justify-end">
                      <iconify-icon icon="solar:check-circle-bold" /> Assinado
                    </p>
                    <p className="text-[10px] text-neutral-600 mt-0.5">{new Date(party.signedAt).toLocaleString('pt-BR')}</p>
                  </div>
                ) : party.email === currentUser?.email ? (
                  <button
                    onClick={() => setShowSignModal(true)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500 text-black font-bold text-xs hover:bg-emerald-400 transition-all"
                  >
                    Assinar agora
                  </button>
                ) : (
                  <span className="text-xs text-amber-400 font-medium">Aguardando</span>
                )}
              </div>
            </div>
          ))}
        </div>
          </motion.section>
        )}

        {/* Clauses Tab */}
        {activeTab === 'clauses' && (
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
            <h2 className="text-sm font-bold text-white mb-5">Cláusulas</h2>
            <div className="space-y-5">
              {contract.clauses
                .sort((a, b) => a.order - b.order)
                .map(clause => (
                  <div key={clause.id} className="border-l-2 border-emerald-500/20 pl-5 pb-5 border-b border-white/5 last:border-b-0">
                    <p className="text-sm font-semibold text-white mb-2">{clause.order}. {clause.title}</p>
                    <p className="text-sm text-neutral-400 leading-relaxed whitespace-pre-wrap">{clause.content}</p>
                  </div>
                ))}
            </div>
          </motion.section>
        )}

        {/* Audit Tab */}
        {activeTab === 'audit' && (
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
            {contract.stellarTxHash ? (
              <section className="border-2 border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <iconify-icon icon="solar:shield-check-bold-duotone" class="text-2xl text-emerald-400" />
                  <div>
                    <h2 className="text-sm font-bold text-emerald-400">Registro Blockchain</h2>
                    <p className="text-xs text-emerald-600">Stellar Testnet · Imutável e auditável</p>
                  </div>
                </div>
                <p className="font-mono text-xs text-neutral-400 bg-black/30 rounded-lg px-4 py-3 break-all mb-4">{contract.stellarTxHash}</p>
                <a
                  href={getExplorerUrl(contract.stellarTxHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-colors"
                >
                  <iconify-icon icon="solar:globus-bold" />
                  Auditar na Stellar Explorer
                  <iconify-icon icon="solar:arrow-right-up-bold" class="text-sm" />
                </a>
              </section>
            ) : !allSigned ? (
              <div className="border border-white/5 bg-neutral-900/50 rounded-2xl p-5 flex items-center gap-3 text-sm text-neutral-500">
                <iconify-icon icon="solar:clock-circle-bold" class="text-lg text-neutral-600 flex-shrink-0" />
                <span>O registro na blockchain Stellar acontece automaticamente quando todos os signatários assinarem o documento.</span>
              </div>
            ) : null}

            <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
              <h3 className="text-sm font-bold text-white mb-4">Histórico de Auditoria</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3 pb-3 border-b border-white/5 last:border-b-0">
                  <iconify-icon icon="solar:check-circle-bold" class="text-emerald-500 text-lg flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-white">Contrato criado</p>
                    <p className="text-xs text-neutral-500">{new Date(contract.createdAt).toLocaleString('pt-BR')}</p>
                  </div>
                </div>
                {contract.parties.filter(p => p.signedAt).map((party, idx) => (
                  <div key={party.id} className="flex items-start gap-3 pb-3 border-b border-white/5 last:border-b-0">
                    <iconify-icon icon="solar:pen-bold" class="text-blue-500 text-lg flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-white">{party.name} assinou</p>
                      <p className="text-xs text-neutral-500">{party.signedAt && new Date(party.signedAt).toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.section>
        )}

        {/* Attachments Tab */}
        {activeTab === 'attachments' && (
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-neutral-900 border border-white/5 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Anexos</h2>
              <label className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-lg hover:bg-emerald-500/20 transition-colors cursor-pointer flex items-center gap-1.5">
                {uploadingFile
                  ? <><div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" /> Enviando...</>
                  : <><iconify-icon icon="solar:upload-bold" /> Adicionar arquivo</>}
                <input type="file" multiple className="hidden" onChange={e => uploadAttachment(e.target.files)} />
              </label>
            </div>
            <label
              className="border-2 border-dashed border-white/10 rounded-2xl p-8 text-center cursor-pointer hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all block"
              onDrop={e => { e.preventDefault(); uploadAttachment(e.dataTransfer.files); }}
              onDragOver={e => e.preventDefault()}
            >
              <iconify-icon icon="solar:upload-minimalistic-bold-duotone" class="text-4xl text-neutral-600 mx-auto mb-2 block" />
              <p className="text-sm text-neutral-400">Arraste arquivos aqui ou clique para adicionar</p>
              <p className="text-xs text-neutral-600 mt-1">Qualquer tipo de arquivo</p>
              <input type="file" multiple className="hidden" onChange={e => uploadAttachment(e.target.files)} />
            </label>
            {attachments.length > 0 && (
              <div className="space-y-2">
                {attachments.map(att => (
                  <div key={att.id} className="flex items-center gap-3 p-3 bg-black/30 border border-white/5 rounded-xl">
                    <iconify-icon icon="solar:file-bold-duotone" class="text-2xl text-blue-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">{att.name}</p>
                      <p className="text-xs text-neutral-500">{formatFileSize(att.size_bytes || 0)} • {new Date(att.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <a href={supabase.storage.from('attachments').getPublicUrl(att.file_path).data.publicUrl} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-colors" title="Baixar">
                        <iconify-icon icon="solar:download-minimalistic-bold" />
                      </a>
                      <button type="button" onClick={() => deleteAttachment(att)} className="p-1.5 hover:bg-red-500/10 rounded-lg text-neutral-600 hover:text-red-400 transition-colors" title="Remover">
                        <iconify-icon icon="solar:trash-bin-bold" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {attachments.length === 0 && !uploadingFile && (
              <p className="text-center text-xs text-neutral-600 py-2">Nenhum anexo ainda.</p>
            )}
          </motion.section>
        )}

        {/* Comments Tab */}
        {activeTab === 'comments' && (
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-neutral-900 border border-white/5 rounded-2xl p-6 space-y-5">
            <h2 className="text-sm font-bold text-white">Comentários</h2>
            {/* Novo comentário */}
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden">
                {currentUser?.avatar
                  ? <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" />
                  : currentUser?.name.charAt(0)}
              </div>
              <div className="flex-1">
                <textarea
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addComment(); }}
                  placeholder="Adicione um comentário... (Ctrl+Enter para enviar)"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-emerald-500 resize-none transition-colors"
                  rows={3}
                />
                <button type="button" onClick={addComment} disabled={savingComment || !newComment.trim()}
                  className="mt-2 px-4 py-1.5 rounded-lg bg-emerald-500 text-black text-sm font-bold hover:bg-emerald-400 transition-colors disabled:opacity-50 flex items-center gap-1.5">
                  {savingComment ? <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" /> : null}
                  Comentar
                </button>
              </div>
            </div>
            {/* Lista de comentários */}
            {comments.length === 0
              ? <p className="text-center text-neutral-500 text-sm py-6">Nenhum comentário ainda. Seja o primeiro!</p>
              : (
                <div className="space-y-4">
                  {comments.map(c => (
                    <div key={c.id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neutral-600 to-neutral-800 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden">
                        {c.profiles?.avatar_url
                          ? <img src={c.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                          : (c.profiles?.name || '?').charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-sm font-bold text-white">{c.profiles?.name || 'Usuário'}</span>
                          <span className="text-[10px] text-neutral-500">{new Date(c.created_at).toLocaleString('pt-BR')}</span>
                        </div>
                        <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                        {c.user_id === currentUser?.id && (
                          <button type="button" onClick={async () => { await supabase.from('contract_comments').delete().eq('id', c.id); loadComments(); }}
                            className="mt-1 text-[10px] text-neutral-600 hover:text-red-400 transition-colors">
                            Excluir
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </motion.section>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
              <h3 className="text-sm font-bold text-white mb-4">Privacidade do Contrato</h3>
              <div className="space-y-2">
                {([
                  { value: 'private', label: 'Privado', desc: 'Apenas você e os signatários podem visualizar' },
                  { value: 'organization', label: 'Interno', desc: 'Toda a sua equipe/organização pode visualizar' },
                ] as const).map(opt => (
                  <label key={opt.value} onClick={() => savePrivacy(opt.value)}
                    className={`flex items-center gap-3 cursor-pointer p-3 rounded-xl border transition-all ${
                      privacy === opt.value ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/[0.03] border-white/5 hover:bg-white/5'
                    }`}>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      privacy === opt.value ? 'border-emerald-500' : 'border-neutral-600'
                    }`}>
                      {privacy === opt.value && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{opt.label}</p>
                      <p className="text-xs text-neutral-500">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
              <h3 className="text-sm font-bold text-white mb-4">Informações de Segurança</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <iconify-icon icon="solar:lock-bold" class="text-emerald-400 text-lg" />
                  <div>
                    <p className="text-sm font-medium text-emerald-400">Criptografia em trânsito</p>
                    <p className="text-xs text-emerald-600">TLS 1.3 — dados protegidos na rede</p>
                  </div>
                </div>
                {contract.contractHash && (
                  <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg">
                    <p className="text-xs font-bold text-blue-400 mb-1">Hash SHA-256 do documento</p>
                    <code className="text-[10px] text-neutral-400 font-mono break-all">{contract.contractHash}</code>
                  </div>
                )}
                {contract.stellarTxHash && (
                  <div className="p-3 bg-fuchsia-500/5 border border-fuchsia-500/10 rounded-lg">
                    <p className="text-xs font-bold text-fuchsia-400 mb-1">Transação Stellar (prova de existência)</p>
                    <a href={getExplorerUrl(contract.stellarTxHash)} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] text-neutral-400 font-mono break-all hover:text-fuchsia-400 transition-colors">
                      {contract.stellarTxHash}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </motion.section>
        )}
      </div>
    </div>
  );
}
