import { NavLink } from 'react-router-dom';
import { useUIStore, useAuthStore } from '@/stores';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useRef, useEffect } from 'react';

const NAV_ITEMS = [
  // Business Items
  { to: '/dashboard', icon: 'solar:widget-5-bold-duotone', label: 'Dashboard', profile: 'business' },
  { to: '/contracts', icon: 'solar:document-text-bold-duotone', label: 'Documentos', profile: 'business' },
  { to: '/contracts/new', icon: 'solar:add-circle-bold-duotone', label: 'Novo Documento', profile: 'business' },
  { to: '/templates', icon: 'solar:copy-bold-duotone', label: 'Templates', profile: 'business' },
  { to: '/finance', icon: 'solar:card-bold-duotone', label: 'Faturamento & Créditos', profile: 'business' },
  { to: '/analytics', icon: 'solar:chart-2-bold-duotone', label: 'Analytics', profile: 'business' },
  
  // Developer Items
  { to: '/integrations', icon: 'solar:plug-bold-duotone', label: 'Integrações & API', profile: 'developer' },
  { to: '/verify', icon: 'solar:shield-check-bold-duotone', label: 'Verificação Blockchain', profile: 'developer' },
];

const ADMIN_ITEMS = [
  { to: '/admin', icon: 'solar:server-square-bold-duotone', label: 'Super-Admin' },
];


export default function Sidebar() {
  const { sidebarCollapsed, toggleCollapse } = useUIStore();
  const { user, organization, activeProfile } = useAuthStore();
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [showCreateFlow, setShowCreateFlow] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    <motion.aside
      animate={{ width: sidebarCollapsed ? 72 : 260 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="hidden sm:flex fixed left-0 top-0 bottom-0 z-40 bg-neutral-950 border-r border-white/5 flex-col"
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-5 gap-3 border-b border-white/5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-bold text-sm shrink-0">
          CE
        </div>
        {!sidebarCollapsed && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-bricolage font-bold text-white text-lg tracking-tight whitespace-nowrap"
          >
            ContractEase
          </motion.span>
        )}
      </div>

      {/* Workspace Switcher */}
      {!sidebarCollapsed && organization && (
        <div className="px-3 pt-4 mb-2 relative" ref={dropdownRef}>
          <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest px-2 mb-2">Área de Trabalho</p>
          <button 
            onClick={() => setIsWorkspaceOpen(!isWorkspaceOpen)}
            className={`w-full flex items-center gap-3 p-2 rounded-xl border transition-all group ${
              isWorkspaceOpen ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/10 hover:bg-white/10'
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
              {organization.name.charAt(0)}
            </div>
            <div className="flex-1 text-left">
              <p className="text-xs font-bold text-white truncate">{organization.name}</p>
              <p className="text-[10px] text-emerald-500 font-bold uppercase">{organization.plan}</p>
            </div>
            <iconify-icon 
              icon="solar:alt-arrow-down-bold" 
              class={`text-neutral-500 transition-transform duration-300 ${isWorkspaceOpen ? 'rotate-180 text-white' : 'group-hover:text-white'}`} 
            />
          </button>

          <AnimatePresence>
            {isWorkspaceOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute left-3 right-3 top-full mt-2 bg-neutral-900 border border-white/10 rounded-2xl p-2 premium-shadow z-50"
              >
                <div className="space-y-1">
                  <div className="p-2 flex items-center gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
                      {organization.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">{organization.name}</p>
                      <p className="text-[10px] text-emerald-500 font-bold uppercase">Ativo</p>
                    </div>
                    <iconify-icon icon="solar:check-circle-bold" class="text-emerald-500" />
                  </div>
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
                  onClick={() => setShowCreateFlow(false)}
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
                  onClick={() => setShowCreateFlow(false)}
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
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.filter(item => item.profile === activeProfile).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400'
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
      <div className="py-3 px-3 border-t border-white/5 space-y-1">

        {/* Collapse toggle */}
        <button
          onClick={toggleCollapse}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-neutral-500 hover:text-white hover:bg-white/5 transition-all"
        >
          <iconify-icon
            icon={sidebarCollapsed ? 'solar:alt-arrow-right-linear' : 'solar:alt-arrow-left-linear'}
            class="text-xl shrink-0"
          />
          {!sidebarCollapsed && <span>Recolher</span>}
        </button>

      </div>
    </motion.aside>
  );
}
