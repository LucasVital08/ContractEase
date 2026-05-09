import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthStore } from '@/stores';
import { useInbox } from '@/hooks/useInbox';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';

const ROUTE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/contracts': 'Contratos',
  '/contracts/new': 'Novo Contrato',
  '/templates': 'Templates',
  '/analytics': 'Analytics',
  '/settings': 'Configurações',
};

export default function Topbar() {
  const location = useLocation();
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const { user, logout, activeProfile, setActiveProfile } = useAuthStore();
  const { notifications, unreadCount, markAllAsRead, markAsRead } = useInbox();

  const title = ROUTE_TITLES[location.pathname] || 'ContractEase';

  return (
    <header className="h-16 border-b border-white/5 bg-neutral-950/80 backdrop-blur-xl flex items-center justify-between px-8 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-white font-bricolage">{title}</h1>
        {location.pathname.startsWith('/contracts/CE-') && (
          <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
            {location.pathname.split('/').pop()}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <button 
          onClick={() => window.dispatchEvent(new CustomEvent('open-global-search'))}
          className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 transition-colors group relative"
          title="Pesquisar (Ctrl+K)"
        >
          <iconify-icon icon="solar:magnifer-linear" class="text-lg group-hover:scale-110 transition-transform" />
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded bg-neutral-800 border border-white/10 text-[8px] font-bold text-neutral-500 hidden md:flex items-center justify-center">
            K
          </div>
        </button>

        {/* Notifications */}
        <div className="relative">
          <button 
            onClick={() => setShowNotifs(!showNotifs)}
            className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 transition-colors relative"
          >
            <iconify-icon icon="solar:bell-linear" class="text-lg" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-[9px] text-black font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
          
          <AnimatePresence>
            {showNotifs && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute right-0 top-full mt-2 w-80 bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
                <div className="p-4 border-b border-white/5 bg-black/20 flex justify-between items-center">
                  <h3 className="text-sm font-bold text-white">Central de Notificações</h3>
                  {unreadCount > 0 && (
                    <button 
                      onClick={() => markAllAsRead()}
                      className="text-[10px] text-emerald-400 hover:text-emerald-300"
                    >
                      Marcar lidas
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center">
                      <iconify-icon icon="solar:bell-off-bold-duotone" class="text-4xl text-neutral-600 mb-2" />
                      <p className="text-xs text-neutral-500">Nenhuma notificação por aqui.</p>
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div 
                        key={notif.id}
                        onClick={() => markAsRead(notif.id)}
                        className={`p-4 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer relative ${!notif.read ? 'bg-emerald-500/5' : ''}`}
                      >
                        {!notif.read && <div className="absolute top-4 right-4 w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                        <p className="text-xs font-bold text-white flex items-center gap-2">
                          <iconify-icon 
                            icon={
                              notif.type === 'success' ? 'solar:check-circle-bold' :
                              notif.type === 'warning' ? 'solar:danger-triangle-bold' :
                              notif.type === 'error' ? 'solar:close-circle-bold' : 'solar:info-circle-bold'
                            } 
                            class={
                              notif.type === 'success' ? 'text-emerald-400' :
                              notif.type === 'warning' ? 'text-amber-400' :
                              notif.type === 'error' ? 'text-red-400' : 'text-blue-400'
                            }
                          /> 
                          {notif.title}
                        </p>
                        <p className="text-xs text-neutral-400 mt-1">{notif.message}</p>
                        <p className="text-[10px] text-neutral-500 mt-2">
                          {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>
                    ))
                  )}
                </div>
                {notifications.length > 0 && (
                  <div className="p-2 border-t border-white/5 bg-black/20 text-center">
                    <button className="text-xs text-neutral-400 hover:text-white transition-colors py-1">Ver todas</button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="w-px h-6 bg-white/10 mx-2" />

        {/* Profile Dropdown */}
        <div className="relative">
          <button 
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-2 p-1 pr-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-xs font-bold">
              {user?.name.charAt(0)}
            </div>
            <div className="hidden md:block text-left shrink-0">
              <p className="text-[11px] font-bold text-white leading-none">{user?.name.split(' ')[0]}</p>
              <p className="text-[9px] text-emerald-500 font-bold leading-none mt-1">{user?.credits} créditos</p>
            </div>
            <iconify-icon icon="solar:alt-arrow-down-bold" class={`text-[10px] text-neutral-500 transition-transform ${showProfile ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {showProfile && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }} 
                animate={{ opacity: 1, y: 0, scale: 1 }} 
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 top-full mt-2 w-64 bg-neutral-950/95 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden z-50 p-2 border border-white/10"
              >
                <div className="p-3 mb-2 border-b border-white/5">
                  <p className="text-xs font-bold text-white">{user?.name}</p>
                  <p className="text-[10px] text-neutral-500">{user?.email}</p>
                </div>

                <div className="space-y-1">
                  <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <iconify-icon icon="solar:wallet-money-bold" class="text-emerald-500" />
                      <span className="text-[10px] font-bold text-emerald-400">Créditos Disponíveis</span>
                    </div>
                    <span className="text-xs font-bold text-white">{user?.credits}</span>
                  </div>

                  <Link 
                    to="/settings" 
                    onClick={() => setShowProfile(false)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-neutral-400 hover:text-white hover:bg-white/5 transition-all text-left"
                  >
                    <iconify-icon icon="solar:user-circle-bold" /> Perfil & Conta
                  </Link>
                  


                  <div className="h-px bg-white/5 my-2" />

                  <div className="px-3 py-2">
                    <p className="text-[9px] text-neutral-500 uppercase font-bold mb-2">Alternar Perfil</p>
                    <div className="flex bg-black/40 rounded-lg p-1">
                      <button 
                        onClick={() => setActiveProfile('business')}
                        className={`flex-1 text-[10px] py-1 rounded transition-all font-bold ${activeProfile === 'business' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-white'}`}
                      >
                        Business
                      </button>
                      <button 
                        onClick={() => setActiveProfile('developer')}
                        className={`flex-1 text-[10px] py-1 rounded transition-all font-bold ${activeProfile === 'developer' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-white'}`}
                      >
                        Developer
                      </button>
                    </div>
                  </div>

                  <div className="h-px bg-white/5 my-2" />

                  <button 
                    onClick={() => { logout(); setShowProfile(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-all text-left"
                  >
                    <iconify-icon icon="solar:logout-2-bold" /> Sair da Conta
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
