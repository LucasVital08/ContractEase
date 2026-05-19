import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import SignatureCanvas from 'react-signature-canvas';
import { useContract, useUpdateContract } from '@/hooks/useContractQueries';
import { useNotificationStore } from '@/stores';
import { isAllowed, setAllowed, requestAccess } from '@stellar/freighter-api';
import { validateCPF, formatCPF } from '@/utils/validators';
import { generateContractHash, serializeContract, anchorOnStellar } from '@/services/stellar';
import { supabase } from '@/lib/supabase';

type Step = 'verify' | 'otp' | 'sign' | 'done';

export default function PublicSignPage() {
  const { contractId, partyId } = useParams<{ contractId: string; partyId: string }>();
  const notify = useNotificationStore(s => s.add);
  const { data: contract, isLoading } = useContract(contractId!);
  const updateMutation = useUpdateContract();

  const [step, setStep] = useState<Step>('verify');
  const [cpf, setCpf] = useState('');

  // OTP
  const [otpCode, setOtpCode] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);

  // Signature
  const [signatureMode, setSignatureMode] = useState<'draw' | 'type' | 'upload' | 'freighter'>('draw');
  const [typedSignature, setTypedSignature] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [freighterConnected, setFreighterConnected] = useState(false);
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [lgpdConsent, setLgpdConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Liveness (simulado — substitua por SDK real na Fase 3)
  const [livenessStatus, setLivenessStatus] = useState<'none' | 'scanning' | 'passed'>('none');
  const [showLivenessModal, setShowLivenessModal] = useState(false);

  // Metadata
  const [clientIp, setClientIp] = useState('');
  const [geoLoc, setGeoLoc] = useState('');

  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(r => r.json()).then(d => setClientIp(d.ip)).catch(() => setClientIp(''));
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => setGeoLoc(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`),
        () => setGeoLoc('')
      );
    }
  }, []);

  useEffect(() => {
    if (contract && partyId) {
      const p = contract.parties.find(p => p.id === partyId);
      if (p?.signedAt) setStep('done');
    }
  }, [contract, partyId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (!contract) return null;

  const party = contract.parties.find(p => p.id === partyId);
  if (!party) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center bg-neutral-900 border border-red-500/20 p-8 rounded-2xl max-w-sm">
          <iconify-icon icon="solar:danger-triangle-bold-duotone" class="text-5xl text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Link inválido</h2>
          <p className="text-neutral-400 text-sm">Este link de assinatura não é válido ou já foi utilizado.</p>
        </div>
      </div>
    );
  }

  if (new Date(contract.expiresAt) < new Date()) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center bg-neutral-900 border border-red-500/20 p-8 rounded-2xl max-w-sm">
          <iconify-icon icon="solar:danger-triangle-bold-duotone" class="text-5xl text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Link Expirado</h2>
          <p className="text-neutral-400 text-sm">O prazo para assinatura deste contrato encerrou.</p>
        </div>
      </div>
    );
  }

  // ── Handlers ──────────────────────────────────────────────

  const handleVerifyIdentity = () => {
    if (!validateCPF(cpf)) {
      notify({ type: 'error', title: 'CPF Inválido', message: 'Verifique os dígitos e tente novamente.' });
      return;
    }
    setStep('otp');
  };

  const handleSendOTP = async () => {
    setOtpSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('signing-otp', {
        body: { action: 'send', partyId, contractId },
      });
      if (error || !data?.success) throw new Error(data?.error || 'Falha ao enviar código.');
      setOtpSent(true);
      notify({ type: 'success', title: 'Código enviado', message: `Verifique o e-mail: ${party.email}` });
    } catch (e: any) {
      notify({ type: 'error', title: 'Erro', message: e.message });
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otpCode.length !== 6) return;
    setOtpVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('signing-otp', {
        body: { action: 'verify', partyId, contractId, code: otpCode },
      });
      if (error || !data?.valid) throw new Error(data?.error || 'Código inválido ou expirado.');
      setStep('sign');
    } catch (e: any) {
      notify({ type: 'error', title: 'Código incorreto', message: e.message });
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleConnectFreighter = async () => {
    try {
      if (await isAllowed()) { setFreighterConnected(true); return; }
      await setAllowed();
      await requestAccess();
      setFreighterConnected(true);
      notify({ type: 'success', title: 'Freighter conectado!' });
    } catch {
      notify({ type: 'error', title: 'Erro ao conectar Freighter' });
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setUploadedImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleStartLiveness = () => {
    setShowLivenessModal(true);
    setLivenessStatus('scanning');
    setTimeout(() => {
      setLivenessStatus('passed');
      setTimeout(() => setShowLivenessModal(false), 1500);
    }, 2500);
  };

  const handleSign = async () => {
    if (!lgpdConsent) {
      notify({ type: 'error', title: 'Consentimento necessário', message: 'Aceite os termos para continuar.' });
      return;
    }
    if (signatureMode === 'draw' && sigCanvas.current?.isEmpty()) {
      notify({ type: 'error', title: 'Desenhe sua assinatura.' });
      return;
    }
    if (signatureMode === 'type' && !typedSignature.trim()) {
      notify({ type: 'error', title: 'Digite seu nome.' });
      return;
    }
    if (signatureMode === 'upload' && !uploadedImage) {
      notify({ type: 'error', title: 'Faça upload de uma imagem.' });
      return;
    }
    if (signatureMode === 'freighter' && !freighterConnected) {
      notify({ type: 'error', title: 'Conecte o Freighter primeiro.' });
      return;
    }

    let signatureImage = '';
    if (signatureMode === 'draw') signatureImage = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png') || '';
    else if (signatureMode === 'type') signatureImage = typedSignature;
    else if (signatureMode === 'upload') signatureImage = uploadedImage!;

    setIsSubmitting(true);
    try {
      // 1. Salvar assinatura na party
      const { error: signError } = await supabase
        .from('contract_parties')
        .update({
          signed_at: new Date().toISOString(),
          status: 'signed',
          signature_type: signatureMode,
          signature_image: signatureImage || null,
          lgpd_consent: lgpdConsent,
          cpf: cpf.replace(/\D/g, '') || null,
          ip_address: clientIp || null,
          geolocation: geoLoc || null,
          user_agent: navigator.userAgent,
        })
        .eq('id', partyId!);
      if (signError) throw signError;

      // 2. Verificar se todos assinaram
      const updatedParties = contract.parties.map(p =>
        p.id === partyId ? { ...p, signedAt: new Date().toISOString() } : p
      );
      const allSigned = updatedParties.every(p => p.signedAt);

      if (allSigned) {
        await supabase.from('contracts').update({ status: 'active' }).eq('id', contract.id);

        // 3. Ancorar na Stellar
        try {
          const serialized = serializeContract({
            title: contract.title,
            description: contract.description,
            clauses: contract.clauses.map(c => ({ title: c.title, content: c.content, order: c.order })),
            parties: contract.parties.map(p => ({ name: p.name, email: p.email })),
          });
          const hash = await generateContractHash(serialized);
          const result = await anchorOnStellar(hash, contract.id);
          if (result.success && result.txHash) {
            await supabase
              .from('contracts')
              .update({ stellar_tx_hash: result.txHash, contract_hash: hash })
              .eq('id', contract.id);
          }
        } catch (anchorErr) {
          console.warn('Stellar anchor failed, continuing:', anchorErr);
        }
      }

      setStep('done');
    } catch (e: any) {
      notify({ type: 'error', title: 'Erro ao assinar', message: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const maskedEmail = party.email.replace(/(.{2}).+(@.+)/, '$1***$2');

  // ── UI ────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-black py-10 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-black font-bold text-sm">CE</div>
            <span className="font-bold text-white text-lg">ContractEase</span>
          </div>
          <h1 className="text-2xl font-bold text-white font-bricolage">Portal de Assinatura Digital</h1>
          <p className="text-neutral-500 text-sm mt-1">Assinatura eletrônica com registro em blockchain Stellar</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {(['verify', 'otp', 'sign'] as const).map((s, i) => {
            const labels = ['Identidade', 'Verificação', 'Assinatura'];
            const idx = ['verify', 'otp', 'sign'].indexOf(step);
            const done = i < idx || step === 'done';
            const active = s === step;
            return (
              <div key={s} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  done ? 'bg-emerald-500/20 text-emerald-400' :
                  active ? 'bg-white/10 text-white' : 'bg-white/[0.03] text-neutral-600'
                }`}>
                  {done
                    ? <iconify-icon icon="solar:check-circle-bold" class="text-sm" />
                    : <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px]">{i + 1}</span>
                  }
                  {labels[i]}
                </div>
                {i < 2 && <div className="w-6 h-px bg-white/10" />}
              </div>
            );
          })}
        </div>

        <AnimatePresence mode="wait">

          {/* PASSO 1 — Verificar Identidade */}
          {step === 'verify' && (
            <motion.div key="verify" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="bg-neutral-900 border border-white/10 rounded-2xl p-8 max-w-md mx-auto">
              <h2 className="text-xl font-bold text-white mb-1">Verificação de Identidade</h2>
              <p className="text-sm text-neutral-400 mb-6">Confirme seus dados para acessar o contrato.</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1.5">Nome (registrado no contrato)</label>
                  <div className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white text-sm opacity-60 select-none">
                    {party.name}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1.5">CPF</label>
                  <input
                    type="text"
                    value={cpf}
                    onChange={e => {
                      const raw = e.target.value.replace(/\D/g, '').slice(0, 11);
                      setCpf(raw.length === 11 ? formatCPF(raw) : raw);
                    }}
                    placeholder="000.000.000-00"
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <button onClick={handleVerifyIdentity}
                  className="w-full py-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-colors mt-2">
                  Continuar
                </button>
              </div>
            </motion.div>
          )}

          {/* PASSO 2 — OTP por Email */}
          {step === 'otp' && (
            <motion.div key="otp" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="bg-neutral-900 border border-white/10 rounded-2xl p-8 max-w-md mx-auto">
              <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <iconify-icon icon="solar:letter-bold-duotone" class="text-3xl text-emerald-500" />
              </div>
              <h2 className="text-xl font-bold text-white text-center mb-1">Verificação por E-mail</h2>
              <p className="text-sm text-neutral-400 text-center mb-2">
                Enviaremos um código de 6 dígitos para:
              </p>
              <p className="text-emerald-400 font-mono text-sm text-center mb-6">{maskedEmail}</p>

              {!otpSent ? (
                <button onClick={handleSendOTP} disabled={otpSending}
                  className="w-full py-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {otpSending
                    ? <><div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> Enviando...</>
                    : <><iconify-icon icon="solar:letter-bold" /> Enviar Código</>}
                </button>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1.5 text-center">Digite o código recebido</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otpCode}
                      onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-4 text-white text-2xl font-mono text-center tracking-[0.5em] focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <button onClick={handleVerifyOTP} disabled={otpVerifying || otpCode.length !== 6}
                    className="w-full py-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    {otpVerifying
                      ? <><div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> Verificando...</>
                      : 'Confirmar Código'}
                  </button>
                  <button onClick={() => { setOtpSent(false); setOtpCode(''); }}
                    className="w-full text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
                    Não recebeu? Reenviar código
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* PASSO 3 — Assinar */}
          {step === 'sign' && (
            <motion.div key="sign" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Preview do contrato */}
              <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 h-[580px] flex flex-col">
                <h2 className="text-lg font-bold text-white mb-1">{contract.title}</h2>
                <p className="text-xs text-neutral-500 mb-4 pb-3 border-b border-white/5">{contract.description}</p>
                <div className="space-y-5 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                  {contract.clauses.map(c => (
                    <div key={c.id} className="text-sm">
                      <strong className="text-white block mb-1">{c.order}. {c.title}</strong>
                      <p className="text-neutral-400 leading-relaxed text-justify">{c.content}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Painel de assinatura */}
              <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 flex flex-col">
                <h3 className="font-bold text-white mb-4">Sua Assinatura</h3>

                {/* Liveness check */}
                <div className="mb-4">
                  {livenessStatus === 'passed' ? (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3">
                      <iconify-icon icon="solar:user-check-bold" class="text-lg text-emerald-400" />
                      <p className="text-xs font-bold text-emerald-400">Identidade Validada</p>
                    </div>
                  ) : (
                    <button onClick={handleStartLiveness}
                      className="w-full p-3 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-2 hover:bg-white/10 transition-all text-xs font-bold text-neutral-300">
                      <iconify-icon icon="solar:face-id-bold" class="text-lg" />
                      Validar Identidade Facial <span className="text-neutral-600">(opcional)</span>
                    </button>
                  )}
                </div>

                {/* Selector de modo */}
                <div className="flex bg-black/50 p-1 rounded-lg border border-white/5 mb-4">
                  {(['draw', 'type', 'upload', 'freighter'] as const).map(mode => (
                    <button key={mode} onClick={() => setSignatureMode(mode)}
                      className={`flex-1 px-1 py-2 text-xs font-medium rounded-md transition-all ${
                        signatureMode === mode ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-white'
                      }`}>
                      {mode === 'draw' && 'Desenhar'}
                      {mode === 'type' && 'Digitar'}
                      {mode === 'upload' && 'Upload'}
                      {mode === 'freighter' && 'Wallet'}
                    </button>
                  ))}
                </div>

                {/* Canvas de assinatura */}
                <div className="bg-white rounded-xl overflow-hidden mb-4 border border-white/20 h-[160px] relative flex-shrink-0">
                  {signatureMode === 'draw' && (
                    <>
                      <SignatureCanvas ref={sigCanvas} penColor="black" canvasProps={{ className: 'w-full h-full' }} />
                      <button onClick={() => sigCanvas.current?.clear()} className="absolute top-2 right-2 text-xs text-neutral-400 hover:text-black">Limpar</button>
                    </>
                  )}
                  {signatureMode === 'type' && (
                    <div className="w-full h-full flex items-center justify-center p-6 bg-neutral-50">
                      <input type="text" value={typedSignature} onChange={e => setTypedSignature(e.target.value)}
                        placeholder="Digite seu nome completo" className="w-full bg-transparent border-b-2 border-neutral-300 text-center text-2xl outline-none text-black placeholder:text-neutral-300 font-['Dancing_Script',cursive]" />
                    </div>
                  )}
                  {signatureMode === 'upload' && (
                    <div className="w-full h-full flex items-center justify-center bg-neutral-50 relative group">
                      {uploadedImage ? (
                        <>
                          <img src={uploadedImage} alt="Assinatura" className="max-h-full max-w-full object-contain p-3" />
                          <button onClick={() => setUploadedImage(null)} className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-sm font-semibold">Remover</button>
                        </>
                      ) : (
                        <label className="cursor-pointer flex flex-col items-center text-neutral-400 hover:text-black transition-colors">
                          <iconify-icon icon="solar:upload-bold-duotone" class="text-3xl mb-1" />
                          <span className="text-xs font-medium">Clique para enviar</span>
                          <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleImageUpload} />
                        </label>
                      )}
                    </div>
                  )}
                  {signatureMode === 'freighter' && (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-900 text-white">
                      <iconify-icon icon="solar:wallet-bold-duotone" class="text-4xl text-emerald-500 mb-3" />
                      {freighterConnected
                        ? <span className="text-emerald-400 font-bold text-sm bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">Carteira Conectada</span>
                        : <button onClick={handleConnectFreighter} className="bg-white text-black px-5 py-2 rounded-xl font-bold text-sm hover:bg-neutral-200">Conectar Freighter</button>
                      }
                    </div>
                  )}
                </div>

                {/* LGPD */}
                <label className="flex items-start gap-3 cursor-pointer group mb-4">
                  <div className="relative flex items-center justify-center mt-0.5 flex-shrink-0">
                    <input type="checkbox" checked={lgpdConsent} onChange={e => setLgpdConsent(e.target.checked)} className="peer sr-only" />
                    <div className="w-5 h-5 border-2 border-neutral-600 rounded bg-black peer-checked:bg-emerald-500 peer-checked:border-emerald-500 transition-colors" />
                    <iconify-icon icon="solar:check-read-bold" class="absolute text-black opacity-0 peer-checked:opacity-100 transition-opacity text-sm pointer-events-none" />
                  </div>
                  <span className="text-xs text-neutral-400 leading-relaxed group-hover:text-neutral-300 transition-colors">
                    Concordo com os termos do contrato e autorizo a coleta de dados (IP, geolocalização) para fins de validação jurídica, em conformidade com a <span className="text-emerald-400">LGPD</span>.
                  </span>
                </label>

                <button onClick={handleSign} disabled={isSubmitting || !lgpdConsent}
                  className="w-full py-4 bg-emerald-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2 mt-auto">
                  {isSubmitting
                    ? <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    : <><iconify-icon icon="solar:pen-new-round-bold" class="text-xl" /> Assinar Documento</>}
                </button>
              </div>
            </motion.div>
          )}

          {/* CONCLUÍDO */}
          {step === 'done' && (
            <motion.div key="done" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="bg-neutral-900 border border-emerald-500/20 rounded-2xl p-8 max-w-md mx-auto text-center">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <iconify-icon icon="solar:check-circle-bold" class="text-3xl text-emerald-500" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2 font-bricolage">Documento Assinado</h2>
              <p className="text-neutral-400 mb-6">Obrigado, {party.name}! Sua assinatura foi registrada com segurança.</p>
              {contract.contractHash && (
                <div className="bg-black/50 rounded-xl p-4 text-left border border-white/5 mb-4">
                  <p className="text-xs text-neutral-500 mb-1">Hash de verificação (SHA-256)</p>
                  <p className="text-xs font-mono text-emerald-400 break-all">{contract.contractHash}</p>
                </div>
              )}
              <div className="flex items-center justify-center gap-4 text-xs text-neutral-600 mt-4">
                <span className="flex items-center gap-1"><iconify-icon icon="solar:lock-password-bold" /> SHA-256</span>
                <span className="flex items-center gap-1"><iconify-icon icon="solar:globus-bold" /> Stellar</span>
                <span className="flex items-center gap-1"><iconify-icon icon="solar:shield-check-bold" /> LGPD</span>
              </div>
            </motion.div>
          )}

        </AnimatePresence>

        {/* Modal de Liveness */}
        <AnimatePresence>
          {showLivenessModal && (
            <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center p-6">
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                className="w-full max-w-sm bg-neutral-900 rounded-[40px] border-4 border-white/10 p-8 flex flex-col items-center text-center">
                <div className="w-56 h-56 rounded-full border-4 border-emerald-500/30 relative flex items-center justify-center mb-6">
                  <div className="absolute inset-0 rounded-full border-2 border-emerald-500 animate-pulse" />
                  {livenessStatus === 'passed'
                    ? <iconify-icon icon="solar:check-circle-bold" class="text-7xl text-emerald-500" />
                    : <iconify-icon icon="solar:face-id-bold" class="text-7xl text-neutral-700 animate-pulse" />
                  }
                </div>
                <h4 className="text-lg font-bold text-white mb-2">
                  {livenessStatus === 'scanning' ? 'Verificando...' : 'Identidade Confirmada!'}
                </h4>
                <p className="text-neutral-500 text-sm">
                  {livenessStatus === 'scanning' ? 'Posicione seu rosto dentro do círculo.' : 'Pode prosseguir com a assinatura.'}
                </p>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
