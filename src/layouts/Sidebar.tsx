import { NavLink, Link } from 'react-router-dom';
import { useUIStore, useAuthStore, useNotificationStore } from '@/stores';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { api } from '@/services/api';
import contracteaseLogo from '@/assets/contractease-logo.svg';

const WorkspaceSetupWizard = lazy(() => import('@/components/WorkspaceSetupWizard'));
const WorkspaceSettingsModal = lazy(() => import('@/components/WorkspaceSettingsModal'));

const NAV_ITEMS = [
  // Business Items - Core
  { to: '/dashboard', icon: 'solar:widget-5-bold-duotone', label: 'Perfil', description: 'identidade e visão geral', profile: 'business', section: 'core' },

  // Meus Contratos
  { to: '/contracts', icon: 'solar:folder-with-files-bold-duotone', label: 'Meus Contratos', description: 'documentos e contratos inteligentes', profile: 'business', section: 'core' },

  // Business Items - Actions
  { to: '/contracts/new', icon: 'solar:add-circle-bold-duotone', label: 'Criar Contrato', description: 'abrir um novo fluxo contratual', profile: 'business', section: 'actions' },
  { to: '/templates', icon: 'solar:copy-bold-duotone', label: 'Biblioteca', description: 'modelos prontos para acelerar', profile: 'business', section: 'actions' },
  { to: '/opportunities', icon: 'solar:bolt-circle-bold-duotone', label: 'Feed de oportunidades', description: 'mercado, demanda e match', profile: 'business', section: 'market' },
  { to: '/partners', icon: 'solar:users-group-rounded-bold-duotone', label: 'Parceiros', description: 'sua rede no ContractEase', profile: 'business', section: 'market' },
  { to: '/affiliates', icon: 'solar:share-bold-duotone', label: 'Afiliados', description: 'compartilhe e ganhe em cada contrato', profile: 'business', section: 'market' },

  // Business Items - Analytics / Financeiro
  { to: '/wallet', icon: 'solar:wallet-2-bold-duotone', label: 'Carteira', description: 'saldo on-chain e depósitos via anchor', profile: 'business', section: 'analytics' },
  { to: '/finance', icon: 'solar:card-bold-duotone', label: 'Financeiro', description: 'receita, créditos e saldo', profile: 'business', section: 'analytics' },
  { to: '/analytics', icon: 'solar:chart-2-bold-duotone', label: 'Desempenho', description: 'indicadores e leitura de tração', profile: 'business', section: 'analytics' },


  // Developer Items
  { to: '/integrations', icon: 'solar:plug-bold-duotone', label: 'Integrações & API', description: 'entradas, webhooks e conexão', profile: 'developer', section: 'developer' },
  { to: '/verify', icon: 'solar:shield-check-bold-duotone', label: 'Verificação Blockchain', description: 'provas, hashes e trilha técnica', profile: 'developer', section: 'developer' },
];

const ADMIN_ITEMS = [
  { to: '/admin', icon: 'solar:server-square-bold-duotone', label: 'Super-Admin' },
];

const SECTION_STYLES: Record<string, {
  activeCard: string;
  activeRail: string;
  activeIcon: string;
}> = {
  core: {
    activeCard: 'border-emerald-400/18 bg-[linear-gradient(90deg,rgba(16,185,129,0.16),rgba(52,211,153,0.08),transparent)] text-white shadow-[0_10px_30px_rgba(16,185,129,0.08)]',
    activeRail: 'bg-gradient-to-b from-emerald-300 to-teal-300',
    activeIcon: 'border-emerald-400/16 bg-emerald-500/12 text-emerald-300',
  },
  contracts: {
    activeCard: 'border-violet-400/18 bg-[linear-gradient(90deg,rgba(139,92,246,0.16),rgba(168,85,247,0.08),transparent)] text-white shadow-[0_10px_30px_rgba(139,92,246,0.08)]',
    activeRail: 'bg-gradient-to-b from-violet-300 to-purple-300',
    activeIcon: 'border-violet-400/16 bg-violet-500/12 text-violet-300',
  },
  actions: {
    activeCard: 'border-cyan-400/18 bg-[linear-gradient(90deg,rgba(6,182,212,0.16),rgba(59,130,246,0.08),transparent)] text-white shadow-[0_10px_30px_rgba(6,182,212,0.08)]',
    activeRail: 'bg-gradient-to-b from-cyan-300 to-blue-300',
    activeIcon: 'border-cyan-400/16 bg-cyan-500/12 text-cyan-300',
  },
  analytics: {
    activeCard: 'border-amber-400/18 bg-[linear-gradient(90deg,rgba(245,158,11,0.16),rgba(249,115,22,0.08),transparent)] text-white shadow-[0_10px_30px_rgba(245,158,11,0.08)]',
    activeRail: 'bg-gradient-to-b from-amber-300 to-orange-300',
    activeIcon: 'border-amber-400/16 bg-amber-500/12 text-amber-300',
  },
  developer: {
    activeCard: 'border-fuchsia-400/18 bg-[linear-gradient(90deg,rgba(217,70,239,0.16),rgba(168,85,247,0.08),transparent)] text-white shadow-[0_10px_30px_rgba(217,70,239,0.08)]',
    activeRail: 'bg-gradient-to-b from-fuchsia-300 to-violet-300',
    activeIcon: 'border-fuchsia-400/16 bg-fuchsia-500/12 text-fuchsia-300',
  },
};


