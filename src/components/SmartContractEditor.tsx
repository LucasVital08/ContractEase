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
import { useNotificationStore, useWalletStore } from '@/stores';
import { generateContractHash, anchorOnStellar } from '@/services/stellar';
import { anchorContractHashWithWallet, shortenAddress } from '@/services/stellarWallet';
import { deployContract as deploySorobanContract, explorerContractUrl } from '@/services/sorobanDeploy';
import { buildInitArgs, isSorobanSupported } from '@/services/sorobanInitArgs';
import { useCreateContract, useUpdateContract } from '@/hooks/useContractQueries';
import { signingService } from '@/services/supabaseService';
import { resolveHandle, resolveHandleSync, lookupHandleByAddress, lookupProfileByAddress, normalizeHandle, type ResolvedHandle } from '@/services/handleResolver';
import HandleInput from '@/components/HandleInput';
import QuestionnaireFlow from '@/components/QuestionnaireFlow';
import { getQuestionsForTemplate } from '@/services/templateQuestions';
import type { ContractType } from '@/types/contract';
import { SmartContractGlyph, getSmartContractVisual } from '@/components/SmartContractVisual';

type TabKey = 'document' | 'plain' | 'soroban' | 'states';
export type EditorMode = 'chat' | 'questions';

interface Props {
  template: SmartContractTemplate;
  onClose: () => void;
  onDeployed: (contractId: string) => void;
  /** Modo inicial de criação. Default: 'chat'. */
  initialMode?: EditorMode;
  /** Contexto opcional vindo do feed/marketplace para pré-preencher o contrato. */
  initialBrief?: string;
  /** Valores iniciais opcionais para preencher variáveis do template. */
  initialVariables?: Record<string, string>;
}

