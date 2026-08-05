/**
 * Fluxo guiado de criação — do zero ao contrato registrado na blockchain.
 *
 * Princípios que este arquivo tenta respeitar:
 *  1. Uma pergunta por tela. Nunca duas decisões simultâneas.
 *  2. Nenhuma palavra técnica sem tradução ao lado.
 *  3. Toda etapa diz o que é, por que existe e como fazer.
 *  4. O botão principal fica sempre no mesmo canto, com o mesmo verde.
 *  5. Quando o botão está travado, a tela diz exatamente o que falta.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useNotificationStore, useWalletStore } from '@/stores';
import { useCreateContract } from '@/hooks/useContractQueries';
import { Caveat, Explain } from '@/components/guide/Explain';
import { Stepper, type StepDef } from '@/components/guide/Stepper';
import { ChoiceCard, Field, StepShell, inputClass } from '@/components/guide/StepShell';
import {
  WALLET_PROVIDERS,
  WalletError,
  anchorDocumentHash,
  explorerAccountUrl,
  explorerTxUrl,
  shortenAddress,
  type StellarNetwork,
  type WalletProviderId,
} from '@/services/wallet';
import type { ContractType } from '@/types';

// ─── Modelo do fluxo ───────────────────────────────────────────────────

type Goal = 'document' | 'escrow';

const STEPS: StepDef[] = [
  { id: 'goal', label: 'Objetivo' },
  { id: 'details', label: 'Detalhes' },
  { id: 'people', label: 'Pessoas' },
  { id: 'review', label: 'Revisão' },
  { id: 'wallet', label: 'Carteira' },
  { id: 'publish', label: 'Registro' },
];

interface Person {
  name: string;
  email: string;
}

interface Draft {
  goal: Goal | null;
  title: string;
  purpose: string;
  amount: string;
  currency: 'BRL' | 'USDC' | 'XLM';
  deadline: string;
  people: Person[];
}

const EMPTY_DRAFT: Draft = {
  goal: null,
  title: '',
  purpose: '',
  amount: '',
  currency: 'BRL',
  deadline: '',
  people: [{ name: '', email: '' }],
};

/** Calcula a impressão digital do acordo. Roda no navegador — o texto não sai daqui. */
async function fingerprint(draft: Draft): Promise<string> {
  const canonical = JSON.stringify({
    goal: draft.goal,
    title: draft.title.trim(),
    purpose: draft.purpose.trim(),
    amount: draft.amount,
    currency: draft.currency,
    deadline: draft.deadline,
    people: draft.people.map((p) => ({ name: p.name.trim(), email: p.email.trim().toLowerCase() })),
  });
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── Página ────────────────────────────────────────────────────────────

export default function GuidedCreatePage() {
  const navigate = useNavigate();
  const notify = useNotificationStore((s) => s.add);
  const createMutation = useCreateContract();
  const wallet = useWalletStore();

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [hash, setHash] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishLog, setPublishLog] = useState<string[]>([]);
  const [result, setResult] = useState<{ txHash: string; network: StellarNetwork } | null>(null);
  const [error, setError] = useState<{ message: string; fix?: string } | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    void wallet.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patch = useCallback((values: Partial<Draft>) => setDraft((d) => ({ ...d, ...values })), []);

  const validPeople = draft.people.filter((p) => EMAIL_RE.test(p.email.trim()));
  const detailsOk = draft.title.trim().length >= 3 && (draft.goal !== 'escrow' || Number(draft.amount) > 0);
  const peopleOk = validPeople.length >= 1;
  const walletReady = wallet.isConnected && wallet.accountExists;

  const goNext = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  // A impressão digital é recalculada ao entrar na revisão — assim o que o
  // usuário confere é exatamente o que vai ser registrado.
  useEffect(() => {
    if (step >= 3 && draft.goal) {
      void fingerprint(draft).then(setHash);
    }
  }, [step, draft]);

  const publish = useCallback(async () => {
    if (!wallet.address || !wallet.provider || !hash) return;
    setPublishing(true);
    setError(null);
    setPublishLog(['Montando a transação com a impressão digital do acordo…']);

    try {
      const network = (wallet.network as StellarNetwork) ?? 'testnet';

      // 1. Guarda o acordo no ContractEase. Se o backend não responder, seguimos
      //    mesmo assim: o registro on-chain é o que dá validade, e perder isso
      //    por causa de uma falha de rede seria pior.
      let savedId: string | null = null;
      try {
        const created = await createMutation.mutateAsync({
          title: draft.title.trim(),
          description: draft.purpose.trim(),
          type: (draft.goal === 'escrow' ? 'escrow' : 'service') as ContractType,
          parties: [
            ...draft.people.map((p, i) => ({
              name: p.name.trim() || p.email.trim(),
              email: p.email.trim(),
              role: (i === 0 ? 'creator' : 'counterparty') as 'creator' | 'counterparty',
            })),
          ],
          clauses: [{ order: 1, title: 'Objeto', content: draft.purpose.trim() || draft.title.trim() }],
          expiresAt: draft.deadline
            ? new Date(draft.deadline).toISOString()
            : new Date(Date.now() + 30 * 864e5).toISOString(),
          tags: [],
          signatureOrder: 'parallel' as const,
        });
        savedId = created?.id ?? null;
        setPublishLog((l) => [...l, 'Acordo salvo na sua conta.']);
      } catch {
        setPublishLog((l) => [...l, 'Não deu para salvar na sua conta agora — seguindo com o registro na blockchain.']);
      }

      // 2. O passo que importa: gravar a prova on-chain.
      setPublishLog((l) => [...l, 'Pedindo sua assinatura na carteira…']);
      const submitted = await anchorDocumentHash(wallet.provider, wallet.address, hash, network);

      setPublishLog((l) => [...l, 'Registrado. A rede confirmou a transação.']);
      setResult({ txHash: submitted.hash, network });
      setStep(STEPS.length - 1);

      notify({
        type: 'success',
        title: 'Contrato registrado na blockchain',
        message: savedId ? 'Prova pública gerada e acordo salvo.' : 'Prova pública gerada.',
      });
    } catch (err) {
      const walletError = err instanceof WalletError ? err : null;
      setError({
        message: walletError?.message ?? (err as Error)?.message ?? 'Não foi possível registrar.',
        fix: walletError?.fix,
      });
      setPublishLog((l) => [...l, 'Interrompido.']);
    } finally {
      setPublishing(false);
    }
  }, [wallet.address, wallet.provider, wallet.network, hash, draft, createMutation, notify]);

  const currentStep = STEPS[step];

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-20">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
            Passo {step + 1} de {STEPS.length}
          </p>
          <button
            onClick={() => navigate('/contracts')}
            className="text-xs font-medium text-neutral-500 transition-colors hover:text-white"
          >
            Sair sem salvar
          </button>
        </div>
        <Stepper steps={STEPS} current={step} onGoTo={(i) => !result && setStep(i)} />
      </div>

      <AnimatePresence mode="wait">
        <div key={currentStep.id}>
          {/* ── 1. Objetivo ────────────────────────────────────────── */}
          {currentStep.id === 'goal' && (
            <StepShell
              eyebrow="Começando"
              title="O que você precisa fazer?"
              subtitle="Escolha pelo resultado que você quer, não pela tecnologia. Nós cuidamos do resto."
              primaryLabel="Continuar"
              onPrimary={goNext}
              primaryDisabled={!draft.goal}
              primaryHint="Escolha uma das duas opções acima."
            >
              <div className="space-y-3">
                <ChoiceCard
                  icon="solar:document-text-bold-duotone"
                  title="Registrar um acordo assinado"
                  description="Um documento com valor de prova: fica registrado na blockchain com data e hora, e qualquer pessoa consegue verificar depois."
                  meta="Ex.: prestação de serviço, confidencialidade, recibo, procuração"
                  selected={draft.goal === 'document'}
                  onClick={() => patch({ goal: 'document' })}
                />
                <ChoiceCard
                  icon="solar:lock-keyhole-minimalistic-bold-duotone"
                  title="Travar um pagamento até a entrega"
                  description="O dinheiro fica retido e só é liberado quando a condição combinada acontece. Nenhum dos lados consegue mexer sozinho."
                  meta="Ex.: freelancer, compra e venda, aluguel com caução, obra por etapas"
                  badge="escrow"
                  selected={draft.goal === 'escrow'}
                  onClick={() => patch({ goal: 'escrow' })}
                />
              </div>

              <Explain
                what="Estas são as duas coisas que o ContractEase faz. Tudo o mais são variações destas duas."
                why="Separar isso logo no começo evita que você preencha campos que não têm nada a ver com o seu caso."
                how={[
                  'Se você só precisa provar que um acordo existe e foi aceito, escolha a primeira.',
                  'Se existe dinheiro envolvido e falta confiança entre as partes, escolha a segunda.',
                  'Dá para mudar de ideia depois — nada é gravado até o último passo.',
                ]}
              />
            </StepShell>
          )}

          {/* ── 2. Detalhes ────────────────────────────────────────── */}
          {currentStep.id === 'details' && (
            <StepShell
              eyebrow="Detalhes"
              title="Do que se trata esse acordo?"
              subtitle="Só o essencial. Você poderá detalhar cláusulas depois, se quiser."
              onBack={goBack}
              primaryLabel="Continuar"
              onPrimary={() => {
                setTouched(true);
                if (detailsOk) {
                  setTouched(false);
                  goNext();
                }
              }}
              primaryDisabled={!detailsOk}
              primaryHint={
                draft.goal === 'escrow' && !(Number(draft.amount) > 0)
                  ? 'Informe o título e o valor que ficará retido.'
                  : 'Dê um título com pelo menos 3 letras.'
              }
            >
              <div className="space-y-5 rounded-2xl border border-white/8 bg-white/[0.02] p-5">
                <Field
                  label="Título"
                  required
                  hint="Como você se refere a esse acordo no dia a dia."
                  error={touched && draft.title.trim().length < 3 ? 'Escreva pelo menos 3 letras.' : undefined}
                >
                  <input
                    value={draft.title}
                    onChange={(e) => patch({ title: e.target.value })}
                    placeholder="Ex.: Reforma da cozinha — João"
                    className={inputClass}
                  />
                </Field>

                <Field label="O que foi combinado" hint="Uma ou duas frases. Isso entra na prova registrada.">
                  <textarea
                    value={draft.purpose}
                    onChange={(e) => patch({ purpose: e.target.value })}
                    rows={3}
                    placeholder="Ex.: Instalação dos armários até 30/09, pagamento em duas parcelas."
                    className={`${inputClass} resize-none`}
                  />
                </Field>

                {draft.goal === 'escrow' && (
                  <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                    <Field
                      label="Valor que ficará retido"
                      required
                      hint="Esse valor fica bloqueado até a condição ser cumprida."
                      error={touched && !(Number(draft.amount) > 0) ? 'Informe um valor maior que zero.' : undefined}
                    >
                      <input
                        value={draft.amount}
                        onChange={(e) => patch({ amount: e.target.value.replace(/[^\d.,]/g, '') })}
                        inputMode="decimal"
                        placeholder="0,00"
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Moeda">
                      <select
                        value={draft.currency}
                        onChange={(e) => patch({ currency: e.target.value as Draft['currency'] })}
                        className={inputClass}
                      >
                        <option value="BRL">BRL</option>
                        <option value="USDC">USDC</option>
                        <option value="XLM">XLM</option>
                      </select>
                    </Field>
                  </div>
                )}

                <Field label="Prazo final" hint="Opcional. Se ficar vazio, usamos 30 dias a partir de hoje.">
                  <input
                    type="date"
                    value={draft.deadline}
                    onChange={(e) => patch({ deadline: e.target.value })}
                    className={inputClass}
                  />
                </Field>
              </div>

              {draft.goal === 'escrow' && (
                <Caveat>
                  O valor só sai da sua carteira no momento em que você confirmar o bloqueio, no passo de registro.
                  Preencher aqui não movimenta nada.
                </Caveat>
              )}
            </StepShell>
          )}

          {/* ── 3. Pessoas ─────────────────────────────────────────── */}
          {currentStep.id === 'people' && (
            <StepShell
              eyebrow="Pessoas"
              title="Quem participa desse acordo?"
              subtitle="Cada pessoa recebe um link por e-mail para assinar. Ninguém precisa criar conta para isso."
              onBack={goBack}
              primaryLabel="Continuar"
              onPrimary={() => {
                setTouched(true);
                if (peopleOk) {
                  setTouched(false);
                  goNext();
                }
              }}
              primaryDisabled={!peopleOk}
              primaryHint="Informe pelo menos um e-mail válido."
            >
              <div className="space-y-3">
                {draft.people.map((person, i) => (
                  <div key={i} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                        {i === 0 ? 'Você' : `Participante ${i + 1}`}
                      </span>
                      {draft.people.length > 1 && (
                        <button
                          onClick={() => patch({ people: draft.people.filter((_, idx) => idx !== i) })}
                          className="text-xs text-neutral-600 transition-colors hover:text-red-400"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        value={person.name}
                        onChange={(e) =>
                          patch({
                            people: draft.people.map((p, idx) => (idx === i ? { ...p, name: e.target.value } : p)),
                          })
                        }
                        placeholder="Nome"
                        className={inputClass}
                      />
                      <input
                        value={person.email}
                        onChange={(e) =>
                          patch({
                            people: draft.people.map((p, idx) => (idx === i ? { ...p, email: e.target.value } : p)),
                          })
                        }
                        placeholder="email@exemplo.com"
                        className={inputClass}
                      />
                    </div>
                    {touched && person.email.trim() && !EMAIL_RE.test(person.email.trim()) && (
                      <p className="mt-2 text-xs text-red-400">Esse e-mail não parece válido.</p>
                    )}
                  </div>
                ))}

                <button
                  onClick={() => patch({ people: [...draft.people, { name: '', email: '' }] })}
                  className="w-full rounded-2xl border border-dashed border-white/12 py-3 text-sm text-neutral-500 transition-colors hover:border-emerald-500/40 hover:text-white"
                >
                  <iconify-icon icon="solar:add-circle-linear" class="mr-1.5 text-base" />
                  Adicionar participante
                </button>
              </div>

              <Explain
                what="A lista de quem precisa concordar com o acordo."
                why="A prova registrada inclui exatamente estes nomes e e-mails. Se alguém for adicionado depois, a prova muda — e isso é intencional."
                how={[
                  'Coloque seu e-mail na primeira linha.',
                  'Adicione uma linha para cada outra pessoa envolvida.',
                  'Confira os e-mails: é para lá que o link de assinatura vai.',
                ]}
              />
            </StepShell>
          )}

          {/* ── 4. Revisão ─────────────────────────────────────────── */}
          {currentStep.id === 'review' && (
            <StepShell
              eyebrow="Revisão"
              title="Confira antes de registrar"
              subtitle="Depois de registrado, o conteúdo não pode ser alterado — essa é justamente a garantia."
              onBack={goBack}
              primaryLabel={walletReady ? 'Ir para o registro' : 'Conectar carteira'}
              onPrimary={() => setStep(walletReady ? 5 : 4)}
            >
              <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02]">
                <SummaryRow label="Tipo" value={draft.goal === 'escrow' ? 'Pagamento travado até a entrega' : 'Acordo assinado'} />
                <SummaryRow label="Título" value={draft.title.trim()} />
                {draft.purpose.trim() && <SummaryRow label="O que foi combinado" value={draft.purpose.trim()} />}
                {draft.goal === 'escrow' && (
                  <SummaryRow label="Valor retido" value={`${draft.amount} ${draft.currency}`} />
                )}
                <SummaryRow
                  label="Prazo"
                  value={
                    draft.deadline
                      ? new Date(draft.deadline).toLocaleDateString('pt-BR')
                      : '30 dias a partir de hoje'
                  }
                />
                <SummaryRow
                  label="Participantes"
                  value={validPeople.map((p) => `${p.name || '—'} · ${p.email}`).join('\n')}
                />
              </div>

              <div className="rounded-2xl border border-white/8 bg-black/25 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                  Impressão digital do acordo
                </p>
                <p className="mt-2 break-all font-mono text-xs leading-6 text-emerald-300/90">
                  {hash ?? 'calculando…'}
                </p>
                <p className="mt-3 text-xs leading-6 text-neutral-500">
                  Esse código de 64 caracteres é gerado a partir do conteúdo acima, dentro do seu navegador. Mudar uma
                  única letra do acordo gera um código completamente diferente — é assim que se prova que nada foi
                  alterado depois. O texto do contrato nunca é enviado para a blockchain; só esse código.
                </p>
              </div>
            </StepShell>
          )}

          {/* ── 5. Carteira ────────────────────────────────────────── */}
          {currentStep.id === 'wallet' && (
            <StepShell
              eyebrow="Carteira"
              title="Conecte a carteira que vai assinar"
              subtitle="É ela que transforma o clique em uma assinatura verificável por qualquer pessoa."
              onBack={goBack}
              primaryLabel="Continuar para o registro"
              onPrimary={goNext}
              primaryDisabled={!walletReady}
              primaryHint={
                !wallet.isConnected
                  ? 'Conecte uma carteira acima.'
                  : 'Falta ativar a conta na blockchain — use o botão de saldo de teste.'
              }
            >
              <InlineWallet />

              <Explain
                what="A carteira guarda uma chave secreta que só você tem. Assinar é usar essa chave, sem nunca revelá-la."
                why="Se a assinatura fosse só um registro no nosso banco de dados, ela valeria apenas enquanto você confiasse em nós. Com a carteira, a prova é independente do ContractEase."
                how={[
                  'Se você já usa MetaMask, clique em "Conectar MetaMask" — ela vai pedir para instalar um complemento Stellar uma única vez.',
                  'Aprove as duas janelas que a MetaMask abrir (conectar e instalar).',
                  'Na rede de testes, clique em "Liberar saldo de teste" para conseguir pagar as taxas.',
                ]}
              />
            </StepShell>
          )}

          {/* ── 6. Registro / Pronto ───────────────────────────────── */}
          {currentStep.id === 'publish' && !result && (
            <StepShell
              eyebrow="Último passo"
              title="Registrar na blockchain"
              subtitle="Ao confirmar, sua carteira vai pedir uma assinatura. É a única confirmação necessária."
              onBack={() => setStep(4)}
              primaryLabel={publishing ? 'Registrando…' : 'Registrar agora'}
              onPrimary={publish}
              primaryDisabled={!walletReady || !hash || publishing}
              primaryLoading={publishing}
              primaryHint={!walletReady ? 'Conecte a carteira no passo anterior.' : 'Aguarde o cálculo da impressão digital.'}
            >
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
                <p className="text-sm font-semibold text-white">O que vai acontecer, nesta ordem</p>
                <ol className="mt-3 space-y-2.5">
                  {[
                    'Salvamos o acordo na sua conta do ContractEase.',
                    'Sua carteira abre e pede para você assinar. Confira o valor da taxa — costuma ser menos de um centavo.',
                    'A transação é enviada para a rede Stellar e confirmada em cerca de 5 segundos.',
                    'Você recebe um link público de verificação, que funciona para qualquer pessoa, sem login.',
                  ].map((line, i) => (
                    <li key={i} className="flex gap-3 text-sm leading-6 text-neutral-300">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/12 bg-black/40 text-[10px] font-bold text-neutral-400">
                        {i + 1}
                      </span>
                      {line}
                    </li>
                  ))}
                </ol>
              </div>

              {wallet.network === 'testnet' && (
                <Caveat>
                  Você está na <strong>rede de testes</strong>. O registro é real e verificável, mas usa dinheiro de
                  mentira — perfeito para experimentar. Para valer de verdade, troque para a rede real na tela de
                  Carteira.
                </Caveat>
              )}

              {publishLog.length > 0 && (
                <div className="rounded-2xl border border-white/8 bg-black/30 p-4">
                  {publishLog.map((line, i) => (
                    <p key={i} className="flex items-start gap-2 py-1 text-xs leading-6 text-neutral-400">
                      <iconify-icon
                        icon={i === publishLog.length - 1 && publishing ? 'svg-spinners:ring-resize' : 'solar:check-circle-bold'}
                        class={i === publishLog.length - 1 && publishing ? 'mt-1 text-sm text-emerald-400' : 'mt-1 text-sm text-emerald-500/70'}
                      />
                      {line}
                    </p>
                  ))}
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-red-400/25 bg-red-500/[0.06] p-4">
                  <p className="flex items-start gap-2 text-sm font-medium text-red-200">
                    <iconify-icon icon="solar:danger-circle-bold" class="mt-0.5 shrink-0 text-base" />
                    {error.message}
                  </p>
                  {error.fix && <p className="mt-2 pl-6 text-xs leading-6 text-red-200/75">{error.fix}</p>}
                </div>
              )}
            </StepShell>
          )}

          {currentStep.id === 'publish' && result && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/[0.07] p-6 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-500/15">
                  <iconify-icon icon="solar:check-circle-bold" class="text-3xl text-emerald-300" />
                </div>
                <h1 className="mt-4 font-bricolage text-2xl font-bold text-white">Registrado na blockchain</h1>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-neutral-300">
                  “{draft.title.trim()}” agora tem uma prova pública, com data e hora, que ninguém — nem nós — consegue
                  alterar.
                </p>
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02]">
                <SummaryRow label="Comprovante da transação" value={result.txHash} mono />
                <SummaryRow label="Impressão digital" value={hash ?? ''} mono />
                <SummaryRow label="Rede" value={result.network === 'testnet' ? 'Rede de testes' : 'Rede real'} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <a
                  href={explorerTxUrl(result.txHash, result.network)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-black transition-colors hover:bg-emerald-400"
                >
                  Ver a prova pública
                  <iconify-icon icon="solar:arrow-right-up-linear" class="text-sm" />
                </a>
                <button
                  onClick={() => {
                    void navigator.clipboard.writeText(explorerTxUrl(result.txHash, result.network));
                    notify({ type: 'success', title: 'Link copiado', message: 'Mande para as outras partes.' });
                  }}
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/12 px-5 py-3 text-sm font-semibold text-neutral-200 transition-colors hover:border-white/25 hover:text-white"
                >
                  <iconify-icon icon="solar:copy-linear" class="text-sm" />
                  Copiar link de verificação
                </button>
              </div>

              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
                <p className="text-sm font-semibold text-white">O que fazer agora</p>
                <ul className="mt-3 space-y-2.5 text-sm leading-6 text-neutral-400">
                  <li className="flex gap-3">
                    <iconify-icon icon="solar:letter-linear" class="mt-1 shrink-0 text-emerald-400" />
                    Envie o link de verificação para os participantes — ele abre sem login.
                  </li>
                  <li className="flex gap-3">
                    <iconify-icon icon="solar:folder-linear" class="mt-1 shrink-0 text-emerald-400" />
                    <Link to="/contracts" className="underline decoration-white/20 underline-offset-4 hover:text-white">
                      Acompanhe as assinaturas em Meus contratos
                    </Link>
                  </li>
                  <li className="flex gap-3">
                    <iconify-icon icon="solar:restart-linear" class="mt-1 shrink-0 text-emerald-400" />
                    <button
                      onClick={() => {
                        setDraft(EMPTY_DRAFT);
                        setResult(null);
                        setHash(null);
                        setPublishLog([]);
                        setStep(0);
                      }}
                      className="underline decoration-white/20 underline-offset-4 hover:text-white"
                    >
                      Criar outro contrato
                    </button>
                  </li>
                </ul>
              </div>
            </motion.div>
          )}
        </div>
      </AnimatePresence>
    </div>
  );
}

