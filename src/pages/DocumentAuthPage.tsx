import { useCallback, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthStore, useNotificationStore } from '@/stores';
import {
  authenticateDocument,
  verifyDocument,
  listDocumentAuthentications,
  getDocumentDownloadUrl,
  getStellarExplorerUrl,
  formatFileSize,
  truncateHash,
  type DocumentAuth,
  type VerifyResult,
} from '@/services/documentAuthService';

type Tab = 'autenticar' | 'historico' | 'verificar';

type AuthStep =
  | 'idle'
  | 'hashing'
  | 'uploading'
  | 'anchoring'
  | 'done'
  | 'error';

const STEP_LABELS: Record<AuthStep, string> = {
  idle: '',
  hashing: 'Calculando SHA-256 do documento…',
  uploading: 'Salvando documento com segurança…',
  anchoring: 'Ancorar hash na blockchain Stellar…',
  done: 'Certificado gerado',
  error: 'Erro na autenticação',
};

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/jpeg','image/png','image/webp','image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain','text/csv',
].join(',');

export default function DocumentAuthPage() {
  const [tab, setTab] = useState<Tab>('autenticar');
  const { user } = useAuthStore();
  const notify = useNotificationStore((s) => s.add);
  const qc = useQueryClient();

  // ── Auth tab state ──────────────────────────────────────────────────────────
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [step, setStep] = useState<AuthStep>('idle');
  const [result, setResult] = useState<DocumentAuth | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Verify tab state ────────────────────────────────────────────────────────
  const [verifyFile, setVerifyFile] = useState<File | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const verifyInputRef = useRef<HTMLInputElement>(null);

  // ── History ─────────────────────────────────────────────────────────────────
  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['document-authentications'],
    queryFn: listDocumentAuthentications,
    enabled: tab === 'historico',
  });

  // ── File pick ───────────────────────────────────────────────────────────────
  const handleFilePick = (file: File) => {
    if (file.size > 52428800) {
      notify({ type: 'warning', title: 'Arquivo muito grande', message: 'Limite máximo de 50 MB por documento.' });
      return;
    }
    setSelectedFile(file);
    setStep('idle');
    setResult(null);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFilePick(file);
  }, []);

  // ── Authenticate ─────────────────────────────────────────────────────────────
  const authMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !user) throw new Error('Sem arquivo ou usuário');

      setStep('hashing');
      // Small yield so the UI updates before the heavy computation
      await new Promise((r) => setTimeout(r, 50));

      // Hash happens inside authenticateDocument, but we advance the step here
      setStep('uploading');
      await new Promise((r) => setTimeout(r, 80));
      setStep('anchoring');

      const doc = await authenticateDocument(selectedFile, user.id);
      return doc;
    },
    onSuccess: (doc) => {
      setResult(doc);
      setStep(doc.status === 'anchored' ? 'done' : 'error');
      qc.invalidateQueries({ queryKey: ['document-authentications'] });
      if (doc.status === 'anchored') {
        notify({ type: 'success', title: 'Documento autenticado', message: 'Hash ancorado na blockchain Stellar.' });
      }
    },
    onError: (err: Error) => {
      setStep('error');
      notify({ type: 'error', title: 'Falha na autenticação', message: err.message });
    },
  });

  const handleAuthenticate = () => {
    if (!selectedFile) return;
    authMutation.mutate();
  };

  const handleReset = () => {
    setSelectedFile(null);
    setStep('idle');
    setResult(null);
    authMutation.reset();
  };

  // ── Verify ──────────────────────────────────────────────────────────────────
  const handleVerify = async () => {
    if (!verifyFile) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await verifyDocument(verifyFile);
      setVerifyResult(res);
    } catch (err: any) {
      notify({ type: 'error', title: 'Verificação falhou', message: err.message });
    } finally {
      setVerifying(false);
    }
  };

  const isProcessing = step === 'hashing' || step === 'uploading' || step === 'anchoring';

  return (
    <div className="space-y-8">
      {/* Header */}
      <header>
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/18 bg-violet-500/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-300">
          <iconify-icon icon="solar:fingerprint-bold-duotone" class="text-sm" />
          Autenticação de Documentos
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-white font-bricolage sm:text-4xl">
          Imutabilidade garantida pela blockchain
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-neutral-400">
          Faça upload do documento. Geramos o hash SHA-256 no seu navegador, salvamos o arquivo com segurança e ancoramos o hash na blockchain Stellar. Para provar integridade, basta reenviar o arquivo — se o hash bater, o documento é idêntico ao original.
        </p>
      </header>

      {/* How it works */}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { icon: 'solar:upload-bold-duotone', label: 'Upload', desc: 'Seleciona o documento', color: 'text-violet-300' },
          { icon: 'solar:hashtag-bold-duotone', label: 'Hash SHA-256', desc: 'Calculado no browser', color: 'text-cyan-300' },
          { icon: 'solar:cloud-storage-bold-duotone', label: 'Armazenamento', desc: 'Salvo com segurança', color: 'text-blue-300' },
          { icon: 'solar:link-chain-bold-duotone', label: 'Blockchain', desc: 'Hash ancorado na Stellar', color: 'text-emerald-300' },
        ].map((item, i) => (
          <div key={item.label} className="relative rounded-2xl border border-white/8 bg-neutral-900/60 p-4">
            {i < 3 && (
              <div className="absolute -right-1.5 top-1/2 hidden -translate-y-1/2 sm:flex h-3 w-3 items-center justify-center">
                <iconify-icon icon="solar:arrow-right-bold" class="text-neutral-600 text-xs" />
              </div>
            )}
            <iconify-icon icon={item.icon} class={`text-2xl ${item.color}`} />
            <p className="mt-2 text-sm font-semibold text-white">{item.label}</p>
            <p className="mt-0.5 text-xs text-neutral-500">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl border border-white/8 bg-neutral-950/80 p-1.5">
        {([
          { id: 'autenticar', label: 'Autenticar documento', icon: 'solar:fingerprint-bold-duotone' },
          { id: 'historico', label: 'Histórico', icon: 'solar:clock-circle-bold-duotone' },
          { id: 'verificar', label: 'Verificar integridade', icon: 'solar:shield-check-bold-duotone' },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
              tab === t.id
                ? 'bg-violet-500/14 border border-violet-400/20 text-violet-200'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <iconify-icon icon={t.icon} class="text-base hidden sm:inline" />
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ── AUTENTICAR TAB ─────────────────────────────────────────────────── */}
        {tab === 'autenticar' && (
          <motion.div
            key="autenticar"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-5"
          >
            {/* Drop zone */}
            {!result && (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => !isProcessing && inputRef.current?.click()}
                className={`relative cursor-pointer rounded-[28px] border-2 border-dashed transition-all ${
                  dragOver
                    ? 'border-violet-400/60 bg-violet-500/8'
                    : 'border-white/12 bg-neutral-950/50 hover:border-violet-400/30 hover:bg-violet-500/4'
                } ${isProcessing ? 'pointer-events-none' : ''}`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPTED_TYPES}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFilePick(file);
                    e.target.value = '';
                  }}
                />

                <div className="flex flex-col items-center px-6 py-14 text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-[22px] border border-white/10 bg-white/[0.03] text-neutral-400">
                    <iconify-icon icon="solar:upload-bold-duotone" class="text-4xl" />
                  </div>
                  <p className="mt-5 text-lg font-semibold text-white">
                    {selectedFile ? selectedFile.name : 'Arraste o documento aqui ou clique para selecionar'}
                  </p>
                  {selectedFile ? (
                    <p className="mt-2 text-sm text-neutral-400">
                      {formatFileSize(selectedFile.size)} · {selectedFile.type || 'tipo desconhecido'}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-neutral-500">
                      PDF, Word, Excel, imagens, texto · até 50 MB
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Progress steps */}
            {isProcessing && (
              <div className="rounded-[24px] border border-violet-400/16 bg-violet-500/6 p-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/12">
                    <iconify-icon icon="svg-spinners:ring-resize" class="text-2xl text-violet-300" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-violet-200">{STEP_LABELS[step]}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {step === 'hashing' && 'O hash é gerado localmente — o arquivo não sai do navegador antes do upload.'}
                      {step === 'uploading' && 'Documento sendo salvo em armazenamento seguro e privado.'}
                      {step === 'anchoring' && 'Submetendo transação Stellar com MemoHash SHA-256 na rede testnet.'}
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex gap-2">
                  {(['hashing', 'uploading', 'anchoring'] as const).map((s) => (
                    <div
                      key={s}
                      className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                        step === s
                          ? 'bg-violet-400'
                          : ['uploading', 'anchoring'].includes(step) && s === 'hashing'
                          ? 'bg-violet-400/40'
                          : step === 'anchoring' && s === 'uploading'
                          ? 'bg-violet-400/40'
                          : 'bg-white/8'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Certificate card */}
            {result && step === 'done' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="overflow-hidden rounded-[28px] border border-emerald-400/20 bg-neutral-950"
              >
                <div className="bg-gradient-to-r from-emerald-500/10 to-violet-500/6 px-6 py-5 border-b border-white/6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-500/12 text-emerald-300">
                      <iconify-icon icon="solar:verified-check-bold-duotone" class="text-2xl" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300">Certificado de Autenticidade</p>
                      <p className="mt-0.5 text-base font-semibold text-white">{result.documentName}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-6">
                  <CertRow
                    label="Hash SHA-256"
                    value={result.sha256Hash}
                    mono
                    copyable
                    icon="solar:hashtag-bold-duotone"
                  />
                  {result.stellarTxHash && (
                    <CertRow
                      label="Transação Stellar"
                      value={result.stellarTxHash}
                      mono
                      copyable
                      icon="solar:link-chain-bold-duotone"
                      href={getStellarExplorerUrl(result.stellarTxHash, result.stellarNetwork)}
                    />
                  )}
                  <CertRow
                    label="Rede"
                    value={result.stellarNetwork === 'mainnet' ? 'Stellar Mainnet' : 'Stellar Testnet'}
                    icon="solar:global-bold-duotone"
                  />
                  <CertRow
                    label="Tamanho"
                    value={formatFileSize(result.documentSize)}
                    icon="solar:file-bold-duotone"
                  />
                  {result.anchoredAt && (
                    <CertRow
                      label="Ancorado em"
                      value={new Intl.DateTimeFormat('pt-BR', {
                        day: '2-digit', month: 'long', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                      }).format(new Date(result.anchoredAt))}
                      icon="solar:calendar-bold-duotone"
                    />
                  )}

                  <div className="rounded-2xl border border-amber-200/12 bg-amber-500/6 p-3">
                    <p className="text-[11px] leading-5 text-amber-100/80">
                      <iconify-icon icon="solar:info-circle-bold-duotone" class="mr-1.5 align-text-bottom text-sm" />
                      Para provar a integridade a qualquer momento, faça upload do mesmo arquivo na aba <strong>Verificar integridade</strong>. O hash SHA-256 deve ser idêntico ao acima.
                    </p>
                  </div>

                  <button
                    onClick={handleReset}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-neutral-300 transition hover:bg-white/[0.06]"
                  >
                    <iconify-icon icon="solar:add-circle-bold-duotone" class="text-base" />
                    Autenticar outro documento
                  </button>
                </div>
              </motion.div>
            )}

            {/* Error state */}
            {step === 'error' && result && result.status === 'error' && (
              <div className="rounded-[24px] border border-rose-400/20 bg-rose-500/6 p-6">
                <div className="flex items-start gap-3">
                  <iconify-icon icon="solar:danger-bold-duotone" class="text-2xl text-rose-300 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-rose-200">Ancoragem na blockchain falhou</p>
                    <p className="mt-1 text-xs text-neutral-400">
                      O documento foi salvo e o hash foi registrado. A ancoragem na Stellar pode ser refeita pela equipe de suporte. Hash: <span className="font-mono text-neutral-300">{truncateHash(result.sha256Hash)}</span>
                    </p>
                    <button onClick={handleReset} className="mt-3 text-xs text-rose-300 hover:underline">
                      Tentar novamente com outro arquivo
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Authenticate button */}
            {selectedFile && !isProcessing && !result && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleAuthenticate}
                  className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/12 px-6 py-3 text-sm font-semibold text-violet-200 transition hover:bg-violet-500/18"
                >
                  <iconify-icon icon="solar:fingerprint-bold-duotone" class="text-base" />
                  Autenticar e ancorar na blockchain
                </button>
                <button
                  onClick={handleReset}
                  className="text-sm text-neutral-500 hover:text-neutral-300"
                >
                  Cancelar
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* ── HISTÓRICO TAB ──────────────────────────────────────────────────── */}
        {tab === 'historico' && (
          <motion.div
            key="historico"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            {historyLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-2xl border border-white/8 bg-neutral-900/60" />
                ))}
              </div>
            ) : history.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-white/10 bg-neutral-950/40 px-6 py-20 text-center">
                <iconify-icon icon="solar:document-bold-duotone" class="text-4xl text-neutral-600" />
                <p className="mt-4 text-base font-semibold text-white">Nenhum documento autenticado ainda</p>
                <p className="mt-2 text-sm text-neutral-500">Vá para a aba <strong className="text-neutral-300">Autenticar documento</strong> e registre o primeiro.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-[28px] border border-white/8 bg-neutral-950/80">
                <div className="border-b border-white/6 px-6 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                    {history.length} documento{history.length !== 1 ? 's' : ''} autenticado{history.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <ul className="divide-y divide-white/6">
                  {history.map((doc) => (
                    <HistoryRow key={doc.id} doc={doc} />
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}

        {/* ── VERIFICAR TAB ──────────────────────────────────────────────────── */}
        {tab === 'verificar' && (
          <motion.div
            key="verificar"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-5"
          >
            <div className="rounded-[28px] border border-white/8 bg-neutral-950/80 p-6 sm:p-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Como funciona</p>
              <p className="mt-2 text-sm leading-7 text-neutral-400">
                Selecione o arquivo que deseja verificar. O hash SHA-256 será recalculado no seu navegador e comparado com os registros da blockchain. Se o hash coincidir, o documento está íntegro e não foi alterado desde a autenticação.
              </p>

              <div className="mt-6">
                <input
                  ref={verifyInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) { setVerifyFile(file); setVerifyResult(null); }
                    e.target.value = '';
                  }}
                />

                <button
                  onClick={() => verifyInputRef.current?.click()}
                  className="flex w-full items-center gap-4 rounded-2xl border border-dashed border-white/14 bg-white/[0.02] px-5 py-5 text-left transition hover:border-cyan-400/30 hover:bg-cyan-500/4"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-neutral-400">
                    <iconify-icon icon="solar:upload-minimalistic-bold-duotone" class="text-xl" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {verifyFile ? verifyFile.name : 'Selecionar arquivo para verificar'}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {verifyFile ? formatFileSize(verifyFile.size) : 'Clique para escolher o documento'}
                    </p>
                  </div>
                </button>

                {verifyFile && (
                  <button
                    onClick={handleVerify}
                    disabled={verifying}
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/22 bg-cyan-500/12 px-6 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/18 disabled:opacity-60"
                  >
                    {verifying
                      ? <iconify-icon icon="svg-spinners:ring-resize" class="text-base" />
                      : <iconify-icon icon="solar:shield-check-bold-duotone" class="text-base" />}
                    {verifying ? 'Verificando…' : 'Verificar integridade'}
                  </button>
                )}
              </div>
            </div>

            {/* Verify result */}
            <AnimatePresence>
              {verifyResult && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  {verifyResult.match ? (
                    <div className="overflow-hidden rounded-[28px] border border-emerald-400/20 bg-neutral-950">
                      <div className="flex items-center gap-4 border-b border-white/6 bg-emerald-500/8 px-6 py-5">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/24 bg-emerald-500/14 text-emerald-300">
                          <iconify-icon icon="solar:verified-check-bold-duotone" class="text-3xl" />
                        </div>
                        <div>
                          <p className="text-lg font-bold text-emerald-300 font-bricolage">Documento íntegro</p>
                          <p className="mt-0.5 text-sm text-neutral-400">O hash SHA-256 confere com o registro na blockchain. O arquivo não foi alterado.</p>
                        </div>
                      </div>
                      <div className="space-y-4 p-6">
                        <CertRow label="Hash verificado" value={verifyResult.computedHash} mono copyable icon="solar:hashtag-bold-duotone" />
                        {verifyResult.record?.stellarTxHash && (
                          <CertRow
                            label="Transação Stellar"
                            value={verifyResult.record.stellarTxHash}
                            mono
                            copyable
                            icon="solar:link-chain-bold-duotone"
                            href={getStellarExplorerUrl(verifyResult.record.stellarTxHash, verifyResult.record.stellarNetwork)}
                          />
                        )}
                        {verifyResult.record?.anchoredAt && (
                          <CertRow
                            label="Autenticado em"
                            value={new Intl.DateTimeFormat('pt-BR', {
                              day: '2-digit', month: 'long', year: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            }).format(new Date(verifyResult.record.anchoredAt))}
                            icon="solar:calendar-bold-duotone"
                          />
                        )}
                      </div>
                    </div>
                  ) : verifyResult.storedHash ? (
                    <div className="overflow-hidden rounded-[28px] border border-rose-400/20 bg-neutral-950">
                      <div className="flex items-center gap-4 border-b border-white/6 bg-rose-500/6 px-6 py-5">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-rose-400/24 bg-rose-500/12 text-rose-300">
                          <iconify-icon icon="solar:danger-bold-duotone" class="text-3xl" />
                        </div>
                        <div>
                          <p className="text-lg font-bold text-rose-300 font-bricolage">Hash não confere</p>
                          <p className="mt-0.5 text-sm text-neutral-400">O arquivo foi modificado após a autenticação ou é uma versão diferente do original registrado.</p>
                        </div>
                      </div>
                      <div className="space-y-4 p-6">
                        <CertRow label="Hash computado agora" value={verifyResult.computedHash} mono icon="solar:hashtag-bold-duotone" />
                        <CertRow label="Hash registrado" value={verifyResult.storedHash} mono icon="solar:hashtag-bold-duotone" />
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[28px] border border-amber-400/20 bg-amber-500/6 px-6 py-8 text-center">
                      <iconify-icon icon="solar:question-circle-bold-duotone" class="text-4xl text-amber-300" />
                      <p className="mt-3 text-base font-semibold text-white">Nenhum registro encontrado</p>
                      <p className="mt-2 text-sm text-neutral-400">
                        Hash computado: <span className="font-mono text-neutral-300 text-xs">{truncateHash(verifyResult.computedHash)}</span>
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">Este documento não foi autenticado nesta plataforma ou o arquivo foi alterado.</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function CertRow({
  label,
  value,
  mono = false,
  copyable = false,
  icon,
  href,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
  icon: string;
  href?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] text-neutral-400">
        <iconify-icon icon={icon} class="text-sm" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-neutral-500">{label}</p>
        <div className="mt-1 flex items-center gap-2">
          <p className={`break-all text-sm text-neutral-200 ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
          {copyable && (
            <button
              onClick={handleCopy}
              className="shrink-0 text-neutral-500 transition hover:text-neutral-200"
              title="Copiar"
            >
              <iconify-icon icon={copied ? 'solar:check-circle-bold-duotone' : 'solar:copy-bold-duotone'} class="text-base" />
            </button>
          )}
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-neutral-500 transition hover:text-emerald-300"
              title="Ver no Stellar Explorer"
            >
              <iconify-icon icon="solar:arrow-right-up-bold-duotone" class="text-base" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function HistoryRow({ doc }: { doc: DocumentAuth }) {
  const notify = useNotificationStore((s) => s.add);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!doc.storagePath) return;
    setDownloading(true);
    try {
      const url = await getDocumentDownloadUrl(doc.storagePath);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.documentName;
      a.click();
    } catch {
      notify({ type: 'error', title: 'Download falhou', message: 'Não foi possível gerar o link.' });
    } finally {
      setDownloading(false);
    }
  };

  const statusConfig = {
    anchored: { label: 'Ancorado', color: 'text-emerald-300 border-emerald-400/20 bg-emerald-500/8' },
    pending:  { label: 'Pendente', color: 'text-amber-300 border-amber-400/20 bg-amber-500/8' },
    error:    { label: 'Erro', color: 'text-rose-300 border-rose-400/20 bg-rose-500/8' },
  }[doc.status];

  return (
    <li className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3 min-w-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.03] text-neutral-400">
          <iconify-icon icon="solar:document-bold-duotone" class="text-lg" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{doc.documentName}</p>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            {formatFileSize(doc.documentSize)} ·{' '}
            {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(doc.createdAt))}
          </p>
          <p className="mt-1 font-mono text-[10px] text-neutral-600">{truncateHash(doc.sha256Hash, 20)}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusConfig.color}`}>
          {statusConfig.label}
        </span>

        {doc.stellarTxHash && (
          <a
            href={getStellarExplorerUrl(doc.stellarTxHash, doc.stellarNetwork)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-neutral-300 transition hover:bg-white/[0.06]"
          >
            <iconify-icon icon="solar:link-chain-bold-duotone" class="text-sm" />
            Stellar
          </a>
        )}

        {doc.storagePath && (
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-neutral-300 transition hover:bg-white/[0.06] disabled:opacity-60"
          >
            <iconify-icon icon={downloading ? 'svg-spinners:ring-resize' : 'solar:download-bold-duotone'} class="text-sm" />
            Baixar
          </button>
        )}
      </div>
    </li>
  );
}
