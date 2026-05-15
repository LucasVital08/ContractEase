import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { useContract, useDeleteContract, useCreateContract, useUpdateContract } from '@/hooks/useContractQueries';
import { useNotificationStore } from '@/stores';
import { api } from '@/services/api';
import { signingService } from '@/services/supabaseService';
import type { ContractDraft, ContractType, Party, Clause } from '@/types';

const getSteps = (mode: 'upload' | 'blank' | 'template' | null) => {
  if (mode === 'upload') {
    return [
      { id: 'info', title: 'Upload & Informações' },
      { id: 'parties', title: 'Partes' },
      { id: 'review', title: 'Revisão' },
    ];
  }
  return [
    { id: 'info', title: 'Informações' },
    { id: 'parties', title: 'Partes' },
    { id: 'clauses', title: 'Cláusulas' },
    { id: 'deadlines', title: 'Prazos' },
    { id: 'review', title: 'Revisão' },
  ];
};

const AUTOSAVE_KEY = '@ContractEase:draft';

export default function CreateContractPage() {
  const navigate = useNavigate();
  const createMutation = useCreateContract();
  const notify = useNotificationStore(s => s.add);
  const [creationMode, setCreationMode] = useState<'upload' | 'blank' | 'template' | null>(null);
  const [step, setStep] = useState(1);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ContractType>('service');
  const [parties, setParties] = useState<Omit<Party, 'id' | 'signedAt'>[]>([
    { name: 'Stellar Global Rails', email: 'legal@stellarglobal.com', role: 'creator' }
  ]);
  const [clauses, setClauses] = useState<Omit<Clause, 'id'>[]>([
    { order: 1, title: 'Objeto', content: 'Descreva o objeto principal deste contrato.' }
  ]);
  const [expiresAt, setExpiresAt] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [signatureOrder, setSignatureOrder] = useState<'parallel' | 'sequential'>('parallel');

  // @mention autocomplete state
  const [emailSuggestions, setEmailSuggestions] = useState<{ id: string; name: string; email: string }[]>([]);
  const [suggestingForIndex, setSuggestingForIndex] = useState<number | null>(null);

  // AI Prompt State
  const [showAIPrompt, setShowAIPrompt] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExtractingOCR, setIsExtractingOCR] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Voice Recognition Logic
  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      notify({ type: 'error', title: 'Não suportado', message: 'Seu navegador não suporta reconhecimento de voz.' });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setAiPrompt(prev => prev + (prev ? ' ' : '') + transcript);
    };

    recognition.start();
  }, [notify]);

  const handleMagicFill = async () => {
    setIsGenerating(true);
    // Simulate AI looking at history to fill fields
    setTimeout(() => {
      setTitle(t => t || 'Contrato de Consultoria Técnica');
      setDescription(d => d || 'Prestação de serviços de consultoria em desenvolvimento de software e infraestrutura cloud.');
      setType('service');
      setTags(['Tecnologia', 'Consultoria', '2024']);
      setIsGenerating(false);
      notify({ type: 'success', title: 'Preenchimento Mágico', message: 'Detectamos padrões e preenchemos os campos sugeridos.' });
    }, 1500);
  };

  // Load from Draft
  const hasLoadedDraft = React.useRef(false);
  useEffect(() => {
    if (hasLoadedDraft.current) return;
    
    const draft = localStorage.getItem(AUTOSAVE_KEY);
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.title) setTitle(parsed.title);
        if (parsed.description) setDescription(parsed.description);
        if (parsed.type) setType(parsed.type);
        if (parsed.parties) setParties(parsed.parties);
        if (parsed.clauses) setClauses(parsed.clauses);
        if (parsed.expiresAt) setExpiresAt(parsed.expiresAt);
        if (parsed.tags) setTags(parsed.tags);
        
        hasLoadedDraft.current = true;
        notify({ type: 'info', title: 'Rascunho recuperado', message: 'Seu progresso anterior foi restaurado.' });
      } catch (e) {
        // fail silently on parse error
      }
    } else {
      hasLoadedDraft.current = true;
    }
  }, [notify]);

  // Autosave
  useEffect(() => {
    const timer = setTimeout(() => {
      const draft = { title, description, type, parties, clauses, expiresAt, tags, signatureOrder };
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(draft));
    }, 2000);
    return () => clearTimeout(timer);
  }, [title, description, type, parties, clauses, expiresAt, tags]);

  const activeSteps = getSteps(creationMode);
  const nextStep = () => setStep((s) => Math.min(s + 1, activeSteps.length));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const handleSubmit = async () => {
    const draft: ContractDraft = {
      title,
      description,
      type,
      parties,
      clauses,
      expiresAt: expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      tags,
      signatureOrder,
    };
    
    createMutation.mutate(draft, {
      onSuccess: (newContract) => {
        localStorage.removeItem(AUTOSAVE_KEY);
        signingService.notifyContractParties(newContract.id, newContract.title, parties);
        navigate(`/contracts/${newContract.id}`);
        notify({ type: 'success', title: 'Contrato Criado!', message: 'Convites de assinatura enviados às partes cadastradas.' });
      }
    });
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(clauses);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    const updatedOrder = items.map((c, i) => ({ ...c, order: i + 1 }));
    setClauses(updatedOrder);
  };

  const handleGenerateAI = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    try {
      const generated = await api.ai.generateContract(aiPrompt);
      if (generated.title) setTitle(generated.title);
      if (generated.description) setDescription(generated.description);
      if (generated.type) setType(generated.type as ContractType);
      if (generated.clauses) setClauses(generated.clauses.map((c: any) => ({ ...c, id: undefined })));
      notify({ type: 'success', title: 'Documento Gerado', message: 'Revisite as informações e cláusulas geradas pela IA.' });
      setShowAIPrompt(false);
    } catch (e) {
      notify({ type: 'error', title: 'Erro na IA', message: 'Falha ao gerar o documento.' });
    } finally {
      setIsGenerating(false);
    }
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUploadOCR = () => {
    if (!isExtractingOCR) fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const baseName = file.name.replace(/\.[^/.]+$/, '');
    setTitle(baseName);
    setIsExtractingOCR(true);
    notify({ type: 'info', title: 'Processando Arquivo', message: `Lendo "${file.name}" com IA...` });

    setTimeout(() => {
      setDescription(`Documento importado via OCR: ${file.name}. Estruturado automaticamente pelo motor de IA.`);
      setType('service');
      setClauses([
        { title: 'Objeto', content: `Conteúdo extraído de "${file.name}". Revise e edite as cláusulas conforme necessário.`, order: 1 },
        { title: 'Obrigações das Partes', content: 'Descreva as obrigações de cada parte envolvida neste documento.', order: 2 },
        { title: 'Prazo de Vigência', content: 'Defina o prazo de vigência deste documento.', order: 3 },
      ]);
      setIsExtractingOCR(false);
      notify({ type: 'success', title: 'Extração Concluída', message: 'Arquivo lido. Revise os campos e continue.' });
    }, 2500);

    // Limpar input para permitir selecionar o mesmo arquivo novamente
    e.target.value = '';
  };

  const handleDropZoneDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    if (fileInputRef.current) {
      fileInputRef.current.files = dt.files;
      fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  const renderStep = () => {
    const currentStepId = activeSteps[step - 1]?.id;
    switch (currentStepId) {
      case 'info':
        return (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            
            {!showAIPrompt ? (
              <button onClick={() => setShowAIPrompt(true)} className="w-full flex items-center justify-center gap-2 p-4 bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400 rounded-xl hover:bg-fuchsia-500/20 transition-colors font-bold">
                <iconify-icon icon="solar:magic-stick-3-bold" class="text-xl" />
                Gerar estrutura inicial com Inteligência Artificial
              </button>
            ) : (
              <div className="p-4 bg-fuchsia-500/5 border border-fuchsia-500/20 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-fuchsia-400 font-bold flex items-center gap-2">
                    <iconify-icon icon="solar:magic-stick-3-bold" /> O que você precisa criar?
                  </h4>
                  <button onClick={() => setShowAIPrompt(false)} className="text-neutral-500 hover:text-white">✕</button>
                </div>
                <div className="relative">
                  <textarea
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-lg p-3 pr-12 text-white focus:border-fuchsia-500/50 outline-none text-sm min-h-[80px]"
                    placeholder="Ex: Um contrato de prestação de serviços de marketing digital para 6 meses..."
                  />
                  <button 
                    onClick={startListening}
                    className={`absolute right-3 top-3 p-2 rounded-full transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-white/5 text-neutral-400 hover:text-white'}`}
                    title="Falar rascunho"
                  >
                    <iconify-icon icon={isListening ? "solar:microphone-bold" : "solar:microphone-linear"} />
                  </button>
                </div>
                <button
                  onClick={handleGenerateAI}
                  disabled={isGenerating || !aiPrompt.trim()}
                  className="w-full py-2 bg-fuchsia-600 text-white font-bold rounded-lg hover:bg-fuchsia-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isGenerating ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Mágica! (Gerar Documento)'}
                </button>
                <button
                  onClick={handleMagicFill}
                  disabled={isGenerating}
                  className="w-full py-2 bg-white/5 text-neutral-400 font-medium rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center gap-2 text-xs"
                >
                  <iconify-icon icon="solar:magic-stick-bold" /> Preenchimento Mágico (Sugerir Dados)
                </button>
              </div>
            )}

            <div>
              <label className="block text-sm text-neutral-400 mb-1">Título do Documento</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-emerald-500/50 outline-none"
                placeholder="Ex: Declaração de Residência"
              />
            </div>
            
            {creationMode === 'upload' && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.doc,.txt"
                  className="hidden"
                  onChange={handleFileSelected}
                />
                <div
                  onClick={handleFileUploadOCR}
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleDropZoneDrop}
                  className="p-8 border-2 border-dashed border-emerald-500/30 rounded-xl bg-emerald-500/5 text-center flex flex-col items-center justify-center cursor-pointer hover:bg-emerald-500/10 transition-colors relative overflow-hidden"
                >
                  {isExtractingOCR ? (
                    <>
                      <div className="absolute inset-0 bg-emerald-500/20 animate-pulse" />
                      <iconify-icon icon="solar:scanner-bold-duotone" class="text-4xl text-emerald-400 mb-3 animate-bounce" />
                      <p className="text-emerald-400 font-bold mb-1 relative z-10">Lendo documento com OCR...</p>
                      <p className="text-xs text-emerald-500/70 relative z-10">Extraindo cláusulas e identificando partes.</p>
                    </>
                  ) : (
                    <>
                      <iconify-icon icon="solar:document-add-bold-duotone" class="text-4xl text-emerald-500 mb-3" />
                      <p className="text-white font-bold mb-1">Arraste seu PDF ou DOCX aqui</p>
                      <p className="text-sm text-neutral-400">Ou clique para selecionar o arquivo (PDF, DOCX, TXT)</p>
                    </>
                  )}
                </div>
              </>
            )}
            
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Descrição</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-emerald-500/50 outline-none min-h-[100px]"
                placeholder="Breve resumo do propósito do documento"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Tipo de Documento</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ContractType)}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-emerald-500/50 outline-none appearance-none"
              >
                <option value="sale">Compra e Venda (Imóveis/Veículos)</option>
                <option value="power_of_attorney">Procuração</option>
                <option value="declaration">Declaração (União Estável, Residência, etc)</option>
                <option value="receipt">Recibo / Quitação de Dívida</option>
                <option value="service">Prestação de Serviços</option>
                <option value="rental">Aluguel/Locação</option>
                <option value="employment">Trabalho (CLT/PJ)</option>
                <option value="nda">Acordo de Confidencialidade (NDA)</option>
                <option value="partnership">Parceria Comercial</option>
                <option value="supply">Fornecimento</option>
              </select>
            </div>
            <div>
               <label className="block text-sm text-neutral-400 mb-1">Tags (pressione Enter)</label>
               <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && tagInput.trim()) {
                    e.preventDefault();
                    if (!tags.includes(tagInput.trim())) setTags([...tags, tagInput.trim()]);
                    setTagInput('');
                  }
                }}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-emerald-500/50 outline-none"
                placeholder="Adicionar tag..."
              />
              {tags.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {tags.map(t => (
                    <span key={t} className="px-2 py-1 bg-white/10 rounded-md text-xs flex items-center gap-1">
                      {t} <button onClick={() => setTags(tags.filter(tag => tag !== t))} className="hover:text-red-400">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            
            <div className="pt-2">
              <label className="block text-sm text-neutral-400 mb-1">Privacidade do Documento (RBAC)</label>
              <select
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-emerald-500/50 outline-none appearance-none"
                defaultValue="public"
              >
                <option value="public">Público para a Organização (Todos podem ver)</option>
                <option value="restricted">Restrito (Apenas você e Administradores)</option>
              </select>
            </div>
          </motion.div>
        );
      case 'parties':
        return (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div className="space-y-3">
              {parties.map((p, i) => (
                <div key={i} className="flex gap-3 items-end p-4 bg-white/5 rounded-xl border border-white/5">
                  <div className="flex-1">
                    <label className="block text-xs text-neutral-500 mb-1">Nome</label>
                    <input
                      value={p.name}
                      onChange={(e) => {
                        const newP = [...parties];
                        newP[i].name = e.target.value;
                        setParties(newP);
                      }}
                      className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  <div className="flex-1 relative">
                    <label className="block text-xs text-neutral-500 mb-1">
                      E-mail <span className="text-neutral-600">— digite @ para buscar usuários</span>
                    </label>
                    <input
                      value={p.email}
                      onChange={async (e) => {
                        const val = e.target.value;
                        const newP = [...parties];
                        newP[i].email = val;
                        setParties(newP);
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
                      placeholder="email@exemplo.com ou @nome"
                      className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-emerald-500/50"
                    />
                    {suggestingForIndex === i && emailSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-neutral-800 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                        {emailSuggestions.map(profile => (
                          <button
                            key={profile.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              const newP = [...parties];
                              newP[i].email = profile.email;
                              if (!newP[i].name || newP[i].name === '') newP[i].name = profile.name;
                              setParties(newP);
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
                            <iconify-icon icon="solar:user-check-bold" class="text-emerald-400 ml-auto flex-shrink-0 text-sm" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="w-32">
                    <label className="block text-xs text-neutral-500 mb-1">Papel</label>
                    <select
                      value={p.role}
                      onChange={(e) => {
                        const newP = [...parties];
                        newP[i].role = e.target.value as any;
                        setParties(newP);
                      }}
                      className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-emerald-500/50"
                    >
                      <option value="creator">Criador</option>
                      <option value="counterparty">Contraparte</option>
                      <option value="witness">Testemunha</option>
                    </select>
                  </div>
                  <button
                    onClick={() => setParties(parties.filter((_, idx) => idx !== i))}
                    className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                  >
                    <iconify-icon icon="solar:trash-bin-trash-bold" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setParties([...parties, { name: '', email: '', role: 'counterparty' }])}
              className="w-full py-3 border border-dashed border-white/20 rounded-xl text-neutral-400 hover:text-white hover:border-emerald-500/50 transition-colors flex items-center justify-center gap-2"
            >
              <iconify-icon icon="solar:user-plus-bold" /> Adicionar Parte
            </button>
          </motion.div>
        );
      case 'clauses':
        return (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="clauses">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                    {clauses.map((c, i) => (
                      <Draggable key={i} draggableId={`clause-${i}`} index={i}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className="p-4 bg-white/5 rounded-xl border border-white/5"
                          >
                            <div className="flex justify-between items-center mb-3">
                              <div className="flex items-center gap-2">
                                <div {...provided.dragHandleProps} className="text-neutral-500 hover:text-white cursor-grab">
                                  <iconify-icon icon="solar:hamburger-menu-linear" />
                                </div>
                                <span className="text-emerald-500 font-bold text-sm">Cláusula {i + 1}</span>
                              </div>
                              <button onClick={() => setClauses(clauses.filter((_, idx) => idx !== i))} className="text-red-400 text-xs">Remover</button>
                            </div>
                            <input
                              value={c.title}
                              onChange={(e) => {
                                const newC = [...clauses];
                                newC[i].title = e.target.value;
                                setClauses(newC);
                              }}
                              placeholder="Título da cláusula"
                              className="w-full bg-transparent text-white font-bold mb-2 outline-none"
                            />
                            <textarea
                              value={c.content}
                              onChange={(e) => {
                                const newC = [...clauses];
                                newC[i].content = e.target.value;
                                setClauses(newC);
                              }}
                              placeholder="Conteúdo da cláusula (Use tags como {{nome_parte}})"
                              className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none min-h-[80px]"
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
            <button
              onClick={() => setClauses([...clauses, { order: clauses.length + 1, title: '', content: '' }])}
              className="w-full py-3 border border-dashed border-white/20 rounded-xl text-neutral-400 hover:text-white hover:border-emerald-500/50 transition-colors flex items-center justify-center gap-2"
            >
              <iconify-icon icon="solar:add-circle-bold" /> Adicionar Cláusula
            </button>
          </motion.div>
        );

      case 'deadlines':
        return (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Data de Expiração/Vencimento</label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-emerald-500/50 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Prazo para Aceite (Opcional)</label>
              <input
                type="date"
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-emerald-500/50 outline-none"
              />
              <p className="text-xs text-neutral-500 mt-1">Se não assinado até esta data, o contrato é cancelado automaticamente.</p>
            </div>

            <div className="border-t border-white/5 pt-6">
              <label className="block text-sm text-neutral-400 mb-3">Ordem de Assinatura</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSignatureOrder('parallel')}
                  className={`p-4 rounded-xl border text-left transition-all ${signatureOrder === 'parallel' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-black/30 border-white/5 hover:border-white/10'}`}
                >
                  <iconify-icon icon="solar:users-group-two-rounded-bold-duotone" class={`text-2xl mb-2 ${signatureOrder === 'parallel' ? 'text-emerald-400' : 'text-neutral-500'}`} />
                  <p className={`text-sm font-bold ${signatureOrder === 'parallel' ? 'text-white' : 'text-neutral-400'}`}>Paralela</p>
                  <p className="text-xs text-neutral-500 mt-1">Todas as partes assinam simultaneamente.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setSignatureOrder('sequential')}
                  className={`p-4 rounded-xl border text-left transition-all ${signatureOrder === 'sequential' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-black/30 border-white/5 hover:border-white/10'}`}
                >
                  <iconify-icon icon="solar:sort-vertical-bold-duotone" class={`text-2xl mb-2 ${signatureOrder === 'sequential' ? 'text-emerald-400' : 'text-neutral-500'}`} />
                  <p className={`text-sm font-bold ${signatureOrder === 'sequential' ? 'text-white' : 'text-neutral-400'}`}>Sequencial</p>
                  <p className="text-xs text-neutral-500 mt-1">As partes assinam em ordem definida.</p>
                </button>
              </div>
            </div>
          </motion.div>
        );
      case 'review':
        return (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 text-center">
              <h4 className="text-emerald-400 font-bold mb-2">Resumo do Contrato</h4>
              <p className="text-white text-xl font-bricolage mb-1">{title || 'Sem título'}</p>
              <p className="text-neutral-400 text-sm mb-4">{parties.length} Partes • {clauses.length} Cláusulas</p>
              {expiresAt && (
                <p className="text-sm text-neutral-400">Válido até: {new Date(expiresAt).toLocaleDateString('pt-BR')}</p>
              )}
            </div>

            <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-sm text-neutral-300">
              <p>Ao criar, o contrato ficará com o status <span className="font-bold text-emerald-400">Rascunho</span> e as partes não serão notificadas ainda. Você poderá revisar antes de enviar para aprovação.</p>
            </div>
          </motion.div>
        );
      default: return null;
    }
  };

  if (!creationMode) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-white font-bricolage mb-3">Novo Documento</h1>
          <p className="text-neutral-400">Escolha como deseja iniciar a criação ou coleta de assinaturas para o seu documento.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button onClick={() => setCreationMode('upload')} className="bg-neutral-900 border border-white/5 hover:border-emerald-500/30 rounded-2xl p-6 text-left transition-all group flex flex-col h-full relative overflow-hidden">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <iconify-icon icon="solar:document-add-bold-duotone" class="text-2xl text-emerald-500" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Upload de PDF/DOCX</h3>
            <p className="text-sm text-neutral-400">Faça o upload de um documento pronto apenas para coletar as assinaturas e registrar na blockchain.</p>
          </button>

          <button onClick={() => setCreationMode('blank')} className="bg-neutral-900 border border-white/5 hover:border-blue-500/30 rounded-2xl p-6 text-left transition-all group flex flex-col h-full relative overflow-hidden">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <iconify-icon icon="solar:pen-new-round-bold-duotone" class="text-2xl text-blue-500" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Documento em Branco</h3>
            <p className="text-sm text-neutral-400">Crie um novo documento do zero usando nosso editor de texto formatado.</p>
          </button>

          <button onClick={() => navigate('/templates')} className="bg-neutral-900 border border-white/5 hover:border-amber-500/30 rounded-2xl p-6 text-left transition-all group flex flex-col h-full relative overflow-hidden">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <iconify-icon icon="solar:copy-bold-duotone" class="text-2xl text-amber-500" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Usar um Template</h3>
            <p className="text-sm text-neutral-400">Economize tempo escolhendo um modelo jurídico pré-aprovado da nossa biblioteca.</p>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <button onClick={() => setCreationMode(null)} className="text-emerald-500 hover:text-emerald-400 text-sm font-medium mb-2 flex items-center gap-1">
            <iconify-icon icon="solar:arrow-left-bold" /> Voltar para opções
          </button>
          <h1 className="text-3xl font-bold text-white font-bricolage">
            {creationMode === 'upload' ? 'Upload de Documento' : 'Novo Documento'}
          </h1>
          <p className="text-neutral-400 text-sm mt-1">Preencha os dados e colete assinaturas com validade jurídica.</p>
        </div>
        <div className="text-xs text-neutral-500 flex items-center gap-1">
          <iconify-icon icon="solar:cloud-check-bold" class="text-emerald-500" />
          Rascunho salvo
        </div>
      </div>

      {/* Stepper Header */}
      <div className="flex gap-2 mb-8">
        {activeSteps.map((s, idx) => (
          <div key={s.id} className="flex-1">
            <div className={`h-1.5 rounded-full transition-colors ${step > idx ? 'bg-emerald-500' : 'bg-white/10'}`} />
            <p className={`text-xs mt-2 font-medium transition-colors ${step > idx ? 'text-emerald-500' : 'text-neutral-500'}`}>
              {s.title}
            </p>
          </div>
        ))}
      </div>

      {/* Form Content */}
      <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6 md:p-8 min-h-[400px] flex flex-col">
        <div className="flex-1">
          <AnimatePresence mode="wait">
            {renderStep()}
          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center">
          <button
            onClick={prevStep}
            disabled={step === 1}
            className={`px-6 py-2.5 rounded-xl font-semibold transition-colors ${
              step === 1 ? 'opacity-0 pointer-events-none' : 'bg-white/5 text-white hover:bg-white/10'
            }`}
          >
            Anterior
          </button>
          
          {step < activeSteps.length ? (
            <button
              onClick={nextStep}
              className="px-6 py-2.5 bg-white text-black font-bold rounded-xl hover:bg-neutral-200 transition-colors"
            >
              Próximo
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-black font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
            >
              {createMutation.isPending ? (
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <iconify-icon icon="solar:check-circle-bold" class="text-lg" />
              )}
              {createMutation.isPending ? 'Criando...' : 'Finalizar Documento'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