export default function SmartContractEditor({ template, onClose, onDeployed, initialMode = 'chat', initialBrief, initialVariables }: Props) {
  const notify = useNotificationStore(s => s.add);
  const createMutation = useCreateContract();
  const updateMutation = useUpdateContract();

  const templateQuestions = useMemo(() => getQuestionsForTemplate(template.id), [template.id]);
  const hasQuestions = templateQuestions.length > 0;
  const [editorMode, setEditorMode] = useState<EditorMode>(
    initialMode === 'questions' && hasQuestions ? 'questions' : 'chat'
  );

  const [variables, setVariables] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {};
    template.variables.forEach(v => {
      if (v.defaultValue) defaults[v.name] = v.defaultValue;
    });
    return { ...defaults, ...(initialVariables || {}) };
  });

  const [messages, setMessages] = useState<AIChatMessage[]>([
    { role: 'assistant', text: getWelcomeMessage(template), timestamp: Date.now() },
  ]);
  const [input, setInput] = useState('');
  const [aiThinking, setAiThinking] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('document');
  const [explanation, setExplanation] = useState<AIExplainResult | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployReviewMode, setDeployReviewMode] = useState<{ useUserWallet: boolean } | null>(null);
  const [deployReviewParties, setDeployReviewParties] = useState<SigningReviewParty[]>([]);
  const [deployReviewLoading, setDeployReviewLoading] = useState(false);
  const [briefImported, setBriefImported] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!initialBrief || briefImported) return;

    let cancelled = false;
    const importedPrompt: AIChatMessage = { role: 'user', text: initialBrief, timestamp: Date.now() };

    setMessages((current) => [...current, importedPrompt]);
    setAiThinking(true);

    extractFieldsFromMessage(template, initialBrief, variables)
      .then((result) => {
        if (cancelled) return;

        const merged = { ...variables, ...result.fields };
        setVariables(merged);

        const extractedKeys = Object.keys(result.fields);
        const pendingRequired = template.variables.filter((variable) => variable.required && !merged[variable.name]);

        const response = extractedKeys.length > 0
          ? `Importei o contexto da oportunidade do feed e já preenchi:

${extractedKeys.map((key) => {
            const variable = template.variables.find((candidate) => candidate.name === key);
            return `· **${variable?.label || key}**: ${result.fields[key]}`;
          }).join('\n')}${pendingRequired.length > 0 ? `\n\nAgora revise o restante para concluir: ${pendingRequired.slice(0, 3).map((variable) => `**${variable.label.toLowerCase()}**`).join(', ')}.` : `\n\n${getCompletionMessage(template)}`}`
          : 'Importei a oportunidade do feed. Revise os campos abaixo e complemente o que faltar antes de publicar o smart contract.';

        setMessages((current) => [...current, {
          role: 'assistant',
          text: response,
          timestamp: Date.now(),
          extractedFields: result.fields,
        }]);
      })
      .catch(() => {
        if (cancelled) return;
        setMessages((current) => [...current, {
          role: 'assistant',
          text: 'Recebi o contexto da oportunidade do feed, mas não consegui extrair todos os campos automaticamente. Revise o formulário abaixo e ajuste o contrato antes de publicar.',
          timestamp: Date.now(),
        }]);
      })
      .finally(() => {
        if (cancelled) return;
        setAiThinking(false);
        setBriefImported(true);
      });

    return () => { cancelled = true; };
  }, [briefImported, initialBrief, template]);

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

  useEffect(() => {
    if (!deployReviewMode) return;

    let cancelled = false;
    setDeployReviewLoading(true);

    buildSigningReviewParties(template, variables)
      .then((parties) => {
        if (!cancelled) setDeployReviewParties(parties);
      })
      .finally(() => {
        if (!cancelled) setDeployReviewLoading(false);
      });

    return () => { cancelled = true; };
  }, [deployReviewMode, template, variables]);

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

  function requestDeployConfirmation(opts: { useUserWallet?: boolean } = {}) {
    if (!isComplete || deploying) return;
    setDeployReviewMode({ useUserWallet: Boolean(opts.useUserWallet) });
  }

  async function handleDeploy(opts: { useUserWallet?: boolean } = {}) {
    if (!isComplete || deploying) return;
    setDeploying(true);

    try {
      const deployVariables = await resolveAllHandlesAsync(template, variables);
      const sorobanCodeToDeploy = template.generateSoroban(deployVariables);

      // 1. Hash do código Soroban + variáveis (com @handles já resolvidos para G...)
      const payload = JSON.stringify({ template: template.id, vars: deployVariables, code: sorobanCodeToDeploy });
      const codeHash = await generateContractHash(payload);

      // 2. Submete na Stellar Testnet com hash no memo.
      //    - Modo padrão (custodial): edge function anchor-on-stellar
      //    - Modo "Implantar com minha carteira": assina via Freighter
      const txResult = opts.useUserWallet
        ? await anchorContractHashWithWallet(codeHash)
        : await anchorOnStellar(codeHash);

      if (!txResult.success || !txResult.txHash) {
        const parts = [txResult.error || 'Falha ao ancorar na Stellar'];
        if ('stage' in txResult && txResult.stage) parts.push(`(etapa: ${txResult.stage})`);
        if ('hint' in txResult && txResult.hint) parts.push(`Dica: ${txResult.hint}`);
        throw new Error(parts.join(' · '));
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

      const parties = await extractPartiesFromVariables(template, variables);

      const contract = await createMutation.mutateAsync({
        title,
        description: `Smart Contract (${template.name}) — ${template.plainLanguage.slice(0, 200)}`,
        type: mapTemplateToContractType(template.id),
        parties,
        clauses: buildClausesFromTemplate(template, variables, sorobanCodeToDeploy),
        expiresAt: variables.deadline || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        tags: ['smart-contract', 'soroban', template.id, template.category],
      });

      try {
        await signingService.notifyContractParties(contract.id, contract.title, contract.parties);
      } catch (notifyError) {
        console.warn('[SmartContractEditor] failed to notify contract parties', notifyError);
      }

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

      // 5. Deploy Soroban real (não-bloqueante — se a infra estiver configurada,
      //    o contrato vira instância executável; caso contrário só fica a ancoragem).
      if (isSorobanSupported(template.id)) {
        try {
          const initArgs = buildInitArgs(template.id, deployVariables, 'testnet');
          const result = await deploySorobanContract({
            contractId: contract.id,
            templateId: template.id,
            initArgs,
            network: 'testnet',
          });
          notify({
            type: 'success',
            title: 'Contrato Soroban no ar!',
            message: `Endereço: ${shortenAddress(result.contractAddress)} · ver no Stellar Expert`,
          });
          console.info('[soroban-deploy]', explorerContractUrl(result.contractAddress, 'testnet'));
        } catch (sorobanErr) {
          // Não bloqueia: o usuário ainda tem o contrato salvo + ancoragem por hash.
          console.warn('[SmartContractEditor] deploy Soroban falhou (não-bloqueante):', sorobanErr);
          notify({
            type: 'warning',
            title: 'Deploy Soroban indisponível',
            message: 'O contrato foi salvo e ancorado, mas a instância on-chain ainda não está pronta. Tente novamente em instantes.',
          });
        }
      }

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
  const visual = getSmartContractVisual(template);

  // ─── Render ─────────────────────────────────────────────

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto flex min-h-[calc(100vh-120px)] w-full max-w-[1680px] flex-col">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
        >
          <iconify-icon icon="solar:arrow-left-bold" /> Voltar aos templates
        </button>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center xl:justify-end">
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <div className="h-1 w-24 overflow-hidden rounded-full bg-neutral-800 sm:w-32">
              <motion.div
                className="h-full bg-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${completionPct}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
            <span className="font-mono tabular-nums w-9 text-right">{completionPct}%</span>
          </div>

          <DeployButton
            disabled={!isComplete}
            deploying={deploying}
            onDeploy={(useUserWallet) => requestDeployConfirmation({ useUserWallet })}
          />
        </div>
      </div>

      {/* Template title bar */}
      <div className="relative mb-4 overflow-hidden rounded-[28px] border border-white/8 bg-neutral-900/70 p-5 sm:p-6">
        <div className={`absolute inset-0 bg-gradient-to-r ${visual.accentGradient}`} />
        <div className="absolute inset-0 bg-[linear-gradient(140deg,rgba(255,255,255,0.08),transparent_38%)] opacity-70" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <SmartContractGlyph template={template} size="md" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h2 className="text-lg font-bold text-white truncate font-bricolage">{template.name}</h2>
              <span className={`text-[11px] font-semibold px-3 py-1 rounded-full border ${visual.accentChip}`}>
                {categoryMeta?.label}
              </span>
              <span className="text-[11px] font-medium px-3 py-1 rounded-full bg-black/25 text-neutral-300 border border-white/8">
                {template.difficulty}
              </span>
            </div>
            <p className="text-sm text-neutral-300 leading-6">{template.description}</p>
            <div className="mt-3 flex items-center gap-2 flex-wrap text-[11px] text-neutral-400">
              <span className={`rounded-full border px-3 py-1 font-semibold ${template.isFullyImplemented ? visual.accentChip : 'border-white/10 bg-black/20 text-neutral-400'}`}>
                {template.isFullyImplemented ? 'Operacional' : 'Beta'}
              </span>
              <span className="rounded-full border border-white/8 bg-black/20 px-3 py-1">{template.variables.length} campos</span>
              <span className="rounded-full border border-white/8 bg-black/20 px-3 py-1">Soroban-ready</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-column layout */}
      <div className="flex-1 grid min-h-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.95fr)]">
        {/* LEFT: AI Chat OU Questionário guiado + Variable form */}
        <div className="flex flex-col gap-4 min-h-0">
          {editorMode === 'questions' && hasQuestions ? (
            <div className="flex-1 min-h-[360px]">
              <QuestionnaireFlow
                questions={templateQuestions}
                values={variables}
                onChange={handleVariableChange}
                onComplete={() => {
                  notify({
                    type: 'success',
                    title: 'Perguntas respondidas',
                    message: 'Confira o documento e implante quando estiver pronto.',
                  });
                }}
                onSwitchToChat={() => setEditorMode('chat')}
              />
            </div>
          ) : (
            <ChatPanel
              messages={messages}
              input={input}
              setInput={setInput}
              onSend={handleSend}
              aiThinking={aiThinking}
              chatEndRef={chatEndRef}
              canSwitch={hasQuestions}
              onSwitchToQuestions={() => setEditorMode('questions')}
            />
          )}

          <VariableFormPanel
            template={template}
            variables={variables}
            onChange={handleVariableChange}
          />
        </div>

        {/* RIGHT: Tabbed preview */}
        <div className="flex flex-col overflow-hidden rounded-[28px] border border-white/8 bg-neutral-900/70 min-h-[420px] xl:sticky xl:top-20 xl:max-h-[calc(100vh-100px)]">
          <div className="flex items-center border-b border-white/5">
            <TabButton active={activeTab === 'document'} onClick={() => setActiveTab('document')}
              icon="solar:document-text-bold-duotone" label="Documento" />
            <TabButton active={activeTab === 'plain'} onClick={() => setActiveTab('plain')}
              icon="solar:chat-square-2-bold" label="Resumo" />
            <TabButton active={activeTab === 'soroban'} onClick={() => setActiveTab('soroban')}
              icon="solar:code-bold" label="Código" />
            <TabButton active={activeTab === 'states'} onClick={() => setActiveTab('states')}
              icon="solar:diagram-up-bold" label="Estados" />
          </div>

          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              {activeTab === 'document' && (
                <motion.div key="document" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <DocumentPreview template={template} variables={variables} />
                </motion.div>
              )}
              {activeTab === 'plain' && (
                <motion.div key="plain" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-5">
                  <PlainLanguageView explanation={explanation} template={template} />
                </motion.div>
              )}
              {activeTab === 'soroban' && (
                <motion.div key="soroban" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-5">
                  <SorobanCodeView code={sorobanCode} />
                </motion.div>
              )}
              {activeTab === 'states' && (
                <motion.div key="states" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-5">
                  <StatesView template={template} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <SignerConfirmationModal
        isOpen={Boolean(deployReviewMode)}
        useUserWallet={Boolean(deployReviewMode?.useUserWallet)}
        loading={deployReviewLoading}
        parties={deployReviewParties}
        confirming={deploying}
        onClose={() => setDeployReviewMode(null)}
        onConfirm={async () => {
          if (!deployReviewMode) return;
          const reviewMode = deployReviewMode;
          setDeployReviewMode(null);
          await handleDeploy(reviewMode);
        }}
      />
    </motion.div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES
// ═════════════════════════════════════════════════════════════════════

// ─── Deploy button com dropdown ────────────────────────────────────

function DeployButton({ disabled, deploying, onDeploy }: {
  disabled: boolean;
  deploying: boolean;
  onDeploy: (useUserWallet: boolean) => void;
}) {
  const { isConnected, address } = useWalletStore();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleCustodial() {
    setMenuOpen(false);
    onDeploy(false);
  }
  function handleWallet() {
    setMenuOpen(false);
    onDeploy(true);
  }

  return (
    <div className="relative">
      <div className={`flex items-stretch rounded-xl overflow-hidden border ${
        disabled || deploying ? 'border-neutral-800' : 'border-emerald-500/40'
      }`}>
        <button
          onClick={isConnected ? handleWallet : handleCustodial}
          disabled={disabled || deploying}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors ${
            disabled || deploying
              ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
              : 'bg-emerald-500 text-neutral-950 hover:bg-emerald-400'
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
              {isConnected ? 'Implantar com minha carteira' : 'Implantar na Testnet'}
            </>
          )}
        </button>

        {!deploying && !disabled && (
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="px-2 bg-emerald-500 text-neutral-950 hover:bg-emerald-400 border-l border-neutral-950/20"
            aria-label="Mais opções"
          >
            <iconify-icon icon="solar:alt-arrow-down-linear" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 z-50 w-80 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="px-4 pt-3 pb-2 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">
                Como ancorar este contrato
              </div>

              <button
                onClick={handleWallet}
                disabled={!isConnected}
                className="w-full text-left p-4 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed flex items-start gap-3 border-b border-white/5"
              >
                <iconify-icon icon="solar:wallet-2-bold-duotone" class="text-emerald-400 text-xl mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white flex items-center gap-2">
                    Com minha carteira (Freighter)
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      RECOMENDADO
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                    {isConnected
                      ? `Você assina como ${shortenAddress(address ?? '')} — comprovação on-chain real.`
                      : 'Conecte sua Freighter primeiro (botão no topo).'}
                  </p>
                </div>
              </button>

              <button
                onClick={handleCustodial}
                className="w-full text-left p-4 hover:bg-white/5 flex items-start gap-3"
              >
                <iconify-icon icon="solar:shield-bold-duotone" class="text-neutral-400 text-xl mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white">Via ContractEase (custodial)</div>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                    Usamos uma carteira da plataforma para registrar a prova. Não exige Freighter.
                  </p>
                </div>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

interface SigningReviewParty {
  fieldLabel: string;
  inputValue: string;
  displayName: string;
  handle?: string;
  email?: string;
  address?: string;
  avatar?: string;
  verification: 'profile' | 'wallet' | 'manual';
  hasWallet: boolean;
}

function SignerConfirmationModal({
  isOpen,
  useUserWallet,
  loading,
  parties,
  confirming,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  useUserWallet: boolean;
  loading: boolean;
  parties: SigningReviewParty[];
  confirming: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}) {
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (isOpen) setConfirmed(false);
  }, [isOpen]);

  const unresolvedCount = parties.filter((party) => party.verification === 'manual').length;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            className="fixed inset-x-4 top-1/2 z-[60] mx-auto w-full max-w-3xl -translate-y-1/2 overflow-hidden rounded-[32px] border border-white/10 bg-neutral-950 shadow-[0_32px_120px_rgba(0,0,0,0.45)]"
          >
            <div className="relative border-b border-white/6 px-5 py-5 sm:px-6">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_36%)]" />
              <div className="relative flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[20px] border border-emerald-400/18 bg-emerald-500/10 text-emerald-300">
                    <iconify-icon icon="solar:user-check-bold-duotone" class="text-xl" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Confirmação de identidades</p>
                    <h3 className="mt-1 text-xl font-bold text-white font-bricolage">Verifique quem vai assinar</h3>
                    <p className="mt-2 text-sm leading-6 text-neutral-400">
                      Antes de finalizar, confira se o `@user`, e-mail ou carteira de cada parte corresponde exatamente ao signatário esperado.
                    </p>
                  </div>
                </div>
                <button onClick={onClose} className="rounded-2xl border border-white/8 bg-white/[0.03] p-2 text-neutral-400 transition-colors hover:text-white">
                  <iconify-icon icon="solar:close-circle-bold" class="text-xl" />
                </button>
              </div>
            </div>

            <div className="max-h-[65vh] overflow-y-auto px-5 py-5 sm:px-6">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-[11px] font-semibold text-neutral-300">
                  {useUserWallet ? 'Implantação com sua carteira' : 'Implantação custodial'}
                </span>
                {unresolvedCount > 0 ? (
                  <span className="rounded-full border border-amber-400/18 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-200">
                    {unresolvedCount} identidade(s) sem confirmação completa
                  </span>
                ) : (
                  <span className="rounded-full border border-emerald-400/18 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-300">
                    Todas as identidades reconhecidas
                  </span>
                )}
              </div>

              {loading ? (
                <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-5 text-sm text-neutral-400">
                  <iconify-icon icon="solar:refresh-bold" class="animate-spin text-lg text-emerald-300" />
                  Conferindo os signatários selecionados...
                </div>
              ) : (
                <div className="space-y-3">
                  {parties.map((party) => (
                    <div key={`${party.fieldLabel}-${party.inputValue}`} className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                      <div className="flex gap-3">
                        <IdentityAvatar displayName={party.displayName} avatar={party.avatar} handle={party.handle || party.inputValue} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-white">{party.displayName}</p>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                              party.verification === 'profile'
                                ? 'border-emerald-400/16 bg-emerald-500/10 text-emerald-300'
                                : party.verification === 'wallet'
                                  ? 'border-cyan-400/16 bg-cyan-500/10 text-cyan-300'
                                  : 'border-amber-400/16 bg-amber-500/10 text-amber-200'
                            }`}>
                              {party.verification === 'profile' ? 'Perfil confirmado' : party.verification === 'wallet' ? 'Carteira reconhecida' : 'Verifique manualmente'}
                            </span>
                            {!party.hasWallet && (
                              <span className="rounded-full border border-amber-400/16 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">Sem carteira cadastrada</span>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">{party.fieldLabel}</p>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-400">
                            <span className="rounded-full border border-white/8 bg-black/20 px-2.5 py-1">Entrada: {party.inputValue}</span>
                            {party.handle && <span className="rounded-full border border-cyan-500/16 bg-cyan-500/10 px-2.5 py-1 text-cyan-300">@{party.handle}</span>}
                            {party.email && <span className="rounded-full border border-white/8 bg-black/20 px-2.5 py-1">{party.email}</span>}
                            {party.address && <span className="rounded-full border border-white/8 bg-black/20 px-2.5 py-1 font-mono">{shortenAddress(party.address)}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {parties.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-neutral-400">
                      Nenhuma parte com endereço foi detectada para revisão. Verifique os campos antes de implantar.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-white/6 bg-black/20 px-5 py-4 sm:px-6">
              <label className="mb-4 flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-neutral-300">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-emerald-500"
                />
                <span>Confirmo que revisei os usuários acima e que estes são os destinatários corretos para assinatura e liquidação do contrato.</span>
              </label>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  onClick={onClose}
                  className="inline-flex items-center justify-center rounded-full border border-white/8 bg-white/[0.03] px-4 py-2 text-sm font-medium text-neutral-300 transition-colors hover:border-white/14 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => void onConfirm()}
                  disabled={!confirmed || loading || confirming}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-400/18 bg-emerald-500 px-5 py-2 text-sm font-semibold text-neutral-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-white/[0.03] disabled:text-neutral-500"
                >
                  {confirming ? <iconify-icon icon="solar:refresh-bold" class="animate-spin text-base" /> : <iconify-icon icon="solar:rocket-bold" class="text-base" />}
                  Confirmar e implantar
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function IdentityAvatar({ handle, displayName, avatar }: { handle: string; displayName: string; avatar?: string }) {
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || handle.slice(0, 2).toUpperCase();

  return (
    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[18px] border border-white/8 bg-white/[0.04] text-sm font-semibold text-white flex-shrink-0">
      {avatar && /^https?:\/\//i.test(avatar)
        ? <img src={avatar} alt={displayName} className="h-full w-full object-cover" />
        : initials}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: string; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 text-xs font-medium transition-all border-b-2 ${
        active
          ? 'text-emerald-400 border-emerald-500 bg-emerald-500/[0.04]'
          : 'text-neutral-500 border-transparent hover:text-neutral-200 hover:bg-white/5'
      }`}
    >
      <iconify-icon icon={icon} class="text-base" />
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

// ─── Chat ─────────────────────────────────────────────────────────

function ChatPanel({ messages, input, setInput, onSend, aiThinking, chatEndRef, canSwitch, onSwitchToQuestions }: {
  messages: AIChatMessage[];
  input: string;
  setInput: (s: string) => void;
  onSend: () => void;
  aiThinking: boolean;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  canSwitch?: boolean;
  onSwitchToQuestions?: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden rounded-[28px] border border-white/8 bg-neutral-900/70 min-h-[260px] shadow-[0_22px_70px_rgba(0,0,0,0.28)]">
      <div className="relative border-b border-white/6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_36%)]" />
        <div className="relative flex items-start gap-3 px-5 py-4 sm:px-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/16 bg-emerald-500/10 text-emerald-300 flex-shrink-0">
            <iconify-icon icon="solar:magic-stick-3-bold" class="text-lg" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Modo conversacional</p>
                <h4 className="mt-1 text-base font-bold text-white font-bricolage">Assistente IA</h4>
                <p className="mt-1 text-xs text-neutral-400">Descreva a operação em linguagem natural e a IA estrutura os campos do smart contract.</p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {canSwitch && onSwitchToQuestions && (
                  <button
                    onClick={onSwitchToQuestions}
                    className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-neutral-300 transition-colors hover:border-white/14 hover:text-white"
                  >
                    <iconify-icon icon="solar:list-check-linear" class="text-sm" />
                    Responder perguntas
                  </button>
                )}
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/16 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  Online
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 p-5 sm:p-6 space-y-4 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.05),transparent_28%)]">
        {messages.map((m, i) => (
          <ChatBubble key={i} message={m} />
        ))}
        {aiThinking && (
          <div className="inline-flex items-center gap-3 rounded-full border border-white/8 bg-white/[0.03] px-4 py-2 text-sm text-neutral-400">
            <div className="flex gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce" />
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0.15s' }} />
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0.3s' }} />
            </div>
            <span className="text-xs font-medium">IA estruturando o contrato...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); onSend(); }}
        className="border-t border-white/6 bg-black/15 p-4 sm:p-5"
      >
        <div className="flex gap-3 rounded-[24px] border border-white/8 bg-neutral-950/85 p-2">
          <div className="flex-1 px-2 py-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Prompt</p>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ex: O comprador é @lucas e vai pagar 5000 USDC em duas parcelas..."
              disabled={aiThinking}
              className="mt-1 w-full bg-transparent text-sm text-white placeholder:text-neutral-600 outline-none disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || aiThinking}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-neutral-950 transition-colors hover:bg-emerald-400 disabled:bg-neutral-800 disabled:text-neutral-500"
          >
            <iconify-icon icon="solar:plain-bold" class="text-lg" />
          </button>
        </div>
      </form>
    </div>
  );
}

function ChatBubble({ message }: { message: AIChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[88%] rounded-[24px] border px-4 py-3 text-sm ${
          isUser
            ? 'border-emerald-400/18 bg-emerald-500/10 text-white'
            : 'border-white/8 bg-white/[0.04] text-neutral-200'
        }`}
      >
        <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
          <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full border ${isUser ? 'border-emerald-400/16 bg-emerald-500/10 text-emerald-300' : 'border-white/8 bg-white/[0.03] text-neutral-300'}`}>
            <iconify-icon icon={isUser ? 'solar:user-rounded-bold' : 'solar:stars-bold'} class="text-sm" />
          </span>
          {isUser ? 'Solicitação' : 'Resposta da IA'}
        </div>
        <div className="whitespace-pre-wrap leading-relaxed" dangerouslySetInnerHTML={{
          __html: message.text
            .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-bold">$1</strong>')
            .replace(/\n/g, '<br>')
        }} />
        {message.extractedFields && Object.keys(message.extractedFields).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/8 pt-3">
            {Object.keys(message.extractedFields).map(k => (
              <span key={k} className="rounded-full border border-emerald-400/16 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
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
    <div className="bg-neutral-900/60 border border-white/5 rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <iconify-icon icon="solar:settings-linear" class="text-neutral-400" />
          <span className="text-sm font-medium text-white">Editar campos manualmente</span>
          <span className="text-[10px] text-neutral-500">({Object.keys(variables).filter(k => variables[k]).length}/{template.variables.length} preenchidos)</span>
        </div>
        <iconify-icon icon={expanded ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"} class="text-neutral-500" />
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
  const inputClass = "w-full bg-neutral-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-emerald-500/40";

  const isWideField = variable.type === 'text' &&
    ['propertyAddress', 'productName', 'projectScope', 'product', 'role', 'invoiceNumber', 'trackingCode', 'triggerEvent', 'employees', 'beneficiaries'].includes(variable.name);

  return (
    <div className={isWideField ? 'sm:col-span-2' : ''}>
      <label className="block text-xs font-medium text-neutral-400 mb-1">
        {variable.label} {variable.required && <span className="text-emerald-400">*</span>}
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
        <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-2">
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
        <div className="bg-neutral-900/80 border border-white/5 rounded-xl p-3 text-xs text-neutral-400 flex items-start gap-2">
          <iconify-icon icon="solar:info-circle-bold" class="text-neutral-500 mt-0.5" />
          <span>
            Este template está em <strong className="text-neutral-200">versão beta</strong> — a lógica completa do Soroban será expandida em breve. O hash do contrato continua sendo ancorado on-chain normalmente.
          </span>
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
          Para o demo, ancoramos o <code className="text-emerald-400">SHA-256</code> do código + variáveis na testnet.
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
        <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
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
                {a.preState} <iconify-icon icon="solar:arrow-right-bold" class="text-emerald-400" /> {a.postState}
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
    // Profissional
    legal_fees: 'service',
    medical_consultation: 'service',
    dental_treatment: 'service',
    accounting_services: 'service',
    psychology_package: 'service',
    // Construção
    construction_contract: 'service',
    architectural_project: 'service',
    renovation_milestone: 'service',
    // Veículos
    vehicle_sale: 'sale',
    vehicle_lease: 'loan',
    car_rental_daily: 'rental',
    // RWA
    real_estate_token: 'partnership',
    commodity_token: 'sale',
    carbon_credits: 'sale',
    solar_yield_token: 'partnership',
    // Registros
    birth_registry: 'declaration',
    marriage_contract: 'declaration',
    divorce_settlement: 'declaration',
    death_certificate: 'declaration',
    notarized_declaration: 'declaration',
    // Imóveis adicionais
    commercial_rent: 'rental',
    short_stay: 'rental',
  };
  return map[templateId] || 'service';
}

async function extractPartiesFromVariables(template: SmartContractTemplate, vars: Record<string, string>) {
  const parties: { name: string; email: string; role: 'creator' | 'counterparty' | 'witness' }[] = [];
  const addressFields = template.variables.filter(v => v.type === 'address');

  for (const [idx, field] of addressFields.entries()) {
    const raw = vars[field.name];
    if (!raw) continue;

    let displayName: string;
    let email = '';

    if (raw.startsWith('@')) {
      const asyncResolved = await resolveHandle(raw);
      const resolved = asyncResolved ?? resolveHandleSync(raw);
      if (resolved) {
        displayName = `${field.label}: ${resolved.displayName} (@${resolved.handle})`;
      } else {
        displayName = `${field.label}: @${normalizeHandle(raw)}`;
      }

      email = asyncResolved?.email ?? raw;
    } else {
      // Endereço bruto — vê se conhecemos o user
      const known = lookupHandleByAddress(raw);
      displayName = known
        ? `${field.label}: ${known.displayName} (@${known.handle})`
        : `${field.label} (${raw.slice(0, 6)}...${raw.slice(-4)})`;
    }

    parties.push({
      name: displayName,
      email,
      role: idx === 0 ? 'creator' : 'counterparty',
    });
  }

  return parties;
}

async function buildSigningReviewParties(template: SmartContractTemplate, vars: Record<string, string>): Promise<SigningReviewParty[]> {
  const addressFields = template.variables.filter((variable) => variable.type === 'address');

  return Promise.all(addressFields
    .filter((field) => Boolean(vars[field.name]))
    .map(async (field) => {
      const inputValue = vars[field.name];
      let resolved: ResolvedHandle | null;
      let verification: SigningReviewParty['verification'] = 'manual';

      if (inputValue.startsWith('@')) {
        resolved = await resolveHandle(inputValue);
        verification = resolved ? 'profile' : 'manual';
      } else {
        resolved = await lookupProfileByAddress(inputValue);
        if (resolved) {
          verification = 'profile';
        } else {
          const known = lookupHandleByAddress(inputValue);
          if (known) {
            resolved = known;
            verification = 'wallet';
          }
        }
      }

      return {
        fieldLabel: field.label,
        inputValue,
        displayName: resolved?.displayName || (inputValue.startsWith('@') ? inputValue : `Carteira ${shortenAddress(inputValue)}`),
        handle: resolved?.handle,
        email: resolved?.email,
        address: resolved?.address || (!inputValue.startsWith('@') ? inputValue : undefined),
        avatar: resolved?.avatar,
        verification,
        hasWallet: Boolean(resolved?.address || (!inputValue.startsWith('@') && inputValue)),
      } satisfies SigningReviewParty;
    }));
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

async function resolveAllHandlesAsync(template: SmartContractTemplate, vars: Record<string, string>): Promise<Record<string, string>> {
  const resolved: Record<string, string> = { ...vars };
  for (const variable of template.variables) {
    if (variable.type !== 'address') continue;
    const raw = vars[variable.name];
    if (raw && raw.startsWith('@')) {
      const handleResolution = await resolveHandle(raw);
      if (handleResolution?.address) resolved[variable.name] = handleResolution.address;
    }
  }
  return resolved;
}

// ─── Document live preview ─────────────────────────────────────────
// Renderiza o contrato como uma "folha" minimalista que se preenche
// conforme o usuário (ou a IA) vai completando os campos.

function DocumentPreview({ template, variables }: {
  template: SmartContractTemplate;
  variables: Record<string, string>;
}) {
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const partyFields = template.variables.filter(v => v.type === 'address');
  const valueFields = template.variables.filter(v => v.type === 'amount');
  const otherFields = template.variables.filter(v => !['address', 'amount'].includes(v.type));

  const totalFields = template.variables.length;
  const filledFields = template.variables.filter(v => variables[v.name]?.trim()).length;

  return (
    <div className="p-5 bg-gradient-to-b from-neutral-950 to-neutral-900">
      <motion.div
        layout
        className="relative bg-[#0f0f0f] border border-white/5 rounded-xl shadow-lg overflow-hidden"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, transparent 0, transparent 31px, rgba(255,255,255,0.025) 31px, rgba(255,255,255,0.025) 32px)',
        }}
      >
        {/* Cabeçalho do "papel" */}
        <div className="px-8 pt-8 pb-6 border-b border-white/5">
          <div className="flex items-center justify-between text-[10px] text-neutral-600 uppercase tracking-wider mb-6">
            <span className="flex items-center gap-1.5">
              <iconify-icon icon="solar:cpu-bolt-bold-duotone" class="text-emerald-500" />
              ContractEase · Smart Contract
            </span>
            <span>{today}</span>
          </div>

          <h1 className="text-2xl font-bold text-white mb-1 leading-tight font-bricolage">{template.name}</h1>
          <p className="text-xs text-neutral-500 leading-relaxed max-w-prose">{template.description}</p>
        </div>

        {/* Corpo do documento */}
        <div className="px-8 py-6 space-y-6 text-sm">
          {/* Seção: Partes */}
          {partyFields.length > 0 && (
            <DocSection title="Partes" total={partyFields.length} filled={partyFields.filter(v => variables[v.name]).length}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {partyFields.map(v => (
                  <DocField
                    key={v.name}
                    label={v.label}
                    value={variables[v.name]}
                    placeholder={v.placeholder || '@usuario'}
                  />
                ))}
              </div>
            </DocSection>
          )}

          {/* Seção: Valores */}
          {valueFields.length > 0 && (
            <DocSection title="Valores" total={valueFields.length} filled={valueFields.filter(v => variables[v.name]).length}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {valueFields.map(v => {
                  const asset = variables.asset || 'BRZ';
                  const val = variables[v.name];
                  return (
                    <DocField
                      key={v.name}
                      label={v.label}
                      value={val ? `${val} ${asset}` : ''}
                      placeholder="—"
                      highlight
                    />
                  );
                })}
              </div>
            </DocSection>
          )}

          {/* Seção: Demais cláusulas */}
          {otherFields.length > 0 && (
            <DocSection title="Termos" total={otherFields.length} filled={otherFields.filter(v => variables[v.name]).length}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {otherFields.map(v => (
                  <DocField
                    key={v.name}
                    label={v.label}
                    value={variables[v.name]}
                    placeholder={v.placeholder || '—'}
                  />
                ))}
              </div>
            </DocSection>
          )}

          {/* Seção: Estados */}
          <DocSection title="Ciclo do contrato" total={template.states.length} filled={template.states.length}>
            <div className="flex items-center flex-wrap gap-1.5">
              {template.states.map((s, i) => (
                <span key={s.id} className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-neutral-600">{i + 1}</span>
                  <span className="text-[11px] font-medium text-neutral-300 bg-neutral-800/60 px-2 py-0.5 rounded-md border border-white/5">
                    {s.label}
                  </span>
                  {i < template.states.length - 1 && (
                    <iconify-icon icon="solar:arrow-right-linear" class="text-neutral-700 text-xs" />
                  )}
                </span>
              ))}
            </div>
          </DocSection>
        </div>

        {/* Rodapé / "assinatura" */}
        <div className="px-8 py-5 border-t border-white/5 bg-neutral-950/60">
          <div className="flex items-center justify-between text-[11px]">
            <div className="text-neutral-500 leading-relaxed max-w-md">
              Ao implantar este contrato, o hash SHA-256 do código Soroban + parâmetros é ancorado
              imutavelmente na blockchain Stellar.
            </div>
            <div className="flex items-center gap-2 text-emerald-400 whitespace-nowrap">
              <iconify-icon icon="solar:shield-check-bold-duotone" class="text-base" />
              <span className="font-medium">Stellar · Soroban</span>
            </div>
          </div>
        </div>

        {/* Overlay decorativo quando vazio */}
        {filledFields === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-neutral-950/30 backdrop-blur-[1px]">
            <div className="text-center">
              <iconify-icon icon="solar:document-add-bold-duotone" class="text-5xl text-neutral-700 mb-2" />
              <p className="text-xs text-neutral-500">
                O documento aparece aqui conforme você descreve para a IA
              </p>
            </div>
          </div>
        )}
      </motion.div>

      <div className="flex items-center justify-between mt-3 text-[10px] text-neutral-600">
        <span>Atualizado em tempo real · {filledFields}/{totalFields} campos preenchidos</span>
        <span className="font-mono">v1 · rascunho</span>
      </div>
    </div>
  );
}

function DocSection({ title, total, filled, children }: {
  title: string;
  total: number;
  filled: number;
  children: React.ReactNode;
}) {
  const pct = total === 0 ? 0 : Math.round((filled / total) * 100);
  return (
    <section>
      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-white/5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
          {title}
        </h3>
        <span className="text-[10px] text-neutral-600 tabular-nums">{filled}/{total} · {pct}%</span>
      </div>
      {children}
    </section>
  );
}

function DocField({ label, value, placeholder, highlight }: {
  label: string;
  value?: string;
  placeholder: string;
  highlight?: boolean;
}) {
  const isFilled = !!value?.trim();
  const display = isFilled ? value : placeholder;

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wide text-neutral-600">{label}</span>
      <AnimatePresence mode="wait">
        <motion.span
          key={display}
          initial={{ opacity: 0, y: -3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 3 }}
          transition={{ duration: 0.18 }}
          className={`text-sm leading-snug truncate ${
            isFilled
              ? highlight
                ? 'text-emerald-300 font-semibold'
                : 'text-white font-medium'
              : 'text-neutral-700 italic'
          }`}
        >
          {display}
        </motion.span>
      </AnimatePresence>
    </div>
  );
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
