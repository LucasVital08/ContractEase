import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { Contract } from '@/types/contract';

interface AIAssistantModalProps {
  contract: Contract;
  onClose: () => void;
}

export function AIAssistantModal({ contract, onClose }: AIAssistantModalProps) {
  const [analyzing, setAnalyzing] = useState(true);
  const [activeTab, setActiveTab] = useState<'summary' | 'risk' | 'chat'>('summary');
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([
    { role: 'ai', text: 'Olá! Sou seu assistente jurídico. Como posso ajudar com este documento?' }
  ]);
  const [healthScore, setHealthScore] = useState<number | null>(null);
  const [abusiveClauses, setAbusiveClauses] = useState<{ clauseId: string; risk: string; reason: string }[]>([]);
  const [translation, setTranslation] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    const initAnalysis = async () => {
      setAnalyzing(true);
      try {
        const [score, risks] = await Promise.all([
          api.ai.calculateHealthScore(contract),
          api.ai.detectAbusiveClauses(contract.clauses)
        ]);
        setHealthScore(score);
        setAbusiveClauses(risks);
      } finally {
        setAnalyzing(false);
      }
    };
    initAnalysis();
  }, [contract]);

  const handleTranslate = async (lang: 'PT' | 'EN' | 'ES') => {
    setTranslating(true);
    try {
      const allContent = contract.clauses.map(c => c.content).join('\n');
      const result = await api.ai.translateClause(allContent, lang);
      setTranslation(result);
      setActiveTab('summary'); // Show summary where translation will appear
    } finally {
      setTranslating(false);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    setMessages(prev => [...prev, { role: 'user', text: chatInput }]);
    setChatInput('');
    
    // Simulate AI response
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: 'ai', 
        text: 'Baseado no documento atual, parece que as obrigações estão bem definidas. Mas recomendo revisar a cláusula de rescisão para maior clareza.' 
      }]);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ x: '100%' }} 
        animate={{ x: 0 }} 
        exit={{ x: '100%' }} 
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="w-full max-w-md bg-neutral-900 border-l border-white/10 h-full flex flex-col shadow-2xl"
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-fuchsia-700 flex items-center justify-center text-white shadow-lg">
              <iconify-icon icon="solar:magic-stick-3-bold" class="text-xl" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight font-bricolage">Assistente Jurídico (IA)</h2>
              <p className="text-xs text-neutral-400">Análise inteligente de documentos</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-neutral-400 hover:bg-white/10 hover:text-white transition-colors">
            <iconify-icon icon="solar:close-circle-bold" class="text-xl" />
          </button>
        </div>

        {analyzing ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="relative w-20 h-20 mb-6">
              <div className="absolute inset-0 border-4 border-fuchsia-500/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-fuchsia-500 border-t-transparent rounded-full animate-spin"></div>
              <iconify-icon icon="solar:document-text-bold" class="text-3xl text-fuchsia-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Analisando Documento...</h3>
            <p className="text-neutral-400 text-sm">O modelo está lendo as cláusulas e identificando possíveis riscos e anomalias estruturais.</p>
          </div>
        ) : (
          <>
            <div className="flex p-2 border-b border-white/5">
              <button 
                onClick={() => setActiveTab('summary')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'summary' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'}`}
              >
                Resumo
              </button>
              <button 
                onClick={() => setActiveTab('risk')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'risk' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'}`}
              >
                Análise de Risco
              </button>
              <button 
                onClick={() => setActiveTab('chat')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'chat' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'}`}
              >
                Chat
              </button>
            </div>
            
            {/* Health Score Banner */}
            {!analyzing && healthScore !== null && (
              <div className="mx-6 mt-4 p-3 bg-gradient-to-r from-emerald-500/10 to-transparent border-l-4 border-emerald-500 rounded-r-xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-emerald-500 uppercase font-bold">Score de Saúde Jurídica</p>
                  <p className="text-white font-bold">{healthScore}/100 - Excelente</p>
                </div>
                <iconify-icon icon="solar:shield-check-bold" class="text-2xl text-emerald-500" />
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10">
              {activeTab === 'summary' && (
                <div className="space-y-6">
                  <div className="bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-xl p-4">
                    <h4 className="text-fuchsia-400 font-bold mb-2 flex items-center gap-2">
                      <iconify-icon icon="solar:document-add-bold" /> Resumo Executivo
                    </h4>
                    <p className="text-sm text-neutral-300 leading-relaxed">
                      Este documento é identificado como um(a) <strong>{contract.type}</strong>. Ele envolve {contract.parties.length} partes signatárias e contém {contract.clauses.length} cláusulas primárias. O objetivo principal parece ser estabelecer obrigações de prestação de serviços e confidencialidade.
                    </p>
                  </div>

                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                    <h4 className="text-blue-400 font-bold mb-2 flex items-center gap-2 text-sm">
                      <iconify-icon icon="solar:user-bold" /> Versão para Leigos (TL;DR)
                    </h4>
                    <p className="text-xs text-neutral-400 leading-relaxed italic">
                      "Você está concordando em prestar os serviços técnicos descritos, recebendo em dia, e mantendo segredo sobre os dados da empresa. Se quiser sair, precisa avisar com 30 dias de antecedência."
                    </p>
                  </div>

                  {translation && (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                      <h4 className="text-white font-bold mb-2 flex items-center gap-2 text-sm">
                        <iconify-icon icon="solar:globus-bold" /> Versão Traduzida
                      </h4>
                      <p className="text-xs text-neutral-300 whitespace-pre-wrap">{translation}</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleTranslate('EN')}
                      disabled={translating}
                      className="flex-1 py-2 bg-neutral-800 rounded-lg text-xs text-white hover:bg-neutral-700 transition-colors flex items-center justify-center gap-2"
                    >
                      {translating ? <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <iconify-icon icon="solar:globus-bold" />}
                      Traduzir (EN)
                    </button>
                    <button 
                      onClick={() => handleTranslate('ES')}
                      disabled={translating}
                      className="flex-1 py-2 bg-neutral-800 rounded-lg text-xs text-white hover:bg-neutral-700 transition-colors flex items-center justify-center gap-2"
                    >
                      {translating ? <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <iconify-icon icon="solar:globus-bold" />}
                      Traduzir (ES)
                    </button>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-white mb-3">Pontos Chave Identificados</h4>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2 text-sm text-neutral-400">
                        <iconify-icon icon="solar:check-circle-bold" class="text-emerald-500 mt-0.5" />
                        Objeto do documento claramente definido.
                      </li>
                      <li className="flex items-start gap-2 text-sm text-neutral-400">
                        <iconify-icon icon="solar:check-circle-bold" class="text-emerald-500 mt-0.5" />
                        Qualificação das partes está completa.
                      </li>
                      <li className="flex items-start gap-2 text-sm text-neutral-400">
                        <iconify-icon icon="solar:danger-triangle-bold" class="text-amber-500 mt-0.5" />
                        Falta foro de eleição explícito para resolução de conflitos.
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {activeTab === 'risk' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between bg-black/30 p-4 rounded-xl border border-white/5">
                    <div>
                      <p className="text-sm text-neutral-400">Score de Segurança</p>
                      <h3 className="text-3xl font-bold text-emerald-400 font-bricolage">85<span className="text-lg text-neutral-500">/100</span></h3>
                    </div>
                    <div className="w-16 h-16 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 flex items-center justify-center transform -rotate-45">
                      <iconify-icon icon="solar:shield-check-bold" class="text-2xl text-emerald-500 rotate-45" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-white mb-2">Cláusulas de Atenção</h4>
                    
                    {abusiveClauses.length > 0 ? abusiveClauses.map((ac, idx) => (
                      <div key={idx} className={`border p-4 rounded-xl ${ac.risk === 'HIGH' ? 'bg-red-500/10 border-red-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
                        <div className={`flex items-center gap-2 font-bold mb-1 text-sm ${ac.risk === 'HIGH' ? 'text-red-400' : 'text-amber-400'}`}>
                          <iconify-icon icon="solar:danger-circle-bold" /> Cláusula Potencialmente Abusiva
                        </div>
                        <p className="text-xs text-neutral-400">{ac.reason}</p>
                      </div>
                    )) : (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl">
                        <div className="flex items-center gap-2 text-emerald-400 font-bold mb-1 text-sm">
                          <iconify-icon icon="solar:check-circle-bold" /> Nenhuma cláusula abusiva detectada
                        </div>
                        <p className="text-xs text-neutral-400">O documento parece estar em conformidade com as normas padrão.</p>
                      </div>
                    )}

                    <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl">
                      <div className="flex items-center gap-2 text-blue-400 font-bold mb-1 text-sm">
                        <iconify-icon icon="solar:info-circle-bold" /> Sugestão de Melhoria
                      </div>
                      <p className="text-xs text-neutral-400">Recomendado adicionar prazo de validade (ex: 5 anos após término) para obrigações de sigilo.</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'chat' && (
                <div className="h-full flex flex-col">
                  <div className="flex-1 space-y-4 mb-4">
                    {messages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl p-3 text-sm ${msg.role === 'user' ? 'bg-emerald-500 text-black font-medium' : 'bg-white/10 text-neutral-200'}`}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={handleSendMessage} className="relative mt-auto">
                    <input 
                      type="text" 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Faça uma pergunta sobre o documento..." 
                      className="w-full bg-black/50 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-sm text-white focus:outline-none focus:border-fuchsia-500/50 transition-colors"
                    />
                    <button type="submit" disabled={!chatInput.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-fuchsia-400 hover:bg-fuchsia-500/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      <iconify-icon icon="solar:plain-2-bold" class="text-lg" />
                    </button>
                  </form>
                </div>
              )}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