// ─── Peças da tela ─────────────────────────────────────────────────────

function SummaryRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-white/6 px-5 py-3.5 last:border-0 sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="text-xs font-medium text-neutral-500">{label}</dt>
      <dd className={`whitespace-pre-line break-all text-sm text-neutral-200 ${mono ? 'font-mono text-xs' : ''}`}>
        {value || '—'}
      </dd>
    </div>
  );
}

/**
 * Conexão de carteira embutida no fluxo. Mesmo comportamento da página
 * dedicada, sem tirar o usuário do trilho.
 */
function InlineWallet() {
  const wallet = useWalletStore();
  const notify = useNotificationStore((s) => s.add);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; fix?: string } | null>(null);

  const network = (wallet.network as StellarNetwork) ?? 'testnet';

  const handleConnect = async (id: WalletProviderId) => {
    setError(null);
    setBusy(id);
    try {
      await wallet.connect(id, 'testnet');
    } catch (err) {
      const walletError = err instanceof WalletError ? err : null;
      setError({
        message: walletError?.message ?? (err as Error)?.message ?? 'Não foi possível conectar.',
        fix: walletError?.fix,
      });
    } finally {
      setBusy(null);
    }
  };

  const handleFund = async () => {
    setBusy('fund');
    setError(null);
    try {
      await wallet.fund();
      notify({ type: 'success', title: 'Saldo de teste liberado', message: 'Conta ativa na rede de testes.' });
    } catch (err) {
      const walletError = err instanceof WalletError ? err : null;
      setError({
        message: walletError?.message ?? (err as Error)?.message ?? 'Falha ao liberar saldo.',
        fix: walletError?.fix,
      });
    } finally {
      setBusy(null);
    }
  };

  if (wallet.isConnected && wallet.address) {
    return (
      <div className="space-y-3">
        <div
          className={`rounded-2xl border p-5 ${wallet.accountExists ? 'border-emerald-400/30 bg-emerald-500/[0.06]' : 'border-amber-400/25 bg-amber-500/[0.05]'}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
                {WALLET_PROVIDERS.find((p) => p.meta.id === wallet.provider)?.meta.name} conectada
              </p>
              <p className="mt-1.5 font-mono text-sm text-white">{shortenAddress(wallet.address, 8, 6)}</p>
              <p className="mt-1 text-xs text-neutral-400">
                {network === 'testnet' ? 'rede de testes' : 'rede real'} ·{' '}
                {wallet.xlm === null ? 'saldo —' : `${Number(wallet.xlm).toFixed(2)} XLM`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={explorerAccountUrl(wallet.address, network)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-white/10 px-3 py-2 text-xs text-neutral-400 transition-colors hover:text-white"
              >
                Ver conta
              </a>
              <button
                onClick={wallet.disconnect}
                className="rounded-xl border border-white/10 px-3 py-2 text-xs text-neutral-400 transition-colors hover:border-red-400/30 hover:text-red-300"
              >
                Trocar
              </button>
            </div>
          </div>

          {!wallet.accountExists && (
            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="text-sm font-medium text-white">Falta ativar a conta na blockchain</p>
              <p className="mt-1 text-xs leading-6 text-neutral-400">
                Em Stellar, uma conta só existe depois de receber um saldo inicial. Na rede de testes isso é gratuito e
                instantâneo.
              </p>
              <button
                onClick={handleFund}
                disabled={busy === 'fund'}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50"
              >
                {busy === 'fund' && <iconify-icon icon="svg-spinners:ring-resize" class="text-base" />}
                Liberar saldo de teste (grátis)
              </button>
            </div>
          )}
        </div>

        {error && <WalletErrorBox error={error} />}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {WALLET_PROVIDERS.map((p) => {
        const detection = wallet.detected.find((d) => d.id === p.meta.id);
        const installed = detection?.installed ?? false;

        return (
          <div key={p.meta.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-neutral-300">
                  <iconify-icon icon={p.meta.icon} class="text-lg" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">{p.meta.name}</p>
                    {p.meta.recommended && (
                      <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                        recomendada
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 max-w-md text-xs leading-5 text-neutral-500">{p.meta.tagline}</p>
                </div>
              </div>

              {!installed && p.meta.installUrl ? (
                <a
                  href={p.meta.installUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-xl border border-white/12 px-4 py-2.5 text-sm font-semibold text-neutral-200 transition-colors hover:border-white/25"
                >
                  Instalar
                </a>
              ) : (
                <button
                  onClick={() => handleConnect(p.meta.id)}
                  disabled={busy !== null}
                  className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors disabled:opacity-50 ${
                    p.meta.recommended ? 'bg-emerald-500 text-black hover:bg-emerald-400' : 'border border-white/12 text-neutral-100'
                  }`}
                >
                  {busy === p.meta.id && <iconify-icon icon="svg-spinners:ring-resize" class="mr-1.5 text-base" />}
                  {p.meta.id === 'app' ? 'Criar carteira de teste' : 'Conectar'}
                </button>
              )}
            </div>
          </div>
        );
      })}

      {error && <WalletErrorBox error={error} />}
    </div>
  );
}

function WalletErrorBox({ error }: { error: { message: string; fix?: string } }) {
  return (
    <div className="rounded-2xl border border-red-400/25 bg-red-500/[0.06] p-4">
      <p className="flex items-start gap-2 text-sm font-medium text-red-200">
        <iconify-icon icon="solar:danger-circle-bold" class="mt-0.5 shrink-0 text-base" />
        {error.message}
      </p>
      {error.fix && <p className="mt-2 pl-6 text-xs leading-6 text-red-200/75">{error.fix}</p>}
    </div>
  );
}
