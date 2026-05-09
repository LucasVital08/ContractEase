import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '@/services/api';
import { useNotificationStore } from '@/stores';

interface Props {
  orgId: string;
  orgName: string;
  type: 'business' | 'team';
  onComplete: () => void;
  onClose: () => void;
}

const BUSINESS_STEPS = [
  { id: 'info', label: 'Empresa', icon: 'solar:buildings-bold-duotone' },
  { id: 'brand', label: 'Marca', icon: 'solar:palette-bold-duotone' },
  { id: 'team', label: 'Equipe', icon: 'solar:users-group-rounded-bold-duotone' },
];

const TEAM_STEPS = [
  { id: 'info', label: 'Projeto', icon: 'solar:notebook-bold-duotone' },
  { id: 'team', label: 'Colaboradores', icon: 'solar:users-group-two-rounded-bold-duotone' },
];

export default function WorkspaceSetupWizard({ orgId, orgName, type, onComplete, onClose }: Props) {
  const STEPS = type === 'business' ? BUSINESS_STEPS : TEAM_STEPS;

  const [step, setStep] = useState(0);
  const [name, setName] = useState(orgName);
  const [cnpj, setCnpj] = useState('');
  const [description, setDescription] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [invites, setInvites] = useState<{ email: string; role: string }[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [isSaving, setIsSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const notify = useNotificationStore(s => s.add);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const addInvite = () => {
    if (!inviteEmail.trim()) return;
    if (invites.some(i => i.email === inviteEmail)) return;
    setInvites([...invites, { email: inviteEmail, role: inviteRole }]);
    setInviteEmail('');
  };

  const removeInvite = (email: string) => {
    setInvites(invites.filter(i => i.email !== email));
  };

  const handleFinish = async () => {
    setIsSaving(true);
    try {
      await api.organization.update(orgId, { name, cnpj: cnpj || null });

      if (logoFile) {
        await api.organization.uploadLogo(orgId, logoFile);
      }

      for (const invite of invites) {
        try {
          await api.organization.inviteMember(invite.email, invite.role, orgId);
        } catch { /* skip failed invites */ }
      }

      notify({ type: 'success', title: 'Workspace configurado!', message: `${name} está pronto para uso.` });
      onComplete();
    } catch (error: any) {
      notify({ type: 'error', title: 'Erro ao configurar', message: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const nextStep = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else handleFinish();
  };

  const prevStep = () => {
    if (step > 0) setStep(step - 1);
  };

  // Determine current step ID
  const currentStepId = STEPS[step].id;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 30 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative z-10 bg-neutral-900 border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden"
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                type === 'business'
                  ? 'bg-emerald-500/20 text-emerald-500'
                  : 'bg-blue-500/20 text-blue-500'
              }`}>
                <iconify-icon icon={type === 'business' ? 'solar:buildings-bold-duotone' : 'solar:users-group-two-rounded-bold-duotone'} class="text-2xl" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white font-bricolage">
                  {type === 'business' ? 'Nova Organização' : 'Novo Grupo'}
                </h2>
                <p className="text-xs text-neutral-400">Passo {step + 1} de {STEPS.length}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors">
              <iconify-icon icon="solar:close-circle-bold" class="text-2xl" />
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-1 mb-6">
            {STEPS.map((_s, i) => (
              <div key={i} className={`flex-1 h-1 rounded-full transition-all duration-500 ${
                i <= step
                  ? (type === 'business' ? 'bg-emerald-500' : 'bg-blue-500')
                  : 'bg-white/10'
              }`} />
            ))}
          </div>

          {/* Step labels */}
          <div className="flex justify-between mb-4">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => i <= step && setStep(i)}
                className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${
                  i === step
                    ? (type === 'business' ? 'text-emerald-400' : 'text-blue-400')
                    : i < step ? 'text-neutral-400 cursor-pointer' : 'text-neutral-600'
                }`}
              >
                <iconify-icon icon={s.icon} class="text-sm" />
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-8 pb-4 min-h-[280px]">
          <AnimatePresence mode="wait">

            {/* ─── BUSINESS: Company Info ─────────────────────── */}
            {currentStepId === 'info' && type === 'business' && (
              <motion.div key="biz-info" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div>
                  <label className="block text-sm text-neutral-400 mb-1.5 font-medium">Nome da Empresa</label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ex: Stellar Global Rails"
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50 placeholder:text-neutral-600 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-1.5 font-medium">CNPJ</label>
                  <input
                    value={cnpj}
                    onChange={e => setCnpj(e.target.value)}
                    placeholder="00.000.000/0000-00"
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50 placeholder:text-neutral-600 transition-colors"
                  />
                </div>
                <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3">
                  <p className="text-[11px] text-emerald-400/80">
                    <iconify-icon icon="solar:info-circle-bold" class="mr-1 align-middle" />
                    O CNPJ e nome aparecerão nos contratos e documentos gerados pelo workspace.
                  </p>
                </div>
              </motion.div>
            )}

            {/* ─── TEAM: Project Info ─────────────────────── */}
            {currentStepId === 'info' && type === 'team' && (
              <motion.div key="team-info" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div>
                  <label className="block text-sm text-neutral-400 mb-1.5 font-medium">Nome do Grupo / Projeto</label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ex: Projeto Alpha, Equipe Hackathon..."
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500/50 placeholder:text-neutral-600 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-1.5 font-medium">Descrição (opcional)</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Para que serve este grupo?"
                    rows={3}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500/50 placeholder:text-neutral-600 transition-colors resize-none"
                  />
                </div>
                <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-3">
                  <p className="text-[11px] text-blue-400/80">
                    <iconify-icon icon="solar:info-circle-bold" class="mr-1 align-middle" />
                    Grupos são espaços simplificados para colaboração pontual. Todos os membros têm acesso igualitário.
                  </p>
                </div>
              </motion.div>
            )}

            {/* ─── BUSINESS: Logo/Brand ─────────────────────── */}
            {currentStepId === 'brand' && (
              <motion.div key="brand" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <label className="block text-sm text-neutral-400 mb-1.5 font-medium">Logo da Empresa</label>
                <div className="flex flex-col items-center gap-4">
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="w-28 h-28 rounded-2xl bg-black/50 border-2 border-dashed border-white/10 hover:border-emerald-500/30 flex items-center justify-center cursor-pointer transition-all group overflow-hidden"
                  >
                    {logoPreview ? (
                      <img src={logoPreview} alt="Preview" className="w-full h-full object-contain bg-white/5 p-2" />
                    ) : (
                      <div className="text-center">
                        <iconify-icon icon="solar:gallery-add-bold-duotone" class="text-3xl text-neutral-500 group-hover:text-emerald-500 transition-colors" />
                        <p className="text-[10px] text-neutral-500 mt-1">Clique para enviar</p>
                      </div>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
                  <p className="text-[10px] text-neutral-500 text-center">PNG, JPG ou SVG. Máximo 2MB.</p>
                </div>

                {logoPreview && (
                  <button
                    onClick={() => { setLogoPreview(null); setLogoFile(null); }}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 mx-auto"
                  >
                    <iconify-icon icon="solar:trash-bin-trash-bold" />
                    Remover logo
                  </button>
                )}

                <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3 mt-2">
                  <p className="text-[11px] text-emerald-400/80">
                    <iconify-icon icon="solar:info-circle-bold" class="mr-1 align-middle" />
                    A logo será exibida no cabeçalho dos contratos e na barra lateral.
                  </p>
                </div>
              </motion.div>
            )}

            {/* ─── SHARED: Team Invites ─────────────────────── */}
            {currentStepId === 'team' && (
              <motion.div key="invites" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <label className="block text-sm text-neutral-400 mb-1.5 font-medium">
                  {type === 'business' ? 'Convidar membros da equipe' : 'Convidar colaboradores'}
                </label>
                <div className="flex gap-2">
                  <input
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addInvite())}
                    placeholder="email@exemplo.com"
                    className={`flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none placeholder:text-neutral-600 ${
                      type === 'business' ? 'focus:border-emerald-500/50' : 'focus:border-blue-500/50'
                    }`}
                  />
                  {type === 'business' && (
                    <select
                      value={inviteRole}
                      onChange={e => setInviteRole(e.target.value)}
                      className="bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-white text-xs focus:outline-none"
                    >
                      <option value="member">Membro</option>
                      <option value="admin">Admin</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  )}
                  <button
                    onClick={addInvite}
                    className={`px-3 py-2.5 font-bold rounded-xl transition-colors text-sm ${
                      type === 'business'
                        ? 'bg-emerald-500 text-black hover:bg-emerald-400'
                        : 'bg-blue-500 text-white hover:bg-blue-400'
                    }`}
                  >
                    <iconify-icon icon="solar:add-circle-bold" />
                  </button>
                </div>

                {invites.length > 0 ? (
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {invites.map(inv => (
                      <div key={inv.email} className="flex items-center gap-3 p-2.5 bg-white/5 rounded-xl">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          type === 'business' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'
                        }`}>
                          <iconify-icon icon="solar:user-plus-bold" class="text-xs" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white truncate">{inv.email}</p>
                          {type === 'business' && (
                            <p className="text-[10px] text-neutral-500 uppercase font-bold">{inv.role}</p>
                          )}
                        </div>
                        <button onClick={() => removeInvite(inv.email)} className="text-neutral-500 hover:text-red-400 transition-colors">
                          <iconify-icon icon="solar:close-circle-bold" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-white/[0.02] rounded-xl border border-dashed border-white/5">
                    <iconify-icon icon={type === 'business' ? 'solar:users-group-rounded-bold-duotone' : 'solar:users-group-two-rounded-bold-duotone'} class="text-3xl text-neutral-600" />
                    <p className="text-xs text-neutral-500 mt-2">Nenhum convite adicionado</p>
                    <p className="text-[10px] text-neutral-600 mt-0.5">Você pode convidar pessoas depois nas configurações</p>
                  </div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-white/5 flex items-center justify-between">
          <button
            onClick={step === 0 ? onClose : prevStep}
            className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors font-medium"
          >
            {step === 0 ? 'Cancelar' : 'Voltar'}
          </button>
          <button
            onClick={nextStep}
            disabled={(currentStepId === 'info' && !name.trim()) || isSaving}
            className={`px-6 py-2.5 font-bold rounded-xl transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
              type === 'business'
                ? 'bg-emerald-500 text-black hover:bg-emerald-400'
                : 'bg-blue-500 text-white hover:bg-blue-400'
            }`}
          >
            {isSaving ? (
              <>
                <iconify-icon icon="svg-spinners:ring-resize" />
                Salvando...
              </>
            ) : step === STEPS.length - 1 ? (
              <>
                <iconify-icon icon="solar:check-circle-bold" />
                Finalizar
              </>
            ) : (
              <>
                Próximo
                <iconify-icon icon="solar:arrow-right-bold" />
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
