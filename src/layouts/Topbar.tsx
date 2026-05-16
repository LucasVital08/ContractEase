import { useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthStore } from '@/stores';
import { useInbox } from '@/hooks/useInbox';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { animations, colors } from '@/tokens';

const ROUTE_TITLES: Record<string, { title: string; icon?: string; breadcrumb?: string[] }> = {
  '/dashboard': { title: 'Dashboard', icon: 'solar:widget-5-bold-duotone', breadcrumb: ['Dashboard'] },
  '/contracts': { title: 'Documentos', icon: 'solar:document-text-bold-duotone', breadcrumb: ['Documentos'] },
  '/contracts/new': { title: 'Novo Documento', icon: 'solar:add-circle-bold-duotone', breadcrumb: ['Documentos', 'Novo'] },
  '/templates': { title: 'Templates', icon: 'solar:copy-bold-duotone', breadcrumb: ['Templates'] },
  '/analytics': { title: 'Analytics', icon: 'solar:chart-2-bold-duotone', breadcrumb: ['Analytics'] },
  '/settings': { title: 'Configurações', icon: 'solar:settings-bold-duotone', breadcrumb: ['Configurações'] },
  '/finance': { title: 'Faturamento & Créditos', icon: 'solar:card-bold-duotone', breadcrumb: ['Faturamento'] },
};

