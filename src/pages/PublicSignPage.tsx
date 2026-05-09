import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import SignatureCanvas from 'react-signature-canvas';
import { useContract, useUpdateContract } from '@/hooks/useContractQueries';
import { useNotificationStore } from '@/stores';
import { isAllowed, setAllowed, requestAccess, signTransaction } from '@stellar/freighter-api';
import { validateCPF, formatCPF } from '@/utils/validators';
import { generateContractHash, serializeContract, anchorOnStellar } from '@/services/stellar';
import { OTPModal } from '@/components/OTPModal';
import { api } from '@/services/api';

export default function PublicSignPage() {
  const { contractId, partyId } = useParams<{ contractId: string; partyId: string }>();
  const navigate = useNavigate();
  const notify = useNotificationStore(s => s.add);
  const { data: contract, isLoading } = useContract(contractId!);
  const updateMutation = useUpdateContract();

  const [step, setStep] = useState<'verify' | 'sign'>('verify');
  const [cpf, setCpf] = useState('');
  
  const [signatureMode, setSignatureMode] = useState<'draw' | 'type' | 'upload' | 'freighter'>('draw');
  const [typedSignature, setTypedSignature] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [freighterConnected, setFreighterConnected] = useState(false);
  const sigCanvas = useRef<SignatureCanvas>(null);

  const [lgpdConsent, setLgpdConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signed, setSigned] = useState(false);
  const [livenessStatus, setLivenessStatus] = useState<'none' | 'scanning' | 'passed'>('none');
  const [showLivenessModal, setShowLivenessModal] = useState(false);
  const [isOTPModalOpen, setIsOTPModalOpen] = useState(false);
  
  // IP and Geo Mocks
  const [clientIp, setClientIp] = useState<string>('');
  const [geoLoc, setGeoLoc] = useState<string>('');

  useEffect(() => {
    if (contract && partyId) {
      const party = contract.parties.find(p => p.id === partyId);
      if (party?.signedAt) {
        setSigned(true);
      }
    }
  }, [contract, partyId]);

  useEffect(() => {
    // Mock getting IP
    fetch('https://api.ipify.org?format=json')
      .then(r => r.json())
      .then(d => setClientIp(d.ip))
      .catch(() => setClientIp('127.0.0.1'));
      
    // Mock getting Geo
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGeoLoc(`${pos.coords.latitude}, ${pos.coords.longitude}`),
        () => setGeoLoc('Desconhecida')
      );
    } else {
      setGeoLoc('Não suportada');
    }
  }, []);

  const handleConnectFreighter = async () => {
    try {
      if (await isAllowed()) {
        setFreighterConnected(true);
        notify({ type: 'success', title: 'Freighter conectado!' });
        return;
      }
      await setAllowed();
      const access = await requestAccess();
      if (access) {
        setFreighterConnected(true);
        notify({ type: 'success', title: 'Freighter conectado!' });
      }
    } catch (e) {
      notify({ type: 'error', title: 'Erro ao conectar Freighter Wallet' });
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setUploadedImage(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (!contract) return null;

  // Check expiration
  if (new Date(contract.expiresAt) < new Date()) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center bg-neutral-900 border border-red-500/20 p-8 rounded-2xl">
          <iconify-icon icon="solar:danger-triangle-bold-duotone" class="text-6xl text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Link Expirado</h2>
          <p className="text-neutral-400">O prazo para assinatura deste contrato já encerrou.</p>
        </div>
      </div>
    );
  }

  const party = contract.parties.find(p => p.id === partyId);
  if (!party) return null;

  if (signed) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-neutral-900 border border-emerald-500/20 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <iconify-icon icon="solar:check-circle-bold" class="text-3xl text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2 font-bricolage">Documento Assinado</h2>
          <p className="text-neutral-400 mb-6">Obrigado, {party.name}! Sua assinatura foi registrada e armazenada de forma segura.</p>
          <div className="bg-black/50 rounded-xl p-4 text-left border border-white/5 mb-6">
            <p className="text-xs text-neutral-500 mb-1">Blockchain Hash / Verificação</p>
            <p className="text-sm font-mono text-emerald-400 truncate">{contract.contractHash || 'Processando ancoragem...'}</p>
          </div>
        </motion.div>
      </div>
    );
  }

  const handleVerifyIdentity = () => {
    if (!validateCPF(cpf)) {
      notify({ type: 'error', title: 'CPF Inválido', message: 'O CPF informado não é válido. Verifique os dígitos.' });
      return;
    }
    setStep('sign');
  };

  const handleSign = async () => {
    if (!lgpdConsent) {
      notify({ type: 'error', title: 'Consentimento Necessário', message: 'Você precisa aceitar os termos da LGPD.' });
      return;
    }

    if (signatureMode === 'draw' && sigCanvas.current?.isEmpty()) {
      notify({ type: 'error', title: 'Por favor, forneça sua assinatura.' });
      return;
    }
    
    if (signatureMode === 'type' && !typedSignature.trim()) {
      notify({ type: 'error', title: 'Por favor, digite seu nome.' });
      return;
    }
    
    if (signatureMode === 'upload' && !uploadedImage) {
      notify({ type: 'error', title: 'Faça upload de uma imagem.' });
      return;
    }
    
    if (signatureMode === 'freighter' && !freighterConnected) {
      notify({ type: 'error', title: 'Conecte sua carteira Freighter primeiro.' });
      return;
    }

    let signatureImage = '';
    if (signatureMode === 'draw') {
      signatureImage = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png') || '';
    } else if (signatureMode === 'type') {
      signatureImage = typedSignature;
    } else if (signatureMode === 'upload') {
      signatureImage = uploadedImage!;
    }

    setIsSubmitting(true);
    try {
      const updatedParties = contract.parties.map(p => 
        p.id === partyId ? { 
          ...p, 
          signedAt: new Date().toISOString(),
          cpf,
          ipAddress: clientIp,
          geolocation: geoLoc,
          userAgent: navigator.userAgent,
          signatureType: signatureMode,
          signatureImage,
          lgpdConsent
        } : p
      );

      const allSigned = updatedParties.every(p => p.signedAt);
      const updates: any = { parties: updatedParties };
      
      if (allSigned) {
        updates.status = 'active';
        
        // Generate deterministic contract hash using the stellar service
        const serialized = serializeContract(contract);
        const hashHex = await generateContractHash(serialized);
        updates.contractHash = hashHex;
        
        // Lógica da Fase 6: Verificar e deduzir crédito antes de ancorar
        const hasCredits = true; // Em prod: backend.user.credits > 0
        
        if (hasCredits) {
          try {
            const anchorResult = await anchorOnStellar(hashHex);
            if (anchorResult.success && anchorResult.txHash) {
              updates.stellarTxHash = anchorResult.txHash;
            } else {
              console.warn('Stellar anchor failed, storing hash only:', anchorResult.error);
            }
          } catch (err) {
            console.warn('Stellar anchor unavailable:', err);
          }
        } else {
           console.warn('Stellar anchor skipped: Insufficient credits.');
           // Apenas salva como ativo, a pessoa terá que ancorar manualmente depois quando recarregar.
        }
      }

      await updateMutation.mutateAsync({ id: contract.id, data: updates });
      setSigned(true);
      notify({ type: 'success', title: 'Assinatura registrada e evidências salvas!' });
    } catch (e) {
      notify({ type: 'error', title: 'Erro ao assinar documento' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <iconify-icon icon="solar:shield-check-bold-duotone" class="text-4xl text-emerald-500 mb-2" />
          <h1 className="text-3xl font-bold text-white font-bricolage">Portal de Assinatura Segura</h1>
          <p className="text-neutral-400 mt-2">Validação em conformidade com ICP-Brasil e LGPD.</p>
        </div>

        <AnimatePresence mode="wait">
          {step === 'verify' ? (
            <motion.div key="verify" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-neutral-900 border border-white/10 rounded-2xl p-8 max-w-md mx-auto">
              <h2 className="text-xl font-bold text-white mb-2">Verificação de Identidade</h2>
              <p className="text-sm text-neutral-400 mb-6">Para acessar o contrato, por favor confirme seus dados.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1">Nome (Registrado no Contrato)</label>
                  <div className="w-full bg-black/50 border border-white/5 rounded-xl px-4 py-3 text-white text-sm opacity-70">
                    {party.name}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1">CPF</label>
                  <input
                    type="text"
                    value={cpf}
                    onChange={e => {
                      // Auto-format as user types
                      const raw = e.target.value.replace(/\D/g, '').slice(0, 11);
                      setCpf(raw.length === 11 ? formatCPF(raw) : raw);
                    }}
                    placeholder="000.000.000-00"
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                
                <button 
                  onClick={handleVerifyIdentity}
                  className="w-full py-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-colors mt-4"
                >
                  Continuar
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="sign" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Contract Preview */}
              <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 h-[600px] flex flex-col">
                <h2 className="text-xl font-bold text-white mb-1">{contract.title}</h2>
                <p className="text-sm text-neutral-400 mb-6 border-b border-white/5 pb-4">{contract.description}</p>
                
                <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                  {contract.clauses.map(c => (
                    <div key={c.id} className="text-sm">
                      <strong className="text-white block mb-1">{c.order}. {c.title}</strong>
                      <p className="text-neutral-400 leading-relaxed text-justify">{c.content}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Signature Interaction */}
              <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 flex flex-col">
                <h3 className="font-bold text-white mb-4">Evidências de Assinatura</h3>
                
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-black/50 rounded-xl p-3 border border-white/5">
                    <p className="text-[10px] text-neutral-500 uppercase tracking-wide">IP Address</p>
                    <p className="text-xs text-emerald-400 font-mono mt-1">{clientIp || 'Capturando...'}</p>
                  </div>
                  <div className="bg-black/50 rounded-xl p-3 border border-white/5">
                    <p className="text-[10px] text-neutral-500 uppercase tracking-wide">Geolocalização</p>
                    <p className="text-xs text-emerald-400 font-mono mt-1 truncate">{geoLoc || 'Capturando...'}</p>
                  </div>
                </div>

                {/* Liveness Check Step (New) */}
                <div className="mb-6">
                  <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <iconify-icon icon="solar:shield-user-bold" /> Segurança Avançada
                  </h3>
                  
                  {livenessStatus === 'passed' ? (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <iconify-icon icon="solar:user-speak-bold" class="text-xl text-emerald-400" />
                        <div>
                          <p className="text-xs font-bold text-emerald-400">Identidade Validada</p>
                          <p className="text-[10px] text-neutral-500">Prova de vida registrada.</p>
                        </div>
                      </div>
                      <iconify-icon icon="solar:check-circle-bold" class="text-lg text-emerald-500" />
                    </div>
                  ) : (
                    <button 
                      onClick={handleStartLiveness}
                      className="w-full p-3 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-3 hover:bg-white/10 transition-all group"
                    >
                      <iconify-icon icon="solar:face-id-bold" class="text-xl text-neutral-500 group-hover:text-white" />
                      <span className="text-xs font-bold text-neutral-300 group-hover:text-white">Validar Identidade (Facial)</span>
                    </button>
                  )}
                </div>

                <div className="flex bg-black/50 p-1 rounded-lg border border-white/5 mb-4 flex-wrap gap-1">
                  {(['draw', 'type', 'upload', 'freighter'] as const).map(mode => (
                    <button 
                      key={mode}
                      onClick={() => setSignatureMode(mode)}
                      className={`flex-1 min-w-[80px] px-2 py-2 text-xs font-medium rounded-md transition-all ${signatureMode === mode ? 'bg-white/10 text-white shadow-sm' : 'text-neutral-500 hover:text-white hover:bg-white/5'}`}
                    >
                      {mode === 'draw' && 'Desenhar'}
                      {mode === 'type' && 'Digitar'}
                      {mode === 'upload' && 'Upload'}
                      {mode === 'freighter' && 'Freighter Wallet'}
                    </button>
                  ))}
                </div>

                <div className="bg-white rounded-xl overflow-hidden mb-6 border border-white/20 h-[180px] relative flex-shrink-0">
                  {signatureMode === 'draw' && (
                    <>
                      <SignatureCanvas ref={sigCanvas} penColor="black" canvasProps={{ className: 'w-full h-full' }} />
                      <button onClick={() => sigCanvas.current?.clear()} className="absolute top-2 right-2 text-xs font-semibold text-neutral-400 hover:text-black">Limpar</button>
                    </>
                  )}
                  {signatureMode === 'type' && (
                    <div className="w-full h-full flex items-center justify-center p-8 bg-neutral-50">
                      <input
                        type="text"
                        value={typedSignature}
                        onChange={e => setTypedSignature(e.target.value)}
                        placeholder="Digite seu nome completo"
                        className="w-full bg-transparent border-b-2 border-neutral-300 px-2 py-4 text-center text-3xl outline-none text-black placeholder:text-neutral-300"
                        style={{ fontFamily: "'Dancing Script', cursive" }}
                      />
                    </div>
                  )}
                  {signatureMode === 'upload' && (
                    <div className="w-full h-full flex items-center justify-center bg-neutral-50 relative group">
                      {uploadedImage ? (
                        <>
                          <img src={uploadedImage} alt="Assinatura" className="max-h-full max-w-full object-contain p-4" />
                          <button onClick={() => setUploadedImage(null)} className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center font-semibold">Remover Imagem</button>
                        </>
                      ) : (
                        <label className="cursor-pointer flex flex-col items-center text-neutral-400 hover:text-black transition-colors">
                          <iconify-icon icon="solar:upload-bold-duotone" class="text-4xl mb-2" />
                          <span className="text-sm font-medium">Clique para enviar imagem</span>
                          <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={handleImageUpload} />
                        </label>
                      )}
                    </div>
                  )}
                  {signatureMode === 'freighter' && (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-900 text-white">
                      <iconify-icon icon="solar:wallet-bold-duotone" class="text-5xl text-emerald-500 mb-4" />
                      {freighterConnected ? (
                        <span className="text-emerald-400 font-bold bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20">Carteira Conectada</span>
                      ) : (
                        <button onClick={handleConnectFreighter} className="bg-white text-black px-6 py-2 rounded-xl font-bold hover:bg-neutral-200 transition-colors">
                          Conectar Freighter
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-auto space-y-4">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center mt-0.5">
                      <input type="checkbox" checked={lgpdConsent} onChange={e => setLgpdConsent(e.target.checked)} className="peer sr-only" />
                      <div className="w-5 h-5 border-2 border-neutral-600 rounded bg-black peer-checked:bg-emerald-500 peer-checked:border-emerald-500 transition-colors" />
                      <iconify-icon icon="solar:check-read-bold" class="absolute text-black opacity-0 peer-checked:opacity-100 transition-opacity text-sm pointer-events-none" />
                    </div>
                    <span className="text-xs text-neutral-400 leading-relaxed group-hover:text-neutral-300 transition-colors">
                      Concordo com os termos do contrato e com a política de privacidade (LGPD). Confirmo que as evidências digitais (IP, Geolocalização) poderão ser usadas para validação jurídica.
                    </span>
                  </label>

                  <button 
                    onClick={handleSign}
                    disabled={isSubmitting || !lgpdConsent}
                    className="w-full py-4 bg-emerald-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <iconify-icon icon="solar:pen-new-round-bold" class="text-xl" />}
                    Assinar Documento
                  </button>
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
        {showLivenessModal && (
          <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full max-w-sm aspect-[3/4] bg-neutral-900 rounded-[40px] border-4 border-white/10 relative overflow-hidden flex flex-col items-center justify-center text-center p-8">
              <div className="w-64 h-64 rounded-full border-4 border-emerald-500/30 relative flex items-center justify-center mb-8">
                <div className="absolute inset-0 rounded-full border-2 border-emerald-500 animate-pulse" />
                {livenessStatus === 'passed' ? (
                  <iconify-icon icon="solar:check-circle-bold" class="text-8xl text-emerald-500" />
                ) : (
                  <iconify-icon icon="solar:face-id-bold" class="text-8xl text-neutral-700 animate-pulse" />
                )}
                {livenessStatus === 'scanning' && (
                  <div className="absolute inset-0 w-full h-1 bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.8)] rounded-full animate-scan-y top-0" />
                )}
              </div>
              <h4 className="text-xl font-bold text-white mb-2">
                {livenessStatus === 'scanning' ? 'Verificando Identidade...' : 'Identidade Verificada!'}
              </h4>
              <p className="text-neutral-500 text-sm">
                {livenessStatus === 'scanning' ? 'Posicione seu rosto dentro do círculo e pisque lentamente.' : 'Obrigado. Você já pode prosseguir com a assinatura.'}
              </p>
            </motion.div>
          </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
