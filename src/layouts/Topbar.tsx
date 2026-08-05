/**
 * Cabeçalho.
 *
 * Enxugado para o que o usuário realmente usa daqui: onde ele está, o estado da
 * carteira, o que chegou de novo e a conta. O antigo seletor
 * "business / developer" saiu junto com a navegação que ele filtrava — esconder
 * páginas atrás de um toggle é o oposto de previsível.
 */

import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { useAuthStore } from '@/stores';
import { useInbox } from '@/hooks/useInbox';
import WalletConnectButton from '@/components/WalletConnectButton';

const ROUTE_TITLES: Record<string, string> = {
  '/inicio': 'Início',
  '/dashboard': 'Início',
  '/criar': 'Criar contrato',
  '/contracts': 'Meus contratos',
  '/contracts/new': 'Criar contrato',
  '/carteira': 'Carteira',
  '/wallet': 'Carteira',
  '/templates': 'Modelos prontos',
  '/smart-contracts': 'Catálogo de escrow',
  '/opportunities': 'Oportunidades',
  '/partners': 'Parceiros',
  '/affiliates': 'Indicações',
  '/finance': 'Plano e créditos',
  '/analytics': 'Relatórios',
  '/verify': 'Verificar um documento',
  '/integrations': 'Integrações e API',
  '/settings': 'Configurações',
};

export default function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { notifications, unreadCount, markAllAsRead, markAsRead } = useInbox();
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const title = ROUTE_TITLES[location.pathname] ?? 'ContractEase';

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-white/8 bg-neutral-950/85 px-4 backdrop-blur-xl sm:px-8">
      <h1 className="min-w-0 flex-1 truncate font-bricolage text-lg font-bold text-white">{title}</h1>

      <div className="flex items-center gap-2">
        <div className="hidden sm:block">
          <WalletConnectButton />
        </div>

        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-global-search'))}
          title="Buscar (Ctrl+K)"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-neutral-400 transition-colors hover:text-white"
        >
          <iconify-icon icon="solar:magnifer-linear" class="text-lg" />
        </button>

        {/* Notificações */}
        <div className="relative">
          <button
            onClick={() => setShowNotifs((v) => !v)}
            className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
              showNotifs ? 'border-emerald-400/30 text-emerald-300' : 'border-white/10 text-neutral-400 hover:text-white'
            }`}
          >
            <iconify-icon icon="solar:bell-linear" class="text-lg" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-black">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {showNotifs && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl"
                >
                  <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                    <span className="text-sm font-semibold text-white">Novidades</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllAsRead()}
                        className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300"
                      >
                        Marcar tudo como lido
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-8 text-center text-xs text-neutral-500">Nada de novo por aqui.</p>
                    ) : (
                      notifications.map((notif) => (
                        <button
                          key={notif.id}
                          onClick={() => {
                            markAsRead(notif.id);
                            if (notif.link) {
                              setShowNotifs(false);
                              navigate(notif.link);
                            }
                          }}
                          className={`block w-full border-b border-white/6 px-4 py-3 text-left transition-colors last:border-0 hover:bg-white/[0.04] ${
                            notif.read ? '' : 'bg-emerald-500/[0.05]'
                          }`}
                        >
                          <p className="text-xs font-semibold text-white">{notif.title}</p>
                          {notif.message && (
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-400">{notif.message}</p>
                          )}
                          <p className="mt-1.5 text-[10px] text-neutral-600">
                            {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: ptBR })}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Conta */}
        <div className="relative">
          <button
            onClick={() => setShowProfile((v) => !v)}
            className="flex items-center gap-2 rounded-xl border border-white/10 p-1 pr-2.5 transition-colors hover:border-white/20"
          >
            <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg bg-emerald-500/15 text-xs font-bold text-emerald-300">
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                (user?.name?.charAt(0) ?? '?').toUpperCase()
              )}
            </span>
            <span className="hidden text-xs font-medium text-neutral-300 md:block">
              {user?.name?.split(' ')[0] ?? 'Conta'}
            </span>
          </button>

          <AnimatePresence>
            {showProfile && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProfile(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 p-2 shadow-2xl"
                >
                  <div className="border-b border-white/8 px-3 pb-3 pt-2">
                    <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
                    <p className="truncate text-xs text-neutral-500">{user?.email}</p>
                    {typeof user?.credits === 'number' && (
                      <p className="mt-2 text-xs text-neutral-400">
                        <span className="font-semibold text-emerald-300">{user.credits}</span> créditos
                      </p>
                    )}
                  </div>

                  <div className="pt-2">
                    <Link
                      to="/settings"
                      onClick={() => setShowProfile(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-white/[0.05] hover:text-white"
                    >
                      <iconify-icon icon="solar:user-circle-linear" class="text-base" />
                      Perfil e conta
                    </Link>
                    <Link
                      to="/carteira"
                      onClick={() => setShowProfile(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-neutral-300 transition-colors hover:bg-white/[0.05] hover:text-white"
                    >
                      <iconify-icon icon="solar:wallet-2-linear" class="text-base" />
                      Carteira
                    </Link>
                    <button
                      onClick={() => {
                        void logout();
                        setShowProfile(false);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-neutral-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                    >
                      <iconify-icon icon="solar:logout-2-linear" class="text-base" />
                      Sair
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
