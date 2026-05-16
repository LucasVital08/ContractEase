import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useContract, useDeleteContract, useCreateContract, useUpdateContract, useToggleFavorite } from '@/hooks/useContractQueries';
import { useNotificationStore, useAuthStore } from '@/stores';
import SignDocumentModal from '@/components/SignDocumentModal';
import { useStellar } from '@/hooks/useStellar';
import SignatureCertificate from '@/components/SignatureCertificate';
import { downloadContractPDF } from '@/services/pdfGenerator';
import { exportContractToDOCX, exportContractToXML } from '@/services/documentExport';
import { createMultiSig, mintContractNFT, createEscrow } from '@/services/stellar';
import { AIAssistantModal } from '@/components/AIAssistantModal';

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
  const deleteMutation = useDeleteContract();
  const createMutation = useCreateContract();
  const updateMutation = useUpdateContract();
  const toggleFavMutation = useToggleFavorite();
  const { getExplorerUrl } = useStellar();

  const [showSignModal, setShowSignModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);

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

      {/* Signatários */}
      <section className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
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
      </section>

      {/* Cláusulas */}
      <section className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
        <h2 className="text-sm font-bold text-white mb-5">Cláusulas</h2>
        <div className="space-y-5">
          {contract.clauses
            .sort((a, b) => a.order - b.order)
            .map(clause => (
              <div key={clause.id} className="border-l-2 border-emerald-500/20 pl-5">
                <p className="text-sm font-semibold text-white mb-1">{clause.order}. {clause.title}</p>
                <p className="text-sm text-neutral-400 leading-relaxed whitespace-pre-wrap">{clause.content}</p>
              </div>
            ))}
        </div>
      </section>

      {/* Registro Blockchain */}
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
    </div>
  );
}
