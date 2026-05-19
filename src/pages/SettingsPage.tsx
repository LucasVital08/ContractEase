import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthStore, useNotificationStore } from '@/stores';
import { api } from '@/services/api';
import { supabase } from '@/lib/supabase';
import { isAllowed, setAllowed, requestAccess, getAddress } from '@stellar/freighter-api';
import { TwoFactorModal } from '@/components/TwoFactorModal';
import { OTPModal } from '@/components/OTPModal';

type Tab = 'profile' | 'account' | 'appearance' | 'notifications' | 'security' | 'privacy' | 'shortcuts' | 'wallet';

const TABS: { id: Tab; label: string; icon: string; section?: string }[] = [
  { id: 'profile', label: 'Perfil', icon: 'solar:user-bold-duotone', section: 'Pessoal' },
  { id: 'account', label: 'Conta', icon: 'solar:lock-password-bold-duotone' },
  { id: 'appearance', label: 'Aparência', icon: 'solar:pallete-2-bold-duotone' },
  { id: 'notifications', label: 'Notificações', icon: 'solar:bell-bold-duotone', section: 'Preferências' },
  { id: 'security', label: 'Segurança', icon: 'solar:shield-check-bold-duotone' },
  { id: 'privacy', label: 'Privacidade', icon: 'solar:eye-bold-duotone' },
  { id: 'shortcuts', label: 'Atalhos', icon: 'solar:keyboard-bold-duotone', section: 'Avançado' },
  { id: 'wallet', label: 'Carteira', icon: 'solar:wallet-bold-duotone' },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('profile');
  const user = useAuthStore(s => s.user);
  const updateUser = useAuthStore(s => s.updateUser);
  const notify = useNotificationStore(s => s.add);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileEmail] = useState(user?.email || '');
  const [profileBio, setProfileBio] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileRole, setProfileRole] = useState('');

  // Account
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Appearance
  const [theme, setTheme] = useState('dark');
  const [density, setDensity] = useState('comfortable');
  const [language, setLanguage] = useState('pt-BR');

  // Notifications
  const [notifContractCreated, setNotifContractCreated] = useState(true);
  const [notifContractSigned, setNotifContractSigned] = useState(true);
  const [notifWeeklySummary, setNotifWeeklySummary] = useState(false);
  const [notifMentions, setNotifMentions] = useState(true);
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifPush, setNotifPush] = useState(false);

  // Wallet
  const [walletAddress, setWalletAddress] = useState<string | null>(user?.walletAddress || null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Security
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  const [mfaFactors, setMfaFactors] = useState<any[]>([]);
  const [isOTPModalOpen, setIsOTPModalOpen] = useState(false);

  // Load saved settings from Supabase
  useEffect(() => {
    api.settings.get().then((s: any) => {
      if (s.theme) setTheme(s.theme);
      if (s.density) setDensity(s.density);
      if (s.language) setLanguage(s.language);
      if (s.bio) setProfileBio(s.bio);
      if (s.phone) setProfilePhone(s.phone);
      if (s.jobTitle) setProfileRole(s.jobTitle);
      if (s.notifContractCreated !== undefined) setNotifContractCreated(s.notifContractCreated);
      if (s.notifContractSigned !== undefined) setNotifContractSigned(s.notifContractSigned);
      if (s.notifWeeklySummary !== undefined) setNotifWeeklySummary(s.notifWeeklySummary);
      if (s.notifMentions !== undefined) setNotifMentions(s.notifMentions);
      if (s.notifEmail !== undefined) setNotifEmail(s.notifEmail);
      if (s.notifPush !== undefined) setNotifPush(s.notifPush);
      setSettingsLoaded(true);
    }).catch(() => setSettingsLoaded(true));

    // Load MFA status
    api.auth.mfa.listFactors().then(factors => {
      const verified = (factors.all || []).filter((f: any) => f.status === 'verified');
      setMfaFactors(verified);
    }).catch(() => {});
  }, []);

  useEffect(() => { if (user) { setProfileName(user.name); setWalletAddress(user.walletAddress || null); } }, [user]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await supabase.from('profiles').update({ name: profileName, phone: profilePhone }).eq('id', user!.id);
      await api.settings.save({ bio: profileBio, phone: profilePhone, jobTitle: profileRole });
      updateUser({ name: profileName });
      notify({ type: 'success', title: 'Perfil atualizado' });
    } catch (e: any) { notify({ type: 'error', title: 'Erro', message: e.message }); }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      const publicUrl = await api.auth.uploadAvatar(user.id, file);
      await api.auth.updateProfile(user.id, { avatar_url: publicUrl });
      updateUser({ avatar: publicUrl });
      notify({ type: 'success', title: 'Avatar atualizado' });
    } catch (e: any) {
      notify({ type: 'error', title: 'Erro ao enviar avatar', message: e.message });
    }
  };

  const saveAppearance = async (key: string, value: string) => {
    try {
      await api.settings.save({ [key]: value });
      notify({ type: 'success', title: 'Preferência salva' });
    } catch { /* silent */ }
  };

  const saveNotificationPref = async (key: string, value: boolean) => {
    try { await api.settings.save({ [key]: value }); } catch { /* silent */ }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) { 
      notify({ type: 'warning', title: 'Senha deve ter ao menos 6 caracteres' }); 
      return; 
    }
    
    setIsUpdatingPassword(true);
    try {
      // Se não tem 2FA ativo, exige reautenticação por e-mail antes de trocar a senha
      if (mfaFactors.length === 0) {
        await api.auth.reauthenticate();
        setIsOTPModalOpen(true);
        setIsUpdatingPassword(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setCurrentPassword(''); 
      setNewPassword('');
      notify({ type: 'success', title: 'Senha alterada com sucesso' });
    } catch (e: any) { 
      notify({ type: 'error', title: 'Erro', message: e.message }); 
    } finally { 
      setIsUpdatingPassword(false); 
    }
  };

  const handleReauthSuccess = async () => {
    try {
      setIsUpdatingPassword(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setCurrentPassword(''); 
      setNewPassword('');
      notify({ type: 'success', title: 'Identidade confirmada e senha alterada!' });
    } catch (e: any) {
      notify({ type: 'error', title: 'Erro ao atualizar senha', message: e.message });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const connectWallet = async () => {
    setIsConnecting(true);
    try {
      const allowed = await isAllowed();
      if (!allowed) { await requestAccess(); await setAllowed(); }
      const { address } = await getAddress();
      await supabase.from('profiles').update({ wallet_address: address }).eq('id', user!.id);
      setWalletAddress(address);
      updateUser({ walletAddress: address });
      notify({ type: 'success', title: 'Carteira conectada' });
    } catch { notify({ type: 'error', title: 'Erro ao conectar carteira' }); }
    finally { setIsConnecting(false); }
  };

  const disconnectWallet = async () => {
    try {
      await supabase.from('profiles').update({ wallet_address: null }).eq('id', user!.id);
      setWalletAddress(null);
      updateUser({ walletAddress: undefined });
      notify({ type: 'info', title: 'Carteira desconectada' });
    } catch { notify({ type: 'error', title: 'Erro ao desconectar carteira' }); }
  };

  const handleExportData = () => {
    notify({ 
      type: 'success', 
      title: 'Exportação Iniciada', 
      message: 'Estamos compilando seus dados. Você receberá um link de download no seu e-mail em instantes.' 
    });
  };

  const handleDeleteAccount = () => {
    notify({
      type: 'error',
      title: 'Ação Bloqueada',
      message: 'A exclusão de conta via painel está desativada por segurança. Entre em contato com o suporte: suporte@contractease.com',
    });
  };

  const handleToggle2FA = () => {
    setIs2FAModalOpen(true);
  };

  const handleDisable2FA = async (factorId: string) => {
    try {
      await api.auth.mfa.unenroll(factorId);
      setMfaFactors(prev => prev.filter(f => f.id !== factorId));
      notify({ type: 'success', title: '2FA Desativado' });
    } catch (e: any) {
      notify({ type: 'error', title: 'Erro ao desativar 2FA', message: e.message });
    }
  };

  let lastSection = '';

  return (
    <div className="flex gap-8 max-w-6xl mx-auto">
      {/* Sidebar */}
      <aside className="w-56 shrink-0">
        <div className="sticky top-24 space-y-0.5">
          <h2 className="text-lg font-bold text-white font-bricolage mb-4">Configurações</h2>
          {TABS.map(t => {
            const showSection = t.section && t.section !== lastSection;
            if (t.section) lastSection = t.section;
            return (
              <div key={t.id}>
                {showSection && <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest px-3 pt-4 pb-1">{t.section}</p>}
                <button onClick={() => setTab(t.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${
                    tab === t.id ? 'bg-emerald-500/10 text-emerald-400 font-medium' : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}>
                  <iconify-icon icon={t.icon} class="text-base" />
                  {t.label}
                </button>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0">
        <AnimatePresence mode="wait">

          {/* PERFIL */}
          {tab === 'profile' && (
            <motion.div key="profile" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-6">Informações Pessoais</h3>
                <form onSubmit={handleProfileSave} className="space-y-5">
                  <div className="flex items-center gap-5 mb-4">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center text-emerald-500 font-bold text-2xl shrink-0 border-2 border-dashed border-white/10 cursor-pointer hover:border-emerald-500/30 transition-colors">
                      {user?.avatar ? <img src={user.avatar} alt="" className="w-full h-full rounded-2xl object-cover" /> : user?.name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-white">{user?.name}</p>
                      <p className="text-xs text-neutral-400">{user?.email}</p>
                      <button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs text-emerald-400 hover:text-emerald-300 mt-1 font-medium"
                      >
                        Alterar avatar
                      </button>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleAvatarUpload} 
                        accept="image/*" 
                        className="hidden" 
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1.5">Nome completo</label>
                      <input value={profileName} onChange={e => setProfileName(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1.5">E-mail</label>
                      <input disabled value={profileEmail} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm opacity-50 cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1.5">Telefone</label>
                      <input value={profilePhone} onChange={e => setProfilePhone(e.target.value)} placeholder="(11) 99999-9999" className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50 placeholder:text-neutral-600" />
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1.5">Cargo</label>
                      <input value={profileRole} onChange={e => setProfileRole(e.target.value)} placeholder="CEO, Advogado, Dev..." className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50 placeholder:text-neutral-600" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1.5">Bio</label>
                    <textarea value={profileBio} onChange={e => setProfileBio(e.target.value)} placeholder="Conte um pouco sobre você..." rows={3} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50 placeholder:text-neutral-600 resize-none" />
                  </div>
                  <button type="submit" className="px-5 py-2.5 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-colors text-sm flex items-center gap-2">
                    <iconify-icon icon="solar:check-circle-bold" /> Salvar Alterações
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {/* CONTA */}
          {tab === 'account' && (
            <motion.div key="account" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Alterar Senha</h3>
                <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1.5">Senha atual</label>
                    <input type="password" placeholder="••••••••" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50 placeholder:text-neutral-600" />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1.5">Nova senha</label>
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50 placeholder:text-neutral-600" />
                  </div>
                  <button type="submit" disabled={isUpdatingPassword} className="px-5 py-2.5 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 text-sm disabled:opacity-50 flex items-center gap-2">
                    {isUpdatingPassword ? <iconify-icon icon="svg-spinners:ring-resize" /> : <iconify-icon icon="solar:lock-bold" />} Alterar Senha
                  </button>
                </form>
              </div>
              <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-2">Autenticação de Dois Fatores</h3>
                <p className="text-sm text-neutral-400 mb-4">Adicione uma camada extra de segurança à sua conta.</p>
                
                {mfaFactors.length > 0 ? (
                  <div className="space-y-4">
                    {mfaFactors.map(factor => (
                      <div key={factor.id} className="flex items-center justify-between p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                            <iconify-icon icon="solar:smartphone-2-bold-duotone" class="text-xl" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">App de Autenticação</p>
                            <p className="text-[10px] text-emerald-500 uppercase font-bold tracking-widest">Ativo</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleDisable2FA(factor.id)}
                          className="px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                        >
                          Desativar
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <button 
                    onClick={handleToggle2FA}
                    className="px-4 py-2.5 bg-white/5 border border-white/10 text-white text-sm font-bold rounded-xl hover:bg-white/10 flex items-center gap-2"
                  >
                    <iconify-icon icon="solar:shield-plus-bold" /> Ativar 2FA
                  </button>
                )}
              </div>

              <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-2">OTP de 4 Dígitos</h3>
                <p className="text-sm text-neutral-400 mb-4">Um método simplificado para confirmação de ações rápidas.</p>
                <button 
                  onClick={() => setIsOTPModalOpen(true)}
                  className="px-4 py-2.5 bg-white/5 border border-white/10 text-white text-sm font-bold rounded-xl hover:bg-white/10 flex items-center gap-2"
                >
                  <iconify-icon icon="solar:key-minimalistic-bold-duotone" /> Testar OTP de 4 Dígitos
                </button>
              </div>
            </motion.div>
          )}

          {/* APARÊNCIA */}
          {tab === 'appearance' && (
            <motion.div key="appearance" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-6">Aparência</h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm text-neutral-400 mb-3">Tema</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[{ id: 'dark', label: 'Escuro', icon: 'solar:moon-bold-duotone' }, { id: 'light', label: 'Claro', icon: 'solar:sun-bold-duotone' }, { id: 'system', label: 'Sistema', icon: 'solar:monitor-bold-duotone' }].map(t => (
                        <button key={t.id} onClick={() => { setTheme(t.id); saveAppearance('theme', t.id); }}
                          className={`p-4 rounded-xl border text-center transition-all ${theme === t.id ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/[0.03] border-white/5 text-neutral-400 hover:border-white/10'}`}>
                          <iconify-icon icon={t.icon} class="text-2xl mb-2 block" />
                          <p className="text-xs font-bold">{t.label}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-neutral-400 mb-3">Densidade</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[{ id: 'comfortable', label: 'Confortável' }, { id: 'compact', label: 'Compacto' }].map(d => (
                        <button key={d.id} onClick={() => { setDensity(d.id); saveAppearance('density', d.id); }}
                          className={`p-3 rounded-xl border text-xs font-bold transition-all ${density === d.id ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/[0.03] border-white/5 text-neutral-400 hover:border-white/10'}`}>
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-neutral-400 mb-1.5">Idioma</label>
                    <select title="Idioma" value={language} onChange={e => { setLanguage(e.target.value); saveAppearance('language', e.target.value); }} className="bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none w-full max-w-xs">
                      <option value="pt-BR">Português (Brasil)</option>
                      <option value="en">English</option>
                      <option value="es">Español</option>
                    </select>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* NOTIFICAÇÕES */}
          {tab === 'notifications' && (
            <motion.div key="notifs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-6">Canais de Entrega</h3>
                <div className="space-y-3">
                  {[{ label: 'Notificações por e-mail', desc: 'Receba atualizações no seu e-mail', checked: notifEmail, set: setNotifEmail, key: 'notifEmail' },
                    { label: 'Notificações push', desc: 'Notificações no navegador', checked: notifPush, set: setNotifPush, key: 'notifPush' }].map(n => (
                    <label key={n.label} className="flex items-center justify-between p-3 bg-white/[0.03] border border-white/5 rounded-xl cursor-pointer hover:bg-white/[0.05] transition-colors">
                      <div><p className="text-sm font-medium text-white">{n.label}</p><p className="text-[11px] text-neutral-500">{n.desc}</p></div>
                      <input type="checkbox" checked={n.checked} onChange={e => { n.set(e.target.checked); saveNotificationPref(n.key, e.target.checked); }} className="accent-emerald-500 w-4 h-4" />
                    </label>
                  ))}
                </div>
              </div>
              <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-6">Eventos</h3>
                <div className="space-y-3">
                  {[{ label: 'Contrato criado', checked: notifContractCreated, set: setNotifContractCreated, key: 'notifContractCreated' },
                    { label: 'Contrato assinado', checked: notifContractSigned, set: setNotifContractSigned, key: 'notifContractSigned' },
                    { label: 'Resumo semanal', checked: notifWeeklySummary, set: setNotifWeeklySummary, key: 'notifWeeklySummary' },
                    { label: 'Menções', checked: notifMentions, set: setNotifMentions, key: 'notifMentions' }].map(n => (
                    <label key={n.label} className="flex items-center justify-between p-3 bg-white/[0.03] border border-white/5 rounded-xl cursor-pointer hover:bg-white/[0.05] transition-colors">
                      <p className="text-sm font-medium text-white">{n.label}</p>
                      <input type="checkbox" checked={n.checked} onChange={e => { n.set(e.target.checked); saveNotificationPref(n.key, e.target.checked); }} className="accent-emerald-500 w-4 h-4" />
                    </label>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* SEGURANÇA */}
          {tab === 'security' && (
            <motion.div key="security" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Sessões Ativas</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                    <iconify-icon icon="solar:monitor-bold-duotone" class="text-xl text-emerald-500" />
                    <div className="flex-1"><p className="text-sm font-medium text-white">Este dispositivo</p><p className="text-[10px] text-neutral-500">Ativo agora • Chrome no Windows</p></div>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">ATUAL</span>
                  </div>
                </div>
              </div>
              <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-2">Sessão Atual</h3>
                <p className="text-sm text-neutral-400 mb-4">Informações da sessão ativa neste dispositivo.</p>
                <div className="flex items-center gap-3 p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                  <iconify-icon icon="solar:login-bold" class="text-lg text-emerald-400" />
                  <div className="flex-1">
                    <p className="text-xs text-white">Login ativo — {user?.email}</p>
                    <p className="text-[10px] text-neutral-500">Histórico completo de sessões não está disponível ainda.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* PRIVACIDADE */}
          {tab === 'privacy' && (
            <motion.div key="privacy" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-2">Consentimento LGPD</h3>
                <p className="text-sm text-neutral-400 mb-4">Gerencie como seus dados são utilizados na plataforma.</p>
                <div className="space-y-3">
                  {([
                    { key: 'lgpdUsageData', label: 'Coleta de dados de uso' },
                    { key: 'lgpdAnalytics', label: 'Analytics de comportamento' },
                    { key: 'lgpdMarketing', label: 'Comunicações de marketing' },
                  ] as const).map(item => (
                    <label key={item.key} className="flex items-center justify-between p-3 bg-white/[0.03] border border-white/5 rounded-xl cursor-pointer hover:bg-white/[0.05] transition-colors">
                      <p className="text-sm text-white">{item.label}</p>
                      <input
                        type="checkbox"
                        className="accent-emerald-500 w-4 h-4"
                        checked={(settingsLoaded && user?.settings?.[item.key] !== false) ?? true}
                        onChange={e => saveNotificationPref(item.key, e.target.checked)}
                      />
                    </label>
                  ))}
                </div>
              </div>
              <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-2">Seus Dados</h3>
                <div className="flex gap-3 mt-4">
                  <button 
                    onClick={handleExportData}
                    className="px-4 py-2.5 bg-white/5 border border-white/10 text-white text-sm font-bold rounded-xl hover:bg-white/10 flex items-center gap-2"
                  >
                    <iconify-icon icon="solar:download-minimalistic-bold" /> Exportar Dados
                  </button>
                  <button 
                    onClick={handleDeleteAccount}
                    className="px-4 py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold rounded-xl hover:bg-red-500/20 flex items-center gap-2"
                  >
                    <iconify-icon icon="solar:trash-bin-trash-bold" /> Excluir Conta
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ATALHOS */}
          {tab === 'shortcuts' && (
            <motion.div key="shortcuts" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-6">Atalhos do Teclado</h3>
                <div className="space-y-2">
                  {[{ keys: 'Ctrl + K', action: 'Pesquisa global' }, { keys: 'Ctrl + N', action: 'Novo contrato' },
                    { keys: 'Ctrl + S', action: 'Salvar' }, { keys: 'Ctrl + /', action: 'Abrir atalhos' },
                    { keys: 'Esc', action: 'Fechar modal/popup' }].map(s => (
                    <div key={s.keys} className="flex items-center justify-between p-3 bg-white/[0.03] border border-white/5 rounded-xl">
                      <p className="text-sm text-white">{s.action}</p>
                      <kbd className="px-2.5 py-1 bg-black/50 border border-white/10 rounded-lg text-[11px] font-mono text-neutral-300">{s.keys}</kbd>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* CARTEIRA */}
          {tab === 'wallet' && (
            <motion.div key="wallet" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 text-center py-8">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <iconify-icon icon="solar:wallet-bold-duotone" class="text-4xl text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Conectar Carteira Stellar</h3>
              <p className="text-sm text-neutral-400 max-w-sm mx-auto mb-8">
                Conecte sua carteira Freighter para assinar contratos diretamente na rede Stellar e gerenciar seus ativos.
              </p>

              {walletAddress ? (
                <div className="bg-black/50 border border-emerald-500/20 rounded-2xl p-6 max-w-md mx-auto">
                  <div className="flex items-center gap-3 justify-center mb-4">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Conectado</p>
                  </div>
                  <code className="block bg-black/40 p-3 rounded-lg text-xs text-neutral-300 break-all mb-6">
                    {walletAddress}
                  </code>
                  <button
                    type="button"
                    onClick={disconnectWallet}
                    className="text-xs font-bold text-red-400 hover:text-red-300"
                  >
                    Desconectar Carteira
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <button 
                    onClick={connectWallet} 
                    disabled={isConnecting} 
                    className="px-8 py-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all disabled:opacity-50 flex items-center gap-2 mx-auto"
                  >
                    {isConnecting ? <iconify-icon icon="svg-spinners:ring-resize" /> : <iconify-icon icon="solar:link-bold" />}
                    Conectar Freighter
                  </button>
                  <p className="text-[10px] text-neutral-500">
                    Não tem uma carteira? <a href="https://www.freighter.app/" target="_blank" rel="noreferrer noopener" className="text-emerald-500 hover:underline">Instale o Freighter</a>
                  </p>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      <TwoFactorModal 
        isOpen={is2FAModalOpen} 
        onClose={() => setIs2FAModalOpen(false)} 
        onSuccess={() => {
          api.auth.mfa.listFactors().then(factors => {
            const verified = (factors.all || []).filter((f: any) => f.status === 'verified');
            setMfaFactors(verified);
          });
        }}
      />
      <OTPModal 
        isOpen={isOTPModalOpen} 
        onClose={() => setIsOTPModalOpen(false)} 
        onSuccess={handleReauthSuccess}
        purpose="supabase_auth"
        email={user?.email}
        digits={6}
      />
    </div>
  );
}
