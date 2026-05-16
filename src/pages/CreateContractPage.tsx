import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useCreateContract } from '@/hooks/useContractQueries';
import { useNotificationStore } from '@/stores';
import { signingService } from '@/services/supabaseService';
import ModeSelectionModal from '@/components/ModeSelectionModal';
import AdvancedDocumentEditor from '@/components/AdvancedDocumentEditor';
import CreateContractForm from '@/components/CreateContractForm';
import type { ContractType, Party, Clause } from '@/types';

export default function CreateContractPage() {
  const navigate = useNavigate();
  const createMutation = useCreateContract();
  const notify = useNotificationStore(s => s.add);

  const [showModeSelection, setShowModeSelection] = useState(true);
  const [selectedMode, setSelectedMode] = useState<'blank' | 'upload' | 'template' | null>(null);
  const [documentContent, setDocumentContent] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ContractType>('service');
  const [expiresAt, setExpiresAt] = useState('');
  const [parties, setParties] = useState<Omit<Party, 'id' | 'signedAt'>[]>([
    { name: '', email: '', role: 'creator' },
    { name: '', email: '', role: 'counterparty' },
  ]);
  const [clauses, setClauses] = useState<Omit<Clause, 'id'>[]>([
    { order: 1, title: 'Objeto', content: '' },
  ]);

  const [emailSuggestions, setEmailSuggestions] = useState<{ id: string; name: string; email: string }[]>([]);
  const [suggestingForIndex, setSuggestingForIndex] = useState<number | null>(null);

  const handleSubmit = async () => {
    if (!title.trim()) {
      notify({ type: 'error', title: 'Título obrigatório', message: 'Informe o título do documento.' });
      return;
    }
    if (parties.some(p => !p.email.trim())) {
      notify({ type: 'error', title: 'E-mail obrigatório', message: 'Todos os signatários precisam ter e-mail.' });
      return;
    }

    const draft = {
      title,
      description,
      type,
      parties,
      clauses,
      expiresAt: expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      tags: [],
      signatureOrder: 'parallel' as const,
    };

    createMutation.mutate(draft, {
      onSuccess: (newContract) => {
        signingService.notifyContractParties(newContract.id, newContract.title, parties);
        navigate(`/contracts/${newContract.id}`);
        notify({ type: 'success', title: 'Documento criado!', message: 'Notificações enviadas aos signatários.' });
      },
    });
  };

  const updateParty = (i: number, patch: Partial<Omit<Party, 'id' | 'signedAt'>>) => {
    setParties(prev => prev.map((p, idx) => idx === i ? { ...p, ...patch } : p));
  };

  const updateClause = (i: number, patch: Partial<Omit<Clause, 'id'>>) => {
    setClauses(prev => prev.map((c, idx) => idx === i ? { ...c, ...patch } : c));
  };

  if (showModeSelection && !selectedMode) {
    return (
      <AnimatePresence>
        <ModeSelectionModal
          onSelect={(mode) => {
            setSelectedMode(mode);
            setShowModeSelection(false);
          }}
          onCancel={() => navigate(-1)}
        />
      </AnimatePresence>
    );
  }

  if (selectedMode && selectedMode !== 'blank') {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-20">
        <div className="flex items-center justify-between">
          <div>
            <button onClick={() => { setSelectedMode(null); setShowModeSelection(true); }} className="text-neutral-500 hover:text-white text-sm flex items-center gap-1 mb-3 transition-colors">
              <iconify-icon icon="solar:arrow-left-bold" class="text-xs" /> Voltar
            </button>
            <h1 className="text-2xl font-bold text-white font-bricolage">
              {selectedMode === 'upload' ? 'Importar Documento' : 'Usar Template'}
            </h1>
          </div>
        </div>

        <AdvancedDocumentEditor
          mode={selectedMode}
          onSave={async (content, tags) => {
            setDocumentContent(content);
            setSelectedMode('blank');
            notify({ type: 'success', title: 'Documento processado!', message: 'Agora preencha os dados do contrato' });
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div>
        <button onClick={() => { setSelectedMode(null); setShowModeSelection(true); }} className="text-neutral-500 hover:text-white text-sm flex items-center gap-1 mb-3 transition-colors">
          <iconify-icon icon="solar:arrow-left-bold" class="text-xs" /> Voltar
        </button>
        <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>Novo Documento</h1>
        <p className="text-neutral-500 text-sm mt-1">Preencha os dados, adicione os signatários e crie.</p>
      </div>

      {/* Dados do Documento */}
      <section className="bg-neutral-900 border border-white/5 rounded-2xl p-6 space-y-5">
        <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Dados do Documento</h2>

        <div>
          <label className="block text-sm text-neutral-400 mb-1.5">Título *</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Ex: Contrato de Prestação de Serviços"
            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500/50 outline-none text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-neutral-400 mb-1.5">Tipo</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as ContractType)}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500/50 outline-none appearance-none text-sm"
            >
              <option value="service">Prestação de Serviços</option>
              <option value="sale">Compra e Venda</option>
              <option value="rental">Aluguel / Locação</option>
              <option value="employment">Contrato de Trabalho</option>
              <option value="nda">Acordo de Confidencialidade</option>
              <option value="partnership">Parceria Comercial</option>
              <option value="declaration">Declaração</option>
              <option value="receipt">Recibo / Quitação</option>
              <option value="power_of_attorney">Procuração</option>
              <option value="supply">Fornecimento</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-neutral-400 mb-1.5">Válido até</label>
            <input
              type="date"
              value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500/50 outline-none text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-neutral-400 mb-1.5">Descrição</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Breve descrição do objetivo deste documento"
            rows={3}
            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500/50 outline-none text-sm resize-none"
          />
        </div>
      </section>

      {/* Cláusulas */}
      <section className="bg-neutral-900 border border-white/5 rounded-2xl p-6 space-y-4">
        <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Cláusulas</h2>

        {clauses.map((clause, i) => (
          <div key={i} className="border border-white/8 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-500">Cláusula {i + 1}</span>
              {clauses.length > 1 && (
                <button
                  onClick={() => setClauses(clauses.filter((_, idx) => idx !== i).map((c, idx) => ({ ...c, order: idx + 1 })))}
                  className="text-xs text-neutral-600 hover:text-red-400 transition-colors"
                >
                  Remover
                </button>
              )}
            </div>
            <input
              value={clause.title}
              onChange={e => updateClause(i, { title: e.target.value })}
              placeholder="Título da cláusula (ex: Objeto, Pagamento, Rescisão)"
              className="w-full bg-black/40 border border-white/8 rounded-lg px-3 py-2 text-white text-sm font-medium outline-none focus:border-emerald-500/40"
            />
            <textarea
              value={clause.content}
              onChange={e => updateClause(i, { content: e.target.value })}
              placeholder="Texto da cláusula..."
              rows={4}
              className="w-full bg-black/40 border border-white/8 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-emerald-500/40 resize-none"
            />
          </div>
        ))}

        <button
          onClick={() => setClauses(prev => [...prev, { order: prev.length + 1, title: '', content: '' }])}
          className="w-full py-3 border border-dashed border-white/15 rounded-xl text-neutral-500 hover:text-white hover:border-emerald-500/40 transition-all flex items-center justify-center gap-2 text-sm"
        >
          <iconify-icon icon="solar:add-circle-bold" /> Adicionar Cláusula
        </button>
      </section>

      {/* Signatários */}
      <section className="bg-neutral-900 border border-white/5 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Signatários</h2>
          <p className="text-xs text-neutral-600">Serão notificados para assinar</p>
        </div>

        {parties.map((party, i) => (
          <div key={i} className="border border-white/8 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-500">Signatário {i + 1}</span>
              {parties.length > 1 && (
                <button
                  onClick={() => setParties(prev => prev.filter((_, idx) => idx !== i))}
                  className="text-xs text-neutral-600 hover:text-red-400 transition-colors"
                >
                  Remover
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-neutral-600 mb-1">Nome</label>
                <input
                  value={party.name}
                  onChange={e => updateParty(i, { name: e.target.value })}
                  placeholder="Nome completo"
                  className="w-full bg-black/40 border border-white/8 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-emerald-500/40"
                />
              </div>
              <div className="relative">
                <label className="block text-xs text-neutral-600 mb-1">E-mail *</label>
                <input
                  value={party.email}
                  onChange={async e => {
                    const val = e.target.value;
                    updateParty(i, { email: val });
                    if (val.length >= 2) {
                      setSuggestingForIndex(i);
                      const results = await signingService.lookupProfiles(val.replace(/^@/, ''));
                      setSuggestingForIndex(prev => {
                        if (prev === i) setEmailSuggestions(results);
                        return prev;
                      });
                    } else {
                      setSuggestingForIndex(null);
                      setEmailSuggestions([]);
                    }
                  }}
                  onBlur={() => setTimeout(() => { setSuggestingForIndex(null); setEmailSuggestions([]); }, 200)}
                  placeholder="email@exemplo.com"
                  className="w-full bg-black/40 border border-white/8 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-emerald-500/40"
                />
                {suggestingForIndex === i && emailSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-neutral-800 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                    {emailSuggestions.map(profile => (
                      <button
                        key={profile.id}
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => {
                          updateParty(i, { email: profile.email, name: party.name || profile.name });
                          setSuggestingForIndex(null);
                          setEmailSuggestions([]);
                        }}
                        className="w-full text-left px-3 py-2.5 hover:bg-white/5 flex items-center gap-2.5 transition-colors border-b border-white/5 last:border-0"
                      >
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {profile.name?.charAt(0)?.toUpperCase() ?? '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-white font-medium truncate">{profile.name}</p>
                          <p className="text-xs text-neutral-400 truncate">{profile.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs text-neutral-600 mb-1">Papel</label>
                <select
                  value={party.role}
                  onChange={e => updateParty(i, { role: e.target.value as any })}
                  className="w-full bg-black/40 border border-white/8 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-emerald-500/40"
                >
                  <option value="creator">Criador</option>
                  <option value="counterparty">Contraparte</option>
                  <option value="witness">Testemunha</option>
                </select>
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={() => setParties(prev => [...prev, { name: '', email: '', role: 'counterparty' }])}
          className="w-full py-3 border border-dashed border-white/15 rounded-xl text-neutral-500 hover:text-white hover:border-emerald-500/40 transition-all flex items-center justify-center gap-2 text-sm"
        >
          <iconify-icon icon="solar:user-plus-bold" /> Adicionar Signatário
        </button>
      </section>

      {/* Submit */}
      <div className="flex items-center justify-between gap-4 pt-2">
        <p className="text-xs text-neutral-600 flex items-center gap-1.5 leading-relaxed">
          <iconify-icon icon="solar:shield-check-bold" class="text-emerald-700 flex-shrink-0 text-base" />
          As partes serão notificadas e a assinatura será registrada automaticamente na blockchain Stellar.
        </p>
        <button
          onClick={handleSubmit}
          disabled={createMutation.isPending}
          className="flex-shrink-0 px-6 py-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-emerald-500/25 text-sm"
        >
          {createMutation.isPending
            ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            : <iconify-icon icon="solar:check-circle-bold" class="text-base" />}
          {createMutation.isPending ? 'Criando...' : 'Criar e Notificar Partes'}
        </button>
      </div>
    </div>
  );
}
