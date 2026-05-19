import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  type SmartContractTemplate,
  type SCVariable,
  CATEGORIES,
} from '@/services/smartContractTemplates';
import {
  extractFieldsFromMessage,
  explainContract,
  getWelcomeMessage,
  getCompletionMessage,
  type AIChatMessage,
  type AIExplainResult,
} from '@/services/smartContractAI';
import { useNotificationStore } from '@/stores';
import { api } from '@/services/api';
import { generateContractHash, anchorOnStellar } from '@/services/stellar';
import { useCreateContract, useUpdateContract } from '@/hooks/useContractQueries';
import { resolveHandleSync, lookupHandleByAddress, normalizeHandle } from '@/services/handleResolver';
import HandleInput from '@/components/HandleInput';
import type { ContractType } from '@/types/contract';

type TabKey = 'chat' | 'plain' | 'soroban' | 'states';

interface Props {
  template: SmartContractTemplate;
  onClose: () => void;
  onDeployed: (contractId: string) => void;
}

export default function SmartContractEditor({ template, onClose, onDeployed }: Props) {
  const notify = useNotificationStore(s => s.add);
  const createMutation = useCreateContract();
  const updateMutation = useUpdateContract();

  const [variables, setVariables] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {};
    template.variables.forEach(v => {
      if (v.defaultValue) defaults[v.name] = v.defaultValue;
    });
    return defaults;
  });

  const [messages, setMessages] = useState<AIChatMessage[]>([
    { role: 'assistant', text: getWelcomeMessage(template), timestamp: Date.now() },
  ]);
  const [input, setInput] = useState('');
  const [aiThinking, setAiThinking] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('chat');
  const [explanation, setExplanation] = useState<AIExplainResult | null>(null);
  const [deploying, setDeploying] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Re-explica sempre que as variáveis mudarem
  useEffect(() => {
    let cancel = false;
    explainContract(template, variables).then(r => { if (!cancel) setExplanation(r); });
    return () => { cancel = true; };
  }, [template, variables]);

  // Auto-scroll do chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, aiThinking]);

  // Para gerar código Soroban e ancorar on-chain, sempre resolvemos os @handles
  // para endereços Stellar reais — o blockchain não entende @username
  const resolvedVariables = useMemo(() => resolveAllHandles(template, variables), [template, variables]);
  const sorobanCode = useMemo(() => template.generateSoroban(resolvedVariables), [template, resolvedVariables]);

  const requiredVars = template.variables.filter(v => v.required);
  const filledRequired = requiredVars.filter(v => variables[v.name]?.trim()).length;
  const completionPct = requiredVars.length === 0 ? 100 : Math.round((filledRequired / requiredVars.length) * 100);
  const isComplete = filledRequired === requiredVars.length;

  // ─── Handlers ──────────────────────────────────────────────

  async function handleSend() {
    const text = input.trim();
    if (!text || aiThinking) return;

    const userMsg: AIChatMessage = { role: 'user', text, timestamp: Date.now() };
    setMessages(m => [...m, userMsg]);
    setInput('');
    setAiThinking(true);

    try {
      const result = await extractFieldsFromMessage(template, text, variables);

      // Aplica os campos extraídos
      const newVars = { ...variables, ...result.fields };
      setVariables(newVars);

      // Constrói resposta da IA
      const extractedKeys = Object.keys(result.fields);
      let response = '';

      if (extractedKeys.length === 0 && !result.followUpQuestion) {
        response = `Não consegui identificar nenhuma informação nova nessa mensagem. Pode me dar mais detalhes? Por exemplo, ${template.variables.filter(v => !newVars[v.name]).slice(0, 2).map(v => `o **${v.label.toLowerCase()}**`).join(' ou ')}.`;
      } else {
        if (extractedKeys.length > 0) {
          response = `Captei essas informações:\n\n` + extractedKeys.map(k => {
            const variable = template.variables.find(v => v.name === k);
            return `· **${variable?.label || k}**: ${result.fields[k]}`;
          }).join('\n');
        }

        const stillNeeded = template.variables.filter(v => v.required && !newVars[v.name]);
        if (stillNeeded.length === 0) {
          response += '\n\n' + getCompletionMessage(template);
        } else if (result.followUpQuestion) {
          response += `\n\n${result.followUpQuestion}`;
        }
      }

      setMessages(m => [...m, {
        role: 'assistant',
        text: response,
        timestamp: Date.now(),
        extractedFields: result.fields,
      }]);
    } catch (err) {
      console.error(err);
      setMessages(m => [...m, {
        role: 'assistant',
        text: 'Tive um erro processando sua mensagem. Pode tentar de novo?',
        timestamp: Date.now(),
      }]);
    } finally {
      setAiThinking(false);
    }
  }

  function handleVariableChange(name: string, value: string) {
    setVariables(v => ({ ...v, [name]: value }));
  }

  async function handleDeploy() {
    if (!isComplete || deploying) return;
    setDeploying(true);

    try {
      // 1. Hash do código Soroban + variáveis (com @handles já resolvidos para G...)
      const payload = JSON.stringify({ template: template.id, vars: resolvedVariables, code: sorobanCode });
      const codeHash = await generateContractHash(payload);

      // 2. Submete na Stellar Testnet com hash no memo
      const txResult = await anchorOnStellar(codeHash);
      if (!txResult.success || !txResult.txHash) {
        throw new Error(txResult.error || 'Falha ao ancorar na Stellar');
      }

      // 3. Cria o contrato no Supabase com o smart contract data
      const titleParts = [template.shortName];
      const mainAmount =
        variables.amount ||
        variables.totalAmount ||
        variables.principal ||
        variables.monthlyRent ||
        variables.faceValue ||
        variables.unitPrice ||
        variables.premium;
      if (mainAmount) {
        titleParts.push(`${mainAmount} ${variables.asset || 'USDC'}`);
      }
      const title = titleParts.join(' — ');

      const contract = await createMutation.mutateAsync({
        title,
        description: `Smart Contract (${template.name}) — ${template.plainLanguage.slice(0, 200)}`,
        type: mapTemplateToContractType(template.id),
        parties: extractPartiesFromVariables(template, variables),
        clauses: buildClausesFromTemplate(template, variables, sorobanCode),
        expiresAt: variables.deadline || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        tags: ['smart-contract', 'soroban', template.id, template.category],
      });

      // 4. Atualiza com o hash on-chain (best effort)
      try {
        await updateMutation.mutateAsync({
          id: contract.id,
          data: {
            stellarTxHash: txResult.txHash,
            contractHash: codeHash,
          },
        });
      } catch { /* não bloqueia o fluxo */ }

      notify({
        type: 'success',
        title: 'Smart Contract implantado!',
        message: `Hash ${codeHash.slice(0, 8)}... ancorado na Stellar Testnet`,
      });

      onDeployed(contract.id);
    } catch (err: any) {
      console.error(err);
      notify({
        type: 'error',
        title: 'Falha no deploy',
        message: err?.message || 'Tente novamente em alguns segundos',
      });
    } finally {
      setDeploying(false);
    }
  }

  const categoryMeta = CATEGORIES.find(c => c.id === template.category);

  // ─── Render ─────────────────────────────────────────────

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
        >
          <iconify-icon icon="solar:arrow-left-bold" /> Voltar aos templates
        </button>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <div className="w-32 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-fuchsia-500 to-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${completionPct}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
            <span className="font-mono">{completionPct}%</span>
          </div>

          <button
            onClick={handleDeploy}
            disabled={!isComplete || deploying}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              isComplete && !deploying
                ? 'bg-gradient-to-r from-fuchsia-500 to-emerald-500 text-black hover:scale-105'
                : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
            }`}
          >
            {deploying ? (
              <>
                <iconify-icon icon="solar:refresh-bold" class="animate-spin" />
                Implantando...
              </>
            ) : (
              <>
                <iconify-icon icon="solar:rocket-bold" />
                Implantar na Testnet
              </>
            )}
          </button>
        </div>
      </div>

      {/* Template title bar */}
      <div className="bg-neutral-900 border border-white/10 rounded-2xl p-4 mb-4 flex items-center gap-4">
        <div className="text-3xl">{template.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-bold text-white truncate">{template.name}</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-400 flex items-center gap-1">
              <span>{categoryMeta?.icon}</span>{categoryMeta?.label}
            </span>
          </div>
          <p className="text-xs text-neutral-400 truncate">{template.description}</p>
        </div>
      </div>

      {/* Main 2-column layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4 min-h-0">
        {/* LEFT: AI Chat + Variable form */}
        <div className="flex flex-col gap-4 min-h-0">
          <ChatPanel
            messages={messages}
            input={input}
            setInput={setInput}
            onSend={handleSend}
            aiThinking={aiThinking}
            chatEndRef={chatEndRef}
          />

          <VariableFormPanel
            template={template}
            variables={variables}
            onChange={handleVariableChange}
          />
        </div>

        {/* RIGHT: Tabbed preview */}
        <div className="flex flex-col bg-neutral-900 border border-white/10 rounded-2xl overflow-hidden min-h-0">
          <div className="flex items-center border-b border-white/5">
            <TabButton active={activeTab === 'plain'} onClick={() => setActiveTab('plain')}
              icon="solar:chat-square-2-bold" label="Linguagem Simples" />
            <TabButton active={activeTab === 'soroban'} onClick={() => setActiveTab('soroban')}
              icon="solar:code-bold" label="Código Soroban" />
            <TabButton active={activeTab === 'states'} onClick={() => setActiveTab('states')}
              icon="solar:diagram-up-bold" label="Estados & Ações" />
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <AnimatePresence mode="wait">
              {activeTab === 'plain' && (
                <motion.div key="plain" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <PlainLanguageView explanation={explanation} template={template} />
                </motion.div>
              )}
              {activeTab === 'soroban' && (
                <motion.div key="soroban" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <SorobanCodeView code={sorobanCode} />
                </motion.div>
              )}
              {activeTab === 'states' && (
                <motion.div key="states" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <StatesView template={template} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES
// ═════════════════════════════════════════════════════════════════════

function TabButton({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: string; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 ${
        active
          ? 'text-fuchsia-400 border-fuchsia-500 bg-fuchsia-500/5'
          : 'text-neutral-500 border-transparent hover:text-white hover:bg-white/5'
      }`}
    >
      <iconify-icon icon={icon} />
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

