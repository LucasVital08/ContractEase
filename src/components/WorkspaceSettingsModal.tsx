import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '@/services/api';
import { useAuthStore, useNotificationStore } from '@/stores';
import { supabase } from '@/lib/supabase';

function AuditTab({ orgId, isTeam, accent }: { orgId?: string; isTeam: boolean; accent: string }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) { setLoading(false); return; }
    supabase
      .from('contract_logs')
      .select('*, profiles(name), contracts(title)')
      .in('contract_id',
        supabase.from('contracts').select('id').eq('organization_id', orgId) as any
      )
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => { setLogs(data || []); setLoading(false); });
  }, [orgId]);

  const ACTION_ICONS: Record<string, string> = {
    created: 'solar:add-circle-bold',
    signed: 'solar:pen-bold',
    completed: 'solar:check-circle-bold',
    cancelled: 'solar:close-circle-bold',
    archived: 'solar:archive-bold',
  };

  if (loading) return <div className="flex justify-center py-10"><iconify-icon icon="svg-spinners:ring-resize" class="text-2xl text-neutral-500" /></div>;

  return (
    <motion.div key="audit" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
      <h3 className="text-lg font-bold text-white">{isTeam ? 'Atividade Recente' : 'Log de Auditoria'}</h3>
      {logs.length === 0 ? (
        <div className="text-center py-10 text-neutral-500">
          <iconify-icon icon="solar:clipboard-list-bold-duotone" class="text-3xl mb-2 block" />
          <p className="text-sm">Nenhuma atividade registrada ainda.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map(log => (
            <div key={log.id} className="flex items-center gap-3 p-3 bg-white/[0.03] border border-white/5 rounded-xl">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isTeam ? 'bg-blue-500/10 text-blue-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                <iconify-icon icon={ACTION_ICONS[log.action] || 'solar:document-bold'} class="text-sm" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">
                  {log.action === 'created' ? 'Criou' : log.action === 'signed' ? 'Assinou' : log.action === 'completed' ? 'Concluiu' : log.action}{' '}
                  <span className="text-neutral-400">{log.contracts?.title || 'contrato'}</span>
                </p>
                <p className="text-[10px] text-neutral-500">por {log.profiles?.name || 'usuário'}</p>
              </div>
              <span className="text-[10px] text-neutral-600 shrink-0">
                {new Date(log.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

type Tab = 'general' | 'members' | 'permissions' | 'billing' | 'webhooks' | 'audit' | 'danger';

const BIZ_TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'general', label: 'Geral', icon: 'solar:buildings-bold-duotone' },
  { id: 'members', label: 'Membros', icon: 'solar:users-group-rounded-bold-duotone' },
  { id: 'permissions', label: 'Permissões', icon: 'solar:lock-keyhole-bold-duotone' },
  { id: 'billing', label: 'Faturamento', icon: 'solar:card-bold-duotone' },
  { id: 'webhooks', label: 'Webhooks', icon: 'solar:link-round-bold-duotone' },
  { id: 'audit', label: 'Auditoria', icon: 'solar:clipboard-list-bold-duotone' },
  { id: 'danger', label: 'Zona de Perigo', icon: 'solar:danger-triangle-bold-duotone' },
];

const TEAM_TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'general', label: 'Geral', icon: 'solar:notebook-bold-duotone' },
  { id: 'members', label: 'Colaboradores', icon: 'solar:users-group-two-rounded-bold-duotone' },
  { id: 'audit', label: 'Atividade', icon: 'solar:clipboard-list-bold-duotone' },
  { id: 'danger', label: 'Zona de Perigo', icon: 'solar:danger-triangle-bold-duotone' },
];

interface Props { onClose: () => void; }

export default function WorkspaceSettingsModal({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('general');
  const { organization, switchOrganization, user } = useAuthStore();
  const notify = useNotificationStore(s => s.add);
  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const fileRef = useRef<HTMLInputElement>(null);

  const isTeam = org?.type === 'team';
  const TABS = isTeam ? TEAM_TABS : BIZ_TABS;
  const accent = isTeam ? 'blue' : 'emerald';

  useEffect(() => {
    if (organization?.id && organization.id !== 'personal') {
      api.organization.get(organization.id)
        .then(d => { setOrg(d); setLoading(false); })
        .catch(() => setLoading(false));
    } else { setLoading(false); }
  }, [organization?.id]);

  const handleSave = async () => {
    if (!org) return;
    setSaving(true);
    try {
      await api.organization.update(org.id, { 
        name: org.name, 
        cnpj: org.cnpj || null,
        description: org.description || null 
      });
      switchOrganization({ ...organization!, name: org.name });
      notify({ type: 'success', title: 'Configurações salvas' });
    } catch (e: any) { notify({ type: 'error', title: 'Erro', message: e.message }); }
    finally { setSaving(false); }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !org?.id) return;
    try {
      const url = await api.organization.uploadLogo(org.id, file);
      setOrg({ ...org, logo_url: url });
      notify({ type: 'success', title: 'Logo atualizada' });
    } catch (e: any) { notify({ type: 'error', title: 'Erro', message: e.message }); }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !org?.id) return;
    try {
      await api.organization.inviteMember(inviteEmail, isTeam ? 'member' : inviteRole, org.id);
      setInviteEmail('');
      const data = await api.organization.get(org.id);
      setOrg(data);
      notify({ type: 'success', title: 'Convite enviado' });
    } catch (e: any) { notify({ type: 'error', title: 'Erro', message: e.message }); }
  };

  const handleDeleteWorkspace = async () => {
    if (!org?.id || !confirm('Tem certeza? Todos os dados serão perdidos permanentemente.')) return;
    try {
      const { supabase } = await import('@/lib/supabase');
      await supabase.from('organization_members').delete().eq('organization_id', org.id);
      await supabase.from('profiles').update({ organization_id: null }).eq('organization_id', org.id);
      await supabase.from('organizations').delete().eq('id', org.id);
      switchOrganization({ id: 'personal', name: 'Espaço Pessoal', plan: 'free', createdAt: '' });
      notify({ type: 'success', title: 'Workspace deletado' });
      onClose();
    } catch (e: any) { notify({ type: 'error', title: 'Erro ao deletar', message: e.message }); }
  };

  const isPersonal = !organization || organization.id === 'personal';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative z-10 bg-neutral-900 border border-white/10 rounded-3xl w-full max-w-4xl h-[80vh] max-h-[700px] flex overflow-hidden"
      >
        {/* Sidebar */}
        <div className="w-56 shrink-0 border-r border-white/5 p-4 flex flex-col">
          <div className="flex items-center gap-3 mb-6 px-2">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden ${
              isTeam ? 'bg-gradient-to-br from-blue-500 to-indigo-500' : 'bg-gradient-to-br from-emerald-500 to-cyan-500'
            }`}>
              {org?.logo_url ? <img src={org.logo_url} alt="" className="w-full h-full object-cover" /> : (organization?.name?.charAt(0) || 'W')}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">{organization?.name || 'Workspace'}</p>
              <p className={`text-[10px] font-bold uppercase ${isTeam ? 'text-blue-400' : 'text-emerald-500'}`}>
                {isTeam ? 'Grupo' : 'Organização'} • {organization?.plan || 'free'}
              </p>
            </div>
          </div>
          <nav className="space-y-0.5 flex-1">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  tab === t.id 
                    ? (isTeam ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400')
                    : t.id === 'danger' ? 'text-red-400/60 hover:text-red-400 hover:bg-red-500/5' : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}>
                <iconify-icon icon={t.icon} class="text-base" />
                {t.label}
              </button>
            ))}
          </nav>
          <button onClick={onClose} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-neutral-500 hover:text-white hover:bg-white/5 transition-colors mt-2">
            <iconify-icon icon="solar:arrow-left-bold" /> Fechar
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {isPersonal ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <iconify-icon icon="solar:buildings-bold-duotone" class="text-5xl text-neutral-600 mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">Espaço Pessoal</h3>
              <p className="text-sm text-neutral-400 max-w-xs">Crie um workspace para desbloquear estas configurações.</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-full">
              <iconify-icon icon="svg-spinners:ring-resize" class={`text-2xl ${isTeam ? 'text-blue-500' : 'text-emerald-500'}`} />
            </div>
          ) : (
            <AnimatePresence mode="wait">

              {/* ── GERAL ── */}
              {tab === 'general' && (
                <motion.div key="general" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                  <h3 className="text-lg font-bold text-white">
                    {isTeam ? 'Dados do Grupo' : 'Informações da Empresa'}
                  </h3>

                  {/* Logo + Name */}
                  <div className="flex items-start gap-5">
                    {!isTeam && (
                      <div onClick={() => fileRef.current?.click()} className="w-20 h-20 rounded-2xl bg-black/50 border-2 border-dashed border-white/10 hover:border-emerald-500/30 flex items-center justify-center cursor-pointer transition-all overflow-hidden shrink-0">
                        {org?.logo_url ? <img src={org.logo_url} alt="" className="w-full h-full object-contain p-1" /> : <iconify-icon icon="solar:gallery-add-bold-duotone" class="text-2xl text-neutral-500" />}
                      </div>
                    )}
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    <div className="flex-1 space-y-3">
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">{isTeam ? 'Nome do Grupo' : 'Nome da Empresa'}</label>
                        <input value={org?.name || ''} onChange={e => setOrg({ ...org, name: e.target.value })} placeholder={isTeam ? 'Nome do grupo' : 'Nome da empresa'} className={`w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none ${isTeam ? 'focus:border-blue-500/50' : 'focus:border-emerald-500/50'}`} />
                      </div>
                      {!isTeam && (
                        <div>
                          <label className="block text-xs text-neutral-400 mb-1">CNPJ</label>
                          <input value={org?.cnpj || ''} onChange={e => setOrg({ ...org, cnpj: e.target.value })} placeholder="00.000.000/0000-00" className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50 placeholder:text-neutral-600" />
                        </div>
                      )}
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">{isTeam ? 'Descrição do projeto' : 'Descrição'}</label>
                        <textarea value={org?.description || ''} onChange={e => setOrg({ ...org, description: e.target.value })} rows={2} placeholder={isTeam ? 'Para que serve este grupo?' : 'Sobre a empresa...'} className={`w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none resize-none placeholder:text-neutral-600 ${isTeam ? 'focus:border-blue-500/50' : 'focus:border-emerald-500/50'}`} />
                      </div>
                    </div>
                  </div>
                  <button onClick={handleSave} disabled={saving} className={`px-5 py-2.5 font-bold rounded-xl transition-colors text-sm disabled:opacity-50 flex items-center gap-2 ${isTeam ? 'bg-blue-500 text-white hover:bg-blue-400' : 'bg-emerald-500 text-black hover:bg-emerald-400'}`}>
                    {saving ? <iconify-icon icon="svg-spinners:ring-resize" /> : <iconify-icon icon="solar:check-circle-bold" />} Salvar
                  </button>
                </motion.div>
              )}

              {/* ── MEMBROS ── */}
              {tab === 'members' && (
                <motion.div key="members" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                  <h3 className="text-lg font-bold text-white">{isTeam ? 'Colaboradores' : 'Membros da Equipe'}</h3>
                  <div className="flex gap-2">
                    <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleInvite()} placeholder="email@empresa.com" className={`flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none placeholder:text-neutral-600 ${isTeam ? 'focus:border-blue-500/50' : 'focus:border-emerald-500/50'}`} />
                    {!isTeam && (
                      <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className="bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-white text-xs">
                        <option value="member">Membro</option><option value="admin">Admin</option><option value="viewer">Viewer</option>
                      </select>
                    )}
                    <button onClick={handleInvite} className={`px-4 py-2.5 font-bold rounded-xl text-sm ${isTeam ? 'bg-blue-500 text-white hover:bg-blue-400' : 'bg-emerald-500 text-black hover:bg-emerald-400'}`}>Convidar</button>
                  </div>
                  {isTeam && (
                    <div className={`bg-blue-500/5 border border-blue-500/10 rounded-xl p-3`}>
                      <p className="text-[11px] text-blue-400/80"><iconify-icon icon="solar:info-circle-bold" class="mr-1 align-middle" />Em grupos, todos os membros têm permissões iguais.</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    {(org?.organization_members || []).map((m: any) => (
                      <div key={m.id} className="flex items-center gap-3 p-3 bg-white/[0.03] border border-white/5 rounded-xl">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${isTeam ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-500'}`}>
                          {m.profiles?.name?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{m.profiles?.name || 'Sem nome'}</p>
                        </div>
                        {!isTeam && (
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${m.role === 'owner' ? 'bg-amber-500/10 text-amber-400' : 'bg-white/5 text-neutral-400'}`}>{m.role}</span>
                        )}
                      </div>
                    ))}
                    {(!org?.organization_members || org.organization_members.length === 0) && (
                      <div className="text-center py-8 bg-white/[0.02] rounded-xl border border-dashed border-white/5">
                        <iconify-icon icon="solar:users-group-rounded-bold-duotone" class="text-3xl text-neutral-600" />
                        <p className="text-xs text-neutral-500 mt-2">Apenas você por enquanto</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ── PERMISSÕES (só org) ── */}
              {tab === 'permissions' && !isTeam && (
                <motion.div key="perms" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                  <h3 className="text-lg font-bold text-white">Permissões por Cargo</h3>
                  <p className="text-sm text-neutral-400">Defina o que cada cargo pode fazer dentro do workspace.</p>
                  {(['member', 'viewer'] as const).map(role => {
                    const roleLabel = role === 'member' ? 'Membro' : 'Viewer';
                    const perms = org?.member_permissions?.[role] || {};
                    const permKeys: Record<string, string> = {
                      can_create: 'Criar contratos',
                      can_sign: 'Assinar contratos',
                      can_view_all: 'Ver todos os contratos',
                      can_delete: 'Deletar contratos',
                    };
                    return (
                      <div key={role} className="p-4 bg-white/[0.03] border border-white/5 rounded-xl space-y-3">
                        <p className="text-sm font-bold text-white">{roleLabel}</p>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(permKeys).map(([key, label]) => (
                            <label key={key} className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                              <input type="checkbox" className="accent-emerald-500 rounded"
                                checked={perms[key] ?? false}
                                onChange={e => {
                                  const updated = {
                                    ...org.member_permissions,
                                    [role]: { ...perms, [key]: e.target.checked },
                                  };
                                  setOrg({ ...org, member_permissions: updated });
                                }}
                              /> {label}
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <button type="button" onClick={async () => {
                    try {
                      await api.organization.update(org.id, { member_permissions: org.member_permissions } as any);
                      notify({ type: 'success', title: 'Permissões salvas' });
                    } catch (e: any) { notify({ type: 'error', title: 'Erro', message: e.message }); }
                  }} className="px-5 py-2.5 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 text-sm">
                    Salvar Permissões
                  </button>
                </motion.div>
              )}

              {/* ── FATURAMENTO (só org) ── */}
              {tab === 'billing' && !isTeam && (
                <motion.div key="billing" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                  <h3 className="text-lg font-bold text-white">Faturamento & Plano</h3>
                  <div className="p-5 bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 border border-emerald-500/20 rounded-2xl">
                    <div className="flex items-center justify-between">
                      <div><p className="text-xs text-neutral-400">Plano atual</p><p className="text-2xl font-bold text-white capitalize mt-1">{organization?.plan || 'Free'}</p></div>
                      <button className="px-4 py-2 bg-emerald-500 text-black font-bold rounded-xl text-xs hover:bg-emerald-400">Upgrade</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {[{ label: 'Créditos', value: user?.credits ?? 0 }, { label: 'Membros', value: org?.organization_members?.length || 1 }, { label: 'Contratos', value: 0 }].map(s => (
                      <div key={s.label} className="p-4 bg-white/[0.03] border border-white/5 rounded-xl text-center">
                        <p className="text-2xl font-bold text-white">{s.value}</p><p className="text-[10px] text-neutral-500 mt-1">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ── WEBHOOKS (só org) ── */}
              {tab === 'webhooks' && !isTeam && (
                <motion.div key="hooks" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                  <h3 className="text-lg font-bold text-white">Webhooks</h3>
                  <p className="text-sm text-neutral-400">Receba notificações HTTP em tempo real quando eventos ocorrem nos seus contratos.</p>
                  <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-2xl text-center space-y-4">
                    <iconify-icon icon="solar:bell-bing-bold-duotone" class="text-4xl text-blue-400 block mx-auto" />
                    <div>
                      <p className="text-sm font-bold text-white mb-1">Gerencie webhooks na página de Integrações</p>
                      <p className="text-xs text-neutral-400">Crie, configure, teste e monitore o histórico de entregas dos seus webhooks.</p>
                    </div>
                    <button type="button" onClick={() => { onClose(); window.location.href = '/integrations'; }}
                      className="px-5 py-2.5 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-400 text-sm flex items-center gap-2 mx-auto">
                      <iconify-icon icon="solar:arrow-right-bold" /> Ir para Integrações & API
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── AUDITORIA ── */}
              {tab === 'audit' && (
                <AuditTab orgId={org?.id} isTeam={isTeam} accent={accent} />
              )}

              {/* ── ZONA DE PERIGO ── */}
              {tab === 'danger' && (
                <motion.div key="danger" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                  <h3 className="text-lg font-bold text-red-400">Zona de Perigo</h3>
                  {!isTeam && (
                    <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-xl space-y-3">
                      <p className="text-sm font-bold text-white">Transferir Propriedade</p>
                      <p className="text-xs text-neutral-400">Transfira o controle total deste workspace para outro membro.</p>
                      <button className="px-4 py-2 bg-white/5 border border-white/10 text-white text-xs font-bold rounded-xl hover:bg-white/10">Transferir</button>
                    </div>
                  )}
                  <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl space-y-3">
                    <p className="text-sm font-bold text-red-400">Deletar {isTeam ? 'Grupo' : 'Workspace'}</p>
                    <p className="text-xs text-neutral-400">Esta ação é irreversível. Todos os dados serão perdidos.</p>
                    <button onClick={handleDeleteWorkspace} className="px-4 py-2 bg-red-500 text-white text-xs font-bold rounded-xl hover:bg-red-400">
                      Deletar Permanentemente
                    </button>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </div>
  );
}
