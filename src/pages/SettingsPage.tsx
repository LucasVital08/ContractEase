import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useAuthStore, useNotificationStore } from '@/stores';
import { api } from '@/services/api';
import { isAllowed, setAllowed, requestAccess, getAddress } from '@stellar/freighter-api';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'organization' | 'team' | 'security' | 'blockchain' | 'appearance' | 'billing'>('profile');
  const user = useAuthStore(s => s.user);
  const updateUser = useAuthStore(s => s.updateUser);
  const notify = useNotificationStore(s => s.add);

  // Organization state
  const [org, setOrg] = useState<any>(null);
  const [isLoadingOrg, setIsLoadingOrg] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');

  // Profile state
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');

  // Freighter state
  const [walletAddress, setWalletAddress] = useState<string | null>(user?.walletAddress || null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Security state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  useEffect(() => {
    if (activeTab === 'organization' || activeTab === 'team') {
      loadOrganization();
    }
  }, [activeTab]);

  useEffect(() => {
    if (user) {
      setProfileName(user.name);
      setProfileEmail(user.email);
      setWalletAddress(user.walletAddress || null);
    }
  }, [user]);

  async function loadOrganization() {
    try {
      setIsLoadingOrg(true);
      const data = await api.organization.getMyOrganization();
      setOrg(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingOrg(false);
    }
  }

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.auth.updateProfile({ name: profileName });
      updateUser({ name: profileName });
      notify({ type: 'success', title: 'Perfil atualizado com sucesso' });
    } catch (error: any) {
      notify({ type: 'error', title: 'Erro ao atualizar perfil', message: error.message });
    }
  };

  const handleOrgSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org) return;
    try {
      await api.organization.update(org.id, {
        name: org.name,
        tax_id: org.tax_id
      });
      notify({ type: 'success', title: 'Organização atualizada com sucesso' });
    } catch (error: any) {
      notify({ type: 'error', title: 'Erro ao atualizar organização', message: error.message });
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org) return;
    try {
      await api.organization.inviteMember(inviteEmail, inviteRole, org.id);
      setInviteEmail('');
      loadOrganization();
      notify({ type: 'success', title: 'Convite enviado (Membro adicionado)' });
    } catch (error: any) {
      notify({ type: 'error', title: 'Erro ao convidar', message: error.message });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await api.organization.removeMember(memberId);
      loadOrganization();
      notify({ type: 'info', title: 'Membro removido' });
    } catch (error: any) {
      notify({ type: 'error', title: 'Erro ao remover membro' });
    }
  };

  const handleConnectFreighter = async () => {
    setIsConnecting(true);
    try {
      if (!(await isAllowed())) {
        await setAllowed();
        await requestAccess();
      }
      const result = await getAddress();
      if (result?.address) {
        setWalletAddress(result.address);
        await api.auth.updateProfile({ wallet_address: result.address });
        updateUser({ walletAddress: result.address });
        notify({ type: 'success', title: 'Freighter conectada!', message: `Endereço: ${result.address.slice(0, 8)}...${result.address.slice(-8)}` });
      } else {
        notify({ type: 'error', title: 'Não foi possível obter o endereço da carteira.' });
      }
    } catch (e) {
      notify({ type: 'error', title: 'Erro ao conectar Freighter', message: 'Certifique-se de que a extensão Freighter está instalada.' });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectFreighter = () => {
    setWalletAddress(null);
    notify({ type: 'info', title: 'Carteira desconectada.' });
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingPassword(true);
    try {
      const { error } = await api.auth.updatePassword(newPassword);
      if (error) throw error;
      setNewPassword('');
      setCurrentPassword('');
      notify({ type: 'success', title: 'Senha atualizada com sucesso!' });
    } catch (error: any) {
      notify({ type: 'error', title: 'Erro ao atualizar senha', message: error.message });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h2 className="text-2xl font-bold font-bricolage text-white">Configurações do Workspace</h2>
        <p className="text-neutral-400 text-sm mt-1">Gerencie membros, permissões (RBAC) e dados da sua organização.</p>
      </div>

      <div className="flex items-center gap-6 border-b border-white/5 overflow-x-auto">
        {[
          { id: 'organization', label: 'Organização' },
          { id: 'team', label: 'Membros e Acessos (RBAC)' },
          { id: 'profile', label: 'Meu Perfil' },
          { id: 'security', label: 'Segurança' },
          { id: 'blockchain', label: 'Blockchain' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-neutral-500 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-[300px]">
        {activeTab === 'profile' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-neutral-900 border border-white/5 rounded-2xl p-6 space-y-6">
            <h3 className="text-lg font-semibold text-white">Informações Pessoais</h3>
            <form onSubmit={handleProfileSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Nome</label>
                  <input className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50" value={profileName} onChange={e => setProfileName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">E-mail</label>
                  <input disabled className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm opacity-50 cursor-not-allowed" value={profileEmail} />
                </div>
              </div>
              <button type="submit" className="px-4 py-2 bg-emerald-500 text-black font-semibold rounded-lg hover:bg-emerald-400 transition-colors">Salvar Alterações</button>
            </form>
          </motion.div>
        )}

        {activeTab === 'organization' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-neutral-900 border border-white/5 rounded-2xl p-6 space-y-6 max-w-2xl">
            <h3 className="text-lg font-semibold text-white">Detalhes da Empresa</h3>
            <form onSubmit={handleOrgSave} className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Nome da Organização</label>
                <input required value={org?.name || ''} onChange={e => setOrg({...org, name: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-1">CNPJ / Tax ID</label>
                <input required value={org?.tax_id || ''} onChange={e => setOrg({...org, tax_id: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
              </div>
              <button type="submit" className="px-4 py-2 bg-emerald-500 text-black font-semibold rounded-lg hover:bg-emerald-400 transition-colors">Salvar Alterações</button>
            </form>
          </motion.div>
        )}

        {activeTab === 'team' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Convidar Membros</h3>
              <form onSubmit={handleInvite} className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                  <label className="block text-sm text-neutral-400 mb-1">E-mail do usuário</label>
                  <input required type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="colaborador@empresa.com" className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
                </div>
                <div className="w-full md:w-64">
                  <label className="block text-sm text-neutral-400 mb-1">Nível de Acesso (RBAC)</label>
                  <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50 appearance-none">
                    <option value="admin">Administrador (Total)</option>
                    <option value="member">Membro (Cria Documentos)</option>
                    <option value="viewer">Apenas Leitura (Viewer)</option>
                  </select>
                </div>
                <button type="submit" className="w-full md:w-auto px-4 py-2.5 bg-white text-black font-semibold rounded-lg hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2">
                  <iconify-icon icon="solar:user-plus-bold" /> Convidar
                </button>
              </form>
            </div>

            <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Membros da Equipe</h3>
              <div className="space-y-3">
                {org?.organization_members?.map((member: any) => (
                  <div key={member.id} className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-black/20">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center font-bold text-xs">
                        {member.profiles?.name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{member.profiles?.name} {member.user_id === user?.id && '(Você)'}</p>
                        <p className="text-xs text-neutral-500">{member.profiles?.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] px-2 py-1 rounded bg-white/10 text-neutral-300 font-bold uppercase">{member.role}</span>
                      {member.user_id !== user?.id && (
                        <button onClick={() => handleRemoveMember(member.id)} className="text-red-400 hover:text-red-300"><iconify-icon icon="solar:trash-bin-trash-bold" /></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'security' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-neutral-900 border border-white/5 rounded-2xl p-6 space-y-6">
            <h3 className="text-lg font-semibold text-white">Alterar Senha</h3>
            <form onSubmit={handlePasswordSave} className="space-y-4 max-w-sm">
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Nova Senha</label>
                <input 
                  required 
                  type="password" 
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••" 
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50" 
                />
              </div>
              <button 
                type="submit" 
                disabled={isUpdatingPassword}
                className="px-4 py-2 border border-white/10 text-white font-semibold rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                {isUpdatingPassword ? 'Atualizando...' : 'Atualizar Senha'}
              </button>
            </form>
          </motion.div>
        )}

        {activeTab === 'blockchain' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Freighter Wallet */}
            <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-emerald-500/10 rounded-xl">
                  <iconify-icon icon="solar:wallet-bold-duotone" class="text-2xl text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Freighter Wallet</h3>
                  <p className="text-xs text-neutral-400">Conecte sua carteira Stellar para ancoragem on-chain.</p>
                </div>
              </div>

              {walletAddress ? (
                <div className="space-y-4">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                      <div>
                        <p className="text-sm font-bold text-emerald-400">Conectada</p>
                        <p className="text-xs text-neutral-400 font-mono">{walletAddress.slice(0, 12)}...{walletAddress.slice(-12)}</p>
                      </div>
                    </div>
                    <button onClick={handleDisconnectFreighter} className="text-xs text-red-400 hover:text-red-300 font-semibold border border-red-500/20 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors">
                      Desconectar
                    </button>
                  </div>
                  <div className="bg-black/30 border border-white/5 rounded-xl p-4">
                    <p className="text-xs text-neutral-500 mb-2">Endereço Público Completo</p>
                    <p className="text-xs text-white font-mono break-all">{walletAddress}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <iconify-icon icon="solar:wallet-bold-duotone" class="text-5xl text-neutral-600 mb-4" />
                  <p className="text-neutral-400 mb-4 text-sm">Nenhuma carteira conectada. Conecte para habilitar a ancoragem via Freighter.</p>
                  <button
                    onClick={handleConnectFreighter}
                    disabled={isConnecting}
                    className="bg-white text-black px-6 py-3 rounded-xl font-bold hover:bg-neutral-200 transition-colors flex items-center gap-2 mx-auto"
                  >
                    {isConnecting ? (
                      <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <iconify-icon icon="solar:link-round-bold" class="text-lg" />
                    )}
                    Conectar Freighter Wallet
                  </button>
                </div>
              )}
            </div>

            {/* Network Configuration */}
            <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Configuração de Rede</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-black/30 rounded-xl p-4 border border-emerald-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <p className="text-sm font-bold text-white">Testnet</p>
                  </div>
                  <p className="text-xs text-neutral-400">horizon-testnet.stellar.org</p>
                  <p className="text-[10px] text-emerald-400 mt-2 font-mono">Rede ativa (desenvolvimento)</p>
                </div>
                <div className="bg-black/30 rounded-xl p-4 border border-white/5 opacity-50">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-neutral-500 rounded-full" />
                    <p className="text-sm font-bold text-white">Mainnet</p>
                  </div>
                  <p className="text-xs text-neutral-400">horizon.stellar.org</p>
                  <p className="text-[10px] text-neutral-500 mt-2">Em breve (produção)</p>
                </div>
              </div>
            </div>

            {/* Auto-anchor settings */}
            <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Ancoragem Automática</h3>
              <div className="space-y-4">
                <label className="flex items-center justify-between p-4 bg-black/30 rounded-xl border border-white/5 cursor-pointer group hover:border-white/10 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-white">Ancorar ao assinar</p>
                    <p className="text-xs text-neutral-500">Registrar automaticamente o hash quando todas as partes assinarem.</p>
                  </div>
                  <div className="relative">
                    <input type="checkbox" defaultChecked className="peer sr-only" />
                    <div className="w-11 h-6 bg-neutral-700 peer-checked:bg-emerald-500 rounded-full transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full peer-checked:translate-x-5 transition-transform shadow-sm" />
                  </div>
                </label>
                <label className="flex items-center justify-between p-4 bg-black/30 rounded-xl border border-white/5 cursor-pointer group hover:border-white/10 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-white">Multi-sig (N de M)</p>
                    <p className="text-xs text-neutral-500">Exigir múltiplas assinaturas Stellar para documentos sensíveis.</p>
                  </div>
                  <div className="relative">
                    <input type="checkbox" className="peer sr-only" />
                    <div className="w-11 h-6 bg-neutral-700 peer-checked:bg-emerald-500 rounded-full transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full peer-checked:translate-x-5 transition-transform shadow-sm" />
                  </div>
                </label>
                <label className="flex items-center justify-between p-4 bg-black/30 rounded-xl border border-white/5 cursor-pointer group hover:border-white/10 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-white">Selo Temporal Automático</p>
                    <p className="text-xs text-neutral-500">Registrar automaticamente o hash do documento na Stellar após todas as assinaturas.</p>
                  </div>
                  <div className="relative">
                    <input type="checkbox" className="peer sr-only" defaultChecked />
                    <div className="w-11 h-6 bg-neutral-700 peer-checked:bg-emerald-500 rounded-full transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full peer-checked:translate-x-5 transition-transform shadow-sm" />
                  </div>
                </label>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