// ─── Chat ─────────────────────────────────────────────────────────

function ChatPanel({ messages, input, setInput, onSend, aiThinking, chatEndRef }: {
  messages: AIChatMessage[];
  input: string;
  setInput: (s: string) => void;
  onSend: () => void;
  aiThinking: boolean;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="flex-1 flex flex-col bg-neutral-900 border border-white/10 rounded-2xl overflow-hidden min-h-[260px]">
      <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-fuchsia-500 to-fuchsia-700 flex items-center justify-center">
          <iconify-icon icon="solar:magic-stick-3-bold" class="text-white text-sm" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-white">Assistente IA</h4>
          <p className="text-[10px] text-neutral-500">Descreva o contrato em linguagem natural</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-emerald-400">
          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          Online
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.map((m, i) => (
          <ChatBubble key={i} message={m} />
        ))}
        {aiThinking && (
          <div className="flex items-center gap-2 text-neutral-500 text-sm">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 bg-fuchsia-400 rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 bg-fuchsia-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
              <div className="w-1.5 h-1.5 bg-fuchsia-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
            </div>
            <span className="text-xs">IA pensando...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); onSend(); }}
        className="p-3 border-t border-white/5 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ex: O comprador é G... e vai pagar 5000 USDC..."
          disabled={aiThinking}
          className="flex-1 bg-neutral-950 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-fuchsia-500/50 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || aiThinking}
          className="px-4 py-2 rounded-xl bg-fuchsia-500 text-white font-bold text-sm disabled:bg-neutral-800 disabled:text-neutral-500 hover:bg-fuchsia-400 transition-colors"
        >
          <iconify-icon icon="solar:plain-bold" />
        </button>
      </form>
    </div>
  );
}