export default function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const { user, logout, activeProfile, setActiveProfile } = useAuthStore();
  const { notifications, unreadCount, markAllAsRead, markAsRead } = useInbox();

  const routeInfo = ROUTE_TITLES[location.pathname] || { title: 'ContractEase', breadcrumb: ['Home'] };
  const title = routeInfo.title;

  return (
    <header className="h-16 border-b border-white/5 bg-neutral-950/80 backdrop-blur-xl flex items-center justify-between px-8 sticky top-0 z-30">
      <motion.div className="flex items-center gap-3 flex-1 min-w-0" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
        {/* Breadcrumb indicator */}
        {routeInfo.icon && (
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-emerald-500 shrink-0">
            <iconify-icon icon={routeInfo.icon} class="text-lg" />
          </div>
        )}

        {/* Title with better hierarchy */}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white font-bricolage truncate">{title}</h1>
          {routeInfo.breadcrumb && routeInfo.breadcrumb.length > 1 && (
            <div className="flex items-center gap-1 text-xs text-neutral-500 mt-0.5">
              {routeInfo.breadcrumb.map((crumb, i) => (
                <div key={i} className="flex items-center gap-1">
                  {i > 0 && <iconify-icon icon="solar:alt-arrow-right-bold" class="text-[10px]" />}
                  <span>{crumb}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contract ID badge */}
        {location.pathname.startsWith('/contracts/CE-') && (
          <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono shrink-0">
            {location.pathname.split('/').pop()}
          </span>
        )}
      </motion.div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <motion.button
          onClick={() => window.dispatchEvent(new CustomEvent('open-global-search'))}
          className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 transition-colors group relative"
          title="Pesquisar (Ctrl+K)"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <iconify-icon icon="solar:magnifer-linear" class="text-lg" />
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded bg-neutral-800 border border-white/10 text-[8px] font-bold text-neutral-500 hidden md:flex items-center justify-center">
            K
          </div>
        </motion.button>

        {/* Notifications */}
        <div className="relative">
          <motion.button
            onClick={() => setShowNotifs(!showNotifs)}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all relative border ${
              showNotifs
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white hover:bg-white/10'
            }`}
            whileHover={{ scale: showNotifs ? 1 : 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <iconify-icon icon="solar:bell-linear" class="text-lg" />
            {unreadCount > 0 && (
              <motion.span
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-[9px] text-white font-bold flex items-center justify-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
              >
                {unreadCount}
              </motion.span>
            )}
          </motion.button>
          
          <AnimatePresence>
            {showNotifs && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowNotifs(false)}
                  className="fixed inset-0 z-40"
                />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute right-0 top-full mt-2 w-96 glass-panel rounded-2xl shadow-lg overflow-hidden z-50"
                >
                  <div className="p-4 border-b border-white/5 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-white">Central de Notificações</h3>
                    {unreadCount > 0 && (
                      <motion.button
                        onClick={() => markAllAsRead()}
                        className="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                        whileHover={{ scale: 1.05 }}
                      >
                        Marcar tudo como lido
                      </motion.button>
                    )}
                  </div>
                <div className="max-h-[400px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <iconify-icon icon="solar:bell-off-bold-duotone" class="text-4xl text-neutral-600 mb-2" />
                        <p className="text-xs text-neutral-500">Nenhuma notificação por aqui.</p>
                      </div>
                    ) : (
                      <motion.div
                        initial="hidden"
                        animate="visible"
                        variants={{
                          visible: { transition: { staggerChildren: 0.05 } },
                        }}
                      >
                        {notifications.map((notif) => (
                          <motion.div
                            key={notif.id}
                            onClick={() => {
                              markAsRead(notif.id);
                              if (notif.link) {
                                setShowNotifs(false);
                                navigate(notif.link);
                              }
                            }}
                            variants={{
                              hidden: { opacity: 0, x: -20 },
                              visible: { opacity: 1, x: 0 },
                            }}
                            className={`p-4 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer relative group ${!notif.read ? 'bg-emerald-500/5' : ''}`}
                          >
                            {!notif.read && (
                              <motion.div
                                className="absolute top-4 right-4 w-2 h-2 rounded-full bg-emerald-500"
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                              />
                            )}
                            <p className="text-xs font-bold text-white flex items-center gap-2">
                              <iconify-icon
                                icon={
                                  (notif.type as string) === 'signing_invite' ? 'solar:pen-bold' :
                                  notif.type === 'success' ? 'solar:check-circle-bold' :
                                  notif.type === 'warning' ? 'solar:danger-triangle-bold' :
                                  notif.type === 'error' ? 'solar:close-circle-bold' : 'solar:info-circle-bold'
                                }
                                class={
                                  (notif.type as string) === 'signing_invite' ? 'text-emerald-400' :
                                  notif.type === 'success' ? 'text-emerald-400' :
                                  notif.type === 'warning' ? 'text-amber-400' :
                                  notif.type === 'error' ? 'text-red-400' : 'text-blue-400'
                                }
                              />
                              {notif.title}
                            </p>
                            <p className="text-xs text-neutral-400 mt-1 line-clamp-2">{notif.message}</p>
                            {notif.link && (
                              <p className="text-[10px] text-emerald-500 mt-2 flex items-center gap-1">
                                <iconify-icon icon="solar:arrow-right-bold" class="text-[9px]" />
                                Clique para abrir
                              </p>
                            )}
                            <p className="text-[10px] text-neutral-500 mt-2">
                              {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: ptBR })}
                            </p>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </div>
                {notifications.length > 0 && (
                  <div className="p-2 border-t border-white/5 bg-black/20 text-center">
                    <button className="text-xs text-neutral-400 hover:text-white transition-colors py-1">Ver todas</button>
                  </div>
                )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <div className="w-px h-6 bg-white/10 mx-2" />

        {/* Profile Dropdown */}
        <div className="relative">
          <motion.button
            onClick={() => setShowProfile(!showProfile)}
            className={`flex items-center gap-2 p-1 pr-3 rounded-xl border transition-all ${
              showProfile
                ? 'bg-white/10 border-white/20'
                : 'bg-white/5 border-white/10 hover:bg-white/10'
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-xs font-bold overflow-hidden">
              {user?.avatar
                ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                : user?.name.charAt(0)}
            </div>
            <div className="hidden md:block text-left shrink-0">
              <p className="text-[11px] font-bold text-white leading-none">{user?.name.split(' ')[0]}</p>
              <p className="text-[9px] text-emerald-500 font-bold leading-none mt-1">{user?.credits} créditos</p>
            </div>
            <iconify-icon icon="solar:alt-arrow-down-bold" class={`text-[10px] text-neutral-500 transition-transform ${showProfile ? 'rotate-180' : ''}`} />
          </motion.button>

          <AnimatePresence>
            {showProfile && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowProfile(false)}
                  className="fixed inset-0 z-40"
                />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute right-0 top-full mt-2 w-64 glass-panel rounded-2xl shadow-lg overflow-hidden z-50 p-2 border border-white/10"
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
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