export default function Sidebar() {
  const { sidebarCollapsed, toggleCollapse } = useUIStore();
  const { user, organization, activeProfile, switchOrganization } = useAuthStore();
  const addNotification = useNotificationStore(state => state.add);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [isLibraryExpanded, setIsLibraryExpanded] = useState(true);
  const [showCreateFlow, setShowCreateFlow] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [allOrgs, setAllOrgs] = useState<any[]>([]);
  const [setupWizardOrg, setSetupWizardOrg] = useState<{ id: string; name: string; type: 'business' | 'team' } | null>(null);
  const [showWorkspaceSettings, setShowWorkspaceSettings] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load all user workspaces
  useEffect(() => {
    api.organization.listMyOrganizations().then(setAllOrgs).catch(() => {});
  }, [organization?.id]);

  const handleCreateWorkspace = async (type: string) => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const newOrg = await api.organization.create({ 
        name: type === 'business' ? 'Minha Empresa' : 'Minha Equipe',
        type: type as 'business' | 'team',
      });
      setShowCreateFlow(false);
      setIsWorkspaceOpen(false);

      // Switch context to new org
      switchOrganization({
        id: newOrg.id,
        name: newOrg.name,
        plan: 'free',
        createdAt: newOrg.created_at,
      });

      // Update profile on Supabase
      const { supabase } = await import('@/lib/supabase');
      await supabase.from('profiles').update({ organization_id: newOrg.id }).eq('id', user!.id);

      // Refresh list
      const orgs = await api.organization.listMyOrganizations();
      setAllOrgs(orgs);

      // Open setup wizard
      setSetupWizardOrg({ id: newOrg.id, name: newOrg.name, type: type as 'business' | 'team' });
    } catch (error: any) {
      console.error('Erro ao criar workspace:', error);
      addNotification({ type: 'error', title: 'Erro ao criar workspace', message: error.message });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSwitchOrg = async (org: any) => {
    switchOrganization({
      id: org.id,
      name: org.name,
      plan: 'free',
      createdAt: org.created_at,
    });
    // Persist the switch to Supabase
    const { supabase } = await import('@/lib/supabase');
    await supabase.from('profiles').update({ organization_id: org.id }).eq('id', user!.id);
    setIsWorkspaceOpen(false);
    addNotification({ type: 'info', title: `Workspace: ${org.name}` });
  };

  const handleSwitchToPersonal = async () => {
    switchOrganization({
      id: 'personal',
      name: 'Espaço Pessoal',
      plan: (user?.plan ?? 'free') as any,
      createdAt: user?.createdAt ?? '',
    });
    const { supabase } = await import('@/lib/supabase');
    await supabase.from('profiles').update({ organization_id: null }).eq('id', user!.id);
    setIsWorkspaceOpen(false);
    addNotification({ type: 'info', title: 'Voltou ao Espaço Pessoal' });
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsWorkspaceOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
    <motion.aside
      animate={{ width: sidebarCollapsed ? 72 : 260 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="hidden sm:flex fixed left-0 top-0 bottom-0 z-40 flex-col border-r border-white/8 bg-[linear-gradient(180deg,rgba(6,9,13,0.98),rgba(7,10,14,0.96))] shadow-[18px_0_60px_rgba(0,0,0,0.26)]"
    >
      {/* Logo */}
      <Link
        to="/dashboard"
        title="Ir para o Painel"
        className="flex h-16 items-center gap-3 border-b border-app-border px-5 transition-opacity hover:opacity-80"
      >
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-2xl shadow-[0_8px_24px_rgba(124,58,237,0.34)]">
          <img src={contracteaseLogo} alt="ContractEase" className="h-full w-full object-contain" />
        </div>
        {!sidebarCollapsed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-w-0">
            <p className="font-bricolage text-xl font-bold tracking-tight whitespace-nowrap">
              <span className="text-app-text">Contract</span>
              <span className="bg-gradient-to-r from-violet-400 to-purple-500 bg-clip-text text-transparent">Ease</span>
            </p>
          </motion.div>
        )}
      </Link>

      {/* Workspace Switcher */}
      {!sidebarCollapsed && organization && (
        <div className="px-3 pt-3 mb-2 relative" ref={dropdownRef}>
          <div
            onClick={() => setIsWorkspaceOpen(!isWorkspaceOpen)}
            className={`group w-full cursor-pointer rounded-2xl border p-2.5 transition-all ${
              isWorkspaceOpen ? 'border-emerald-400/18 bg-emerald-500/10' : 'border-app-border bg-white/[0.03] hover:bg-white/[0.05]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-white font-bold text-xs shrink-0">
                {(organization as any).logo_url
                  ? <img src={(organization as any).logo_url} alt={organization.name} className="w-full h-full object-cover" />
                  : organization.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-semibold text-app-text">{organization.name}</p>
                {organization.id !== 'personal' && (
                  <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-app-text-subtle">{organization.plan}</p>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setShowWorkspaceSettings(true); }}
                className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg text-app-text-subtle transition-all hover:bg-white/10 hover:text-app-text group-hover:flex"
                title="Configurações do workspace"
              >
                <iconify-icon icon="solar:settings-bold" class="text-sm" />
              </button>
              <iconify-icon
                icon="solar:alt-arrow-down-bold"
                class={`shrink-0 text-app-text-subtle transition-transform duration-300 ${isWorkspaceOpen ? 'rotate-180' : ''}`}
              />
            </div>
          </div>

          <AnimatePresence>
            {isWorkspaceOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute left-3 right-3 top-full mt-2 bg-neutral-900 border border-white/10 rounded-2xl p-2 premium-shadow z-50"
              >
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {/* Espaço Pessoal */}
                  <button
                    onClick={handleSwitchToPersonal}
                    className={`w-full p-2 flex items-center gap-3 rounded-xl transition-all ${
                      organization.id === 'personal' ? 'bg-emerald-500/10 border border-emerald-500/20' : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-neutral-700 flex items-center justify-center text-white font-bold text-xs shrink-0">
                      <iconify-icon icon="solar:user-bold" class="text-sm" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-xs font-bold text-white truncate">Espaço Pessoal</p>
                    </div>
                    {organization.id === 'personal' && <iconify-icon icon="solar:check-circle-bold" class="text-emerald-500" />}
                  </button>

                  {/* All real workspaces */}
                  {allOrgs.map(org => (
                    <button
                      key={org.id}
                      onClick={() => handleSwitchOrg(org)}
                      className={`w-full p-2 flex items-center gap-3 rounded-xl transition-all ${
                        organization.id === org.id ? 'bg-emerald-500/10 border border-emerald-500/20' : 'hover:bg-white/5'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-bold text-xs shrink-0 overflow-hidden">
                        {org.logo_url ? (
                          <img src={org.logo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          org.name.charAt(0)
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-xs font-bold text-white truncate">{org.name}</p>
                      </div>
                      {organization.id === org.id && <iconify-icon icon="solar:check-circle-bold" class="text-emerald-500" />}
                    </button>
                  ))}
                </div>

                <div className="mt-2 pt-2 border-t border-white/5">
                  <button 
                    onClick={() => {
                      setIsWorkspaceOpen(false);
                      setShowCreateFlow(true);
                    }}
                    className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 text-neutral-400 hover:text-white transition-all text-xs font-bold"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-neutral-500 shrink-0">
                      <iconify-icon icon="solar:add-circle-bold" />
                    </div>
                    Criar novo workspace
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Creation Flow Modal */}
      <AnimatePresence>
        {showCreateFlow && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateFlow(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-neutral-900 border border-white/10 rounded-3xl p-8 max-w-md w-full relative z-10 premium-shadow"
            >
              <button 
                onClick={() => setShowCreateFlow(false)}
                className="absolute top-4 right-4 text-neutral-500 hover:text-white transition-colors"
              >
                <iconify-icon icon="solar:close-circle-bold" class="text-2xl" />
              </button>

              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                  <iconify-icon icon="solar:widget-add-bold-duotone" class="text-4xl text-emerald-500" />
                </div>
                <h3 className="text-2xl font-bold text-white font-bricolage">Novo Workspace</h3>
                <p className="text-neutral-400 text-sm mt-2">Como você pretende usar este novo espaço?</p>
              </div>

              <div className="space-y-4">
                <button 
                  onClick={() => handleCreateWorkspace('business')}
                  className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all group text-left flex items-start gap-4"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 group-hover:bg-emerald-500 group-hover:text-black transition-all">
                    <iconify-icon icon="solar:buildings-bold-duotone" class="text-2xl" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Organização / Empresa</p>
                    <p className="text-[11px] text-neutral-500 mt-0.5">Espaço corporativo com múltiplos membros, faturamento centralizado e controle de permissões.</p>
                  </div>
                </button>

                <button 
                  onClick={() => handleCreateWorkspace('team')}
                  className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group text-left flex items-start gap-4"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 group-hover:bg-blue-500 group-hover:text-black transition-all">
                    <iconify-icon icon="solar:users-group-two-rounded-bold-duotone" class="text-2xl" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Grupo / Equipe Livre</p>
                    <p className="text-[11px] text-neutral-500 mt-0.5">Espaço simplificado para projetos específicos ou colaboração pontual entre amigos.</p>
                  </div>
                </button>
              </div>

              <p className="text-center text-[10px] text-neutral-600 mt-8 uppercase font-bold tracking-widest">
                Você poderá alterar isso mais tarde nas configurações
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto space-y-0.5">
        {(() => {
          const sections = {
            core: 'Operação',
            contracts: 'Contratos',
            actions: 'Criação',
            market: 'Mercado',
            analytics: 'Negócio',
            developer: 'Infra',
          };

          const filteredItems = NAV_ITEMS.filter(item => item.profile === activeProfile);
          const groupedItems: Record<string, typeof NAV_ITEMS> = {};

          filteredItems.forEach(item => {
            const section = item.section || 'core';
            if (!groupedItems[section]) {
              groupedItems[section] = [];
            }
            groupedItems[section].push(item);
          });

          const sectionOrder = ['core', 'contracts', 'actions', 'market', 'analytics', 'developer'];

          return sectionOrder.map((sectionKey) => {
            if (!groupedItems[sectionKey] || groupedItems[sectionKey].length === 0) return null;

            return (
              <div key={sectionKey}>
                {sectionKey !== 'core' && !sidebarCollapsed && (
                  <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-600">
                    {sections[sectionKey as keyof typeof sections]}
                  </p>
                )}
                {sectionKey !== 'core' && sidebarCollapsed && (
                  <div className="h-px bg-white/5 my-2 mx-2" />
                )}

                <motion.div className="space-y-1">
                  {groupedItems[sectionKey].map((item) => (
                    <div key={item.to}>
                    <NavLink
                      to={item.to}
                      title={sidebarCollapsed ? item.label : ''}
                    >
                      {({ isActive }) => (
                        (() => {
                          const palette = SECTION_STYLES[sectionKey] ?? SECTION_STYLES.core;

                          return (
                        <div className={`group relative flex items-center gap-3 overflow-hidden rounded-[22px] border px-3 py-3 transition-all ${
                          isActive
                            ? palette.activeCard
                            : 'border-transparent text-neutral-400 hover:border-white/10 hover:bg-white/[0.04] hover:text-white'
                        }`}>
                          {isActive && <div className={`absolute inset-y-3 left-0 w-[3px] rounded-full ${palette.activeRail}`} />}
                          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-colors ${
                            isActive
                              ? palette.activeIcon
                              : 'border-white/8 bg-white/[0.03] text-neutral-500 group-hover:border-white/12 group-hover:text-neutral-200'
                          }`}>
                            <iconify-icon icon={item.icon} class="text-lg" />
                          </div>

                          {!sidebarCollapsed && (
                            <motion.div
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="min-w-0 flex-1 text-left"
                            >
                              <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-semibold text-inherit">{item.label}</span>
                                {(item as any).badge && (
                                  <span className="rounded-md border border-fuchsia-500/30 bg-fuchsia-500/20 px-1.5 py-0.5 text-[9px] font-bold text-fuchsia-300">
                                    {(item as any).badge}
                                  </span>
                                )}
                              </div>
                              {(item as any).description && (
                                <p className="mt-1 truncate text-[11px] text-neutral-500 group-hover:text-neutral-400">
                                  {(item as any).description}
                                </p>
                              )}
                            </motion.div>
                          )}

                          {sidebarCollapsed && (
                            <motion.div
                              initial={{ opacity: 0, x: 10 }}
                              whileHover={{ opacity: 1, x: 0 }}
                              className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-lg bg-neutral-800 px-3 py-2 text-xs font-medium text-white z-50"
                            >
                              {item.label}
                            </motion.div>
                          )}

                          {item.to === '/templates' && !sidebarCollapsed && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setIsLibraryExpanded(open => !open);
                              }}
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-black/20 text-neutral-500 transition-colors hover:border-white/14 hover:text-white"
                              title={isLibraryExpanded ? 'Recolher opções da biblioteca' : 'Abrir opções da biblioteca'}
                            >
                              <iconify-icon
                                icon="solar:alt-arrow-down-bold"
                                class={`text-sm transition-transform ${isLibraryExpanded ? 'rotate-180' : ''}`}
                              />
                            </button>
                          )}
                        </div>
                          );
                        })()
                      )}
                    </NavLink>
                    {item.to === '/templates' && isLibraryExpanded && (
                      <AnimatePresence initial={false}>
                        {!sidebarCollapsed && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="ml-7 mt-1 space-y-1 overflow-hidden border-l border-white/8 pl-3"
                          >
                            <NavLink
                              to="/templates?library=documents"
                              className={({ isActive }) => `flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                                isActive ? 'bg-emerald-500/10 text-emerald-300' : 'text-neutral-500 hover:bg-white/[0.04] hover:text-white'
                              }`}
                            >
                              <iconify-icon icon="solar:document-text-bold-duotone" class="text-sm" />
                              Documentos Contratuais
                            </NavLink>
                            <NavLink
                              to="/smart-contracts"
                              className={({ isActive }) => `flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                                isActive ? 'bg-cyan-500/10 text-cyan-300' : 'text-neutral-500 hover:bg-white/[0.04] hover:text-white'
                              }`}
                            >
                              <iconify-icon icon="solar:cpu-bolt-bold-duotone" class="text-sm" />
                              Contratos Inteligentes
                            </NavLink>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    )}
                    </div>
                  ))}
                </motion.div>
              </div>
            );
          });
        })()}
        
        {/* Conditional Admin Section */}
        {user?.role === 'admin' && (
          <>
            <div className="pt-4 pb-2 px-4">
              <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Sistema</p>
            </div>
            {ADMIN_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                    isActive
                      ? 'bg-fuchsia-500/10 text-fuchsia-400'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <iconify-icon icon={item.icon} class="text-xl shrink-0" />
                {!sidebarCollapsed && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="whitespace-nowrap">
                    {item.label}
                  </motion.span>
                )}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* Bottom section */}
      <div className="space-y-3 border-t border-white/8 px-3 py-3">

        {/* Collapse toggle */}
        <button
          onClick={toggleCollapse}
          className="w-full flex items-center gap-3 rounded-[20px] border border-white/8 px-3 py-2.5 text-sm text-neutral-500 transition-all hover:border-white/12 hover:bg-white/[0.03] hover:text-white"
        >
          <iconify-icon
            icon={sidebarCollapsed ? 'solar:alt-arrow-right-linear' : 'solar:alt-arrow-left-linear'}
            class="text-xl shrink-0"
          />
          {!sidebarCollapsed && <span>Recolher</span>}
        </button>

      </div>
    </motion.aside>

    {/* Setup Wizard (rendered outside aside as overlay) */}
    {setupWizardOrg && (
      <Suspense fallback={null}>
        <WorkspaceSetupWizard
          orgId={setupWizardOrg.id}
          orgName={setupWizardOrg.name}
          type={setupWizardOrg.type}
          onComplete={() => {
            setSetupWizardOrg(null);
            // Refresh org list and reload current org data
            api.organization.listMyOrganizations().then(setAllOrgs).catch(() => {});
            // Reload page to reflect new org name in the store
            window.location.reload();
          }}
          onClose={() => setSetupWizardOrg(null)}
        />
      </Suspense>
    )}

    {/* Workspace Settings Modal */}
    {showWorkspaceSettings && (
      <Suspense fallback={null}>
        <WorkspaceSettingsModal onClose={() => setShowWorkspaceSettings(false)} />
      </Suspense>
    )}
    </>
  );
}