function ChatBubble({ message }: { message: AIChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${
          isUser
            ? 'bg-fuchsia-500/20 text-white border border-fuchsia-500/30'
            : 'bg-neutral-800 text-neutral-200 border border-white/5'
        }`}
      >
        <div className="whitespace-pre-wrap leading-relaxed" dangerouslySetInnerHTML={{
          __html: message.text
            .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-bold">$1</strong>')
            .replace(/\n/g, '<br>')
        }} />
        {message.extractedFields && Object.keys(message.extractedFields).length > 0 && (
          <div className="mt-2 pt-2 border-t border-white/5 flex flex-wrap gap-1">
            {Object.keys(message.extractedFields).map(k => (
              <span key={k} className="text-[10px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded-md">
                ✓ {k}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Variable form ─────────────────────────────────────────────

function VariableFormPanel({ template, variables, onChange }: {
  template: SmartContractTemplate;
  variables: Record<string, string>;
  onChange: (name: string, value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-neutral-900 border border-white/10 rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <iconify-icon icon="solar:settings-bold" class="text-neutral-400" />
          <span className="text-sm font-bold text-white">Editar campos manualmente</span>
          <span className="text-[10px] text-neutral-500">({Object.keys(variables).filter(k => variables[k]).length}/{template.variables.length} preenchidos)</span>
        </div>
        <iconify-icon icon={expanded ? "solar:alt-arrow-up-bold" : "solar:alt-arrow-down-bold"} class="text-neutral-500" />
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {template.variables.map(v => (
                <VariableInput key={v.name} variable={v} value={variables[v.name] || ''}
                  onChange={(val) => onChange(v.name, val)} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function VariableInput({ variable, value, onChange }: {
  variable: SCVariable;
  value: string;
  onChange: (value: string) => void;
}) {
  const inputClass = "w-full bg-neutral-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-fuchsia-500/50";

  const isWideField = variable.type === 'text' &&
    ['propertyAddress', 'productName', 'projectScope', 'product', 'role', 'invoiceNumber', 'trackingCode', 'triggerEvent', 'employees', 'beneficiaries'].includes(variable.name);

  return (
    <div className={isWideField ? 'sm:col-span-2' : ''}>
      <label className="block text-xs font-medium text-neutral-400 mb-1">
        {variable.label} {variable.required && <span className="text-fuchsia-400">*</span>}
      </label>
      {variable.type === 'address' ? (
        <HandleInput
          value={value}
          onChange={onChange}
          placeholder={variable.placeholder || '@usuario ou G...'}
          required={variable.required}
        />
      ) : variable.type === 'select' ? (
        <select value={value} onChange={e => onChange(e.target.value)} className={inputClass}>
          <option value="">Selecione...</option>
          {variable.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      ) : variable.type === 'date' ? (
        <input type="date" value={value} onChange={e => onChange(e.target.value)} className={inputClass} />
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={variable.placeholder || ''}
          className={inputClass}
        />
      )}
      {variable.helper && <p className="text-[10px] text-neutral-600 mt-1">{variable.helper}</p>}
    </div>
  );
}

// ─── Plain language view ─────────────────────────────────────

function PlainLanguageView({ explanation, template }: { explanation: AIExplainResult | null; template: SmartContractTemplate }) {
  if (!explanation) {
    return <div className="text-neutral-500 text-sm">Gerando explicação...</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-xs font-bold text-fuchsia-400 uppercase tracking-wider mb-2 flex items-center gap-2">
          <iconify-icon icon="solar:book-bookmark-bold" />
          O que este contrato faz
        </h4>
        <p className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{
          __html: explanation.summary.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
        }} />
      </div>

      {explanation.bulletPoints.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <iconify-icon icon="solar:list-check-bold" />
            Como funciona na prática
          </h4>
          <ul className="space-y-2">
            {explanation.bulletPoints.map((b, i) => (
              <li key={i} className="text-sm text-neutral-300 flex gap-2 leading-relaxed">
                <span className="text-emerald-400 mt-1">•</span>
                <span dangerouslySetInnerHTML={{
                  __html: b.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
                }} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {explanation.whatHappensIf.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <iconify-icon icon="solar:question-square-bold" />
            E se...?
          </h4>
          <div className="space-y-2">
            {explanation.whatHappensIf.map((s, i) => (
              <div key={i} className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-3">
                <div className="text-xs text-blue-300 font-medium mb-1">📌 {s.scenario}</div>
                <div className="text-sm text-neutral-300">→ {s.outcome}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {explanation.risks.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <iconify-icon icon="solar:shield-warning-bold" />
            Atenção
          </h4>
          <ul className="space-y-2">
            {explanation.risks.map((r, i) => {
              const colors = {
                low:    'bg-emerald-500/5 border-emerald-500/15 text-emerald-300',
                medium: 'bg-amber-500/5 border-amber-500/15 text-amber-300',
                high:   'bg-red-500/5 border-red-500/15 text-red-300',
              };
              return (
                <li key={i} className={`text-sm border rounded-xl p-3 ${colors[r.level]}`}>
                  <span className="font-bold uppercase text-[10px] mr-2">{r.level === 'low' ? 'baixo' : r.level === 'medium' ? 'médio' : 'alto'}</span>
                  {r.text}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!template.isFullyImplemented && (
        <div className="bg-fuchsia-500/5 border border-fuchsia-500/15 rounded-xl p-3 text-xs text-fuchsia-300">
          ℹ️ Este template está em <strong>versão beta</strong> — a lógica completa do Soroban será expandida em breve. O hash do contrato ainda é ancorado on-chain normalmente.
        </div>
      )}
    </div>
  );
}

// ─── Soroban code view ───────────────────────────────────────

function SorobanCodeView({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <iconify-icon icon="solar:file-text-bold" />
          <span>contract.rs</span>
          <span className="text-neutral-700">·</span>
          <span className="text-emerald-400 font-mono">Soroban (Rust)</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
        >
          <iconify-icon icon={copied ? "solar:check-circle-bold" : "solar:copy-bold"} />
          {copied ? 'Copiado!' : 'Copiar código'}
        </button>
      </div>

      <pre className="bg-black/40 border border-white/5 rounded-xl p-4 text-xs font-mono text-neutral-300 overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>

      <div className="text-[10px] text-neutral-600 flex items-start gap-2">
        <iconify-icon icon="solar:info-circle-bold" class="mt-0.5" />
        <span>
          Código gerado a partir das suas escolhas. No deploy, ele é compilado para WASM e enviado para a Stellar.
          Para o demo do hackathon, ancoramos o <code className="text-fuchsia-400">SHA-256</code> do código + variáveis na testnet.
        </span>
      </div>
    </div>
  );
}

// ─── States view ─────────────────────────────────────────────

function StatesView({ template }: { template: SmartContractTemplate }) {
  const stateColors: Record<string, string> = {
    gray:   'bg-neutral-500/10 border-neutral-500/30 text-neutral-300',
    blue:   'bg-blue-500/10 border-blue-500/30 text-blue-300',
    amber:  'bg-amber-500/10 border-amber-500/30 text-amber-300',
    green:  'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    red:    'bg-red-500/10 border-red-500/30 text-red-300',
    purple: 'bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-300',
  };

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-xs font-bold text-fuchsia-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <iconify-icon icon="solar:layers-bold" />
          Estados do contrato
        </h4>
        <div className="space-y-2">
          {template.states.map((s, i) => (
            <div key={s.id} className={`flex items-center gap-3 border rounded-xl p-3 ${stateColors[s.color]}`}>
              <div className="text-xs font-mono opacity-50">{String(i + 1).padStart(2, '0')}</div>
              <div className="flex-1">
                <div className="font-bold text-sm">{s.label}</div>
                <div className="text-xs opacity-75 mt-0.5">{s.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <iconify-icon icon="solar:double-alt-arrow-right-bold" />
          Ações disponíveis
        </h4>
        <div className="space-y-2">
          {template.actions.map((a) => (
            <div key={a.name} className="bg-neutral-950 border border-white/5 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <code className="text-sm text-emerald-400 font-mono">{a.name}()</code>
                <span className="text-[10px] text-neutral-500">por:</span>
                <span className="text-[10px] bg-neutral-800 text-neutral-300 px-1.5 py-0.5 rounded-md font-mono">{a.callableBy}</span>
              </div>
              <p className="text-xs text-neutral-400 mb-1">{a.description}</p>
              <div className="flex items-center gap-1 text-[10px] text-neutral-500 font-mono">
                {a.preState} <iconify-icon icon="solar:arrow-right-bold" class="text-fuchsia-400" /> {a.postState}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// HELPERS DE PERSISTÊNCIA
// ═════════════════════════════════════════════════════════════════════

function mapTemplateToContractType(templateId: string): ContractType {
  const map: Record<string, ContractType> = {
    rent: 'rental',
    ecommerce: 'sale',
    freelancer: 'service',
    payroll: 'service',
    royalties: 'partnership',
    factoring: 'loan',
    founder_vesting: 'partnership',
    fixed_yield: 'loan',
    group_buy: 'sale',
    parametric_insurance: 'service',
  };
  return map[templateId] || 'service';
}

function extractPartiesFromVariables(template: SmartContractTemplate, vars: Record<string, string>) {
  const parties: { name: string; email: string; role: 'creator' | 'counterparty' | 'witness' }[] = [];
  const addressFields = template.variables.filter(v => v.type === 'address');

  addressFields.forEach((field, idx) => {
    const raw = vars[field.name];
    if (!raw) return;

    let displayName: string;
    if (raw.startsWith('@')) {
      const resolved = resolveHandleSync(raw);
      if (resolved) {
        displayName = `${field.label}: ${resolved.displayName} (@${resolved.handle})`;
      } else {
        displayName = `${field.label}: @${normalizeHandle(raw)}`;
      }
    } else {
      // Endereço bruto — vê se conhecemos o user
      const known = lookupHandleByAddress(raw);
      displayName = known
        ? `${field.label}: ${known.displayName} (@${known.handle})`
        : `${field.label} (${raw.slice(0, 6)}...${raw.slice(-4)})`;
    }

    parties.push({
      name: displayName,
      email: '',
      role: idx === 0 ? 'creator' : 'counterparty',
    });
  });

  return parties;
}

/**
 * Converte qualquer @handle nos valores das variáveis para endereço Stellar real.
 * Usado antes de gerar o payload final do contrato.
 */
function resolveAllHandles(template: SmartContractTemplate, vars: Record<string, string>): Record<string, string> {
  const resolved: Record<string, string> = { ...vars };
  for (const variable of template.variables) {
    if (variable.type !== 'address') continue;
    const raw = vars[variable.name];
    if (raw && raw.startsWith('@')) {
      const r = resolveHandleSync(raw);
      if (r) resolved[variable.name] = r.address;
    }
  }
  return resolved;
}

function buildClausesFromTemplate(
  template: SmartContractTemplate,
  vars: Record<string, string>,
  sorobanCode: string
) {
  const clauses: { order: number; title: string; content: string }[] = [];

  clauses.push({
    order: 1,
    title: 'Tipo de Smart Contract',
    content: `Este é um contrato inteligente do tipo "${template.name}" implantado na blockchain Stellar via Soroban.\n\n${template.plainLanguage}`,
  });

  clauses.push({
    order: 2,
    title: 'Parâmetros do contrato',
    content: template.variables.map(v => `${v.label}: ${vars[v.name] || '(não definido)'}`).join('\n'),
  });

  clauses.push({
    order: 3,
    title: 'Máquina de estados',
    content: template.states.map(s => `${s.label}: ${s.description}`).join('\n'),
  });

  clauses.push({
    order: 4,
    title: 'Código Soroban (auditoria)',
    content: sorobanCode,
  });

  return clauses;
}
