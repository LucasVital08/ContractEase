/**
 * Navegação principal.
 *
 * Antes: 12 itens, 5 seções coloridas, submenu que duplicava destinos e um
 * seletor "business/developer" que escondia páginas sem avisar. O usuário não
 * conseguia prever onde as coisas estavam.
 *
 * Agora: 4 destinos fixos, sempre visíveis, sempre na mesma ordem. Tudo o que
 * é secundário vive atrás de "Mais", recolhido por padrão. Um único acento de
 * cor (verde) marca a página atual.
 */

import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useAuthStore, useUIStore } from '@/stores';
import contracteaseLogo from '@/assets/contractease-logo.svg';

/**
 * O caminho principal, em três blocos com uma leitura só:
 * o que eu faço → onde eu descubro o que fazer → como está indo.
 * Sem cores por seção e sem itens que aparecem ou somem conforme o perfil.
 */
export const PRIMARY_NAV = [
  { to: '/inicio', icon: 'solar:home-smile-bold-duotone', label: 'Início', group: 'fazer' },
  { to: '/criar', icon: 'solar:add-circle-bold-duotone', label: 'Criar contrato', group: 'fazer' },
  { to: '/contracts', icon: 'solar:folder-with-files-bold-duotone', label: 'Meus contratos', group: 'fazer' },

  { to: '/templates', icon: 'solar:copy-bold-duotone', label: 'Modelos', group: 'descobrir' },
  { to: '/opportunities', icon: 'solar:bolt-circle-bold-duotone', label: 'Oportunidades', group: 'descobrir' },

  { to: '/painel', icon: 'solar:chart-2-bold-duotone', label: 'Painel', group: 'acompanhar' },
  { to: '/carteira', icon: 'solar:wallet-2-bold-duotone', label: 'Carteira', group: 'acompanhar' },
] as const;

/** Ordem dos blocos; o separador entre eles é uma linha, não uma cor. */
const NAV_GROUPS = ['fazer', 'descobrir', 'acompanhar'] as const;

/** Tudo o que existe, mas não faz parte do caminho principal. */
const SECONDARY_NAV = [
  { to: '/smart-contracts', icon: 'solar:cpu-bolt-linear', label: 'Catálogo de escrow' },
  { to: '/painel/completo', icon: 'solar:widget-linear', label: 'Painel completo' },
  { to: '/partners', icon: 'solar:users-group-rounded-linear', label: 'Parceiros' },
  { to: '/affiliates', icon: 'solar:share-linear', label: 'Indicações' },
  { to: '/finance', icon: 'solar:card-linear', label: 'Plano e créditos' },
  { to: '/analytics', icon: 'solar:chart-2-linear', label: 'Relatórios' },
  { to: '/verify', icon: 'solar:shield-check-linear', label: 'Verificar um documento' },
  { to: '/integrations', icon: 'solar:plug-linear', label: 'Integrações e API' },
  { to: '/settings', icon: 'solar:settings-linear', label: 'Configurações' },
] as const;

/** Os cinco que cabem na barra inferior do celular, na mesma ordem da lateral. */
export const MOBILE_NAV = PRIMARY_NAV.filter((item) =>
  ['/inicio', '/criar', '/contracts', '/opportunities', '/carteira'].includes(item.to),
);

export default function Sidebar() {
  const { sidebarCollapsed, toggleCollapse } = useUIStore();
  const user = useAuthStore((s) => s.user);
  const [showMore, setShowMore] = useState(false);

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 76 : 248 }}
      transition={{ type: 'spring', stiffness: 300, damping: 32 }}
      className="fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-white/8 bg-neutral-950 sm:flex"
    >
      <Link
        to="/inicio"
        className="flex h-16 shrink-0 items-center gap-3 border-b border-white/8 px-5 transition-opacity hover:opacity-80"
      >
        <img src={contracteaseLogo} alt="" className="h-9 w-9 shrink-0 rounded-xl object-contain" />
        {!sidebarCollapsed && (
          <span className="font-bricolage text-lg font-bold tracking-tight text-white">ContractEase</span>
        )}
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group, groupIndex) => (
          <div key={group} className={groupIndex > 0 ? 'mt-3 border-t border-white/[0.06] pt-3' : ''}>
            <div className="space-y-1">
              {PRIMARY_NAV.filter((item) => item.group === group).map((item) => (
                <NavLink key={item.to} to={item.to} title={sidebarCollapsed ? item.label : undefined}>
                  {({ isActive }) => (
                    <span
                      className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-emerald-500/10 text-white'
                          : 'text-neutral-400 hover:bg-white/[0.04] hover:text-white'
                      }`}
                    >
                      {isActive && <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-emerald-400" />}
                      <iconify-icon
                        icon={item.icon}
                        class={`shrink-0 text-xl ${isActive ? 'text-emerald-300' : ''}`}
                      />
                      {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}

        {!sidebarCollapsed && (
          <div className="mt-3 border-t border-white/[0.06] pt-3">
            <button
              onClick={() => setShowMore((v) => !v)}
              aria-expanded={showMore}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-500 transition-colors hover:text-white"
            >
              <iconify-icon icon="solar:menu-dots-linear" class="shrink-0 text-xl" />
              <span className="flex-1 text-left">Mais</span>
              <iconify-icon
                icon="solar:alt-arrow-down-linear"
                class={`text-sm transition-transform ${showMore ? 'rotate-180' : ''}`}
              />
            </button>

            <AnimatePresence initial={false}>
              {showMore && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <div className="mt-1 space-y-0.5 border-l border-white/8 pl-3">
                    {SECONDARY_NAV.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors ${
                            isActive ? 'text-emerald-300' : 'text-neutral-500 hover:text-white'
                          }`
                        }
                      >
                        <iconify-icon icon={item.icon} class="shrink-0 text-base" />
                        <span className="truncate">{item.label}</span>
                      </NavLink>
                    ))}
                    {user?.role === 'admin' && (
                      <NavLink
                        to="/admin"
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors ${
                            isActive ? 'text-emerald-300' : 'text-neutral-500 hover:text-white'
                          }`
                        }
                      >
                        <iconify-icon icon="solar:server-square-linear" class="shrink-0 text-base" />
                        Administração
                      </NavLink>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </nav>

      <div className="shrink-0 space-y-1 border-t border-white/8 px-3 py-3">
        <a
          href="/manual.html"
          target="_blank"
          rel="noopener noreferrer"
          title={sidebarCollapsed ? 'Manual' : undefined}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-neutral-500 transition-colors hover:bg-white/[0.04] hover:text-white"
        >
          <iconify-icon icon="solar:book-bookmark-linear" class="shrink-0 text-xl" />
          {!sidebarCollapsed && <span>Manual</span>}
        </a>
        <button
          onClick={toggleCollapse}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-neutral-500 transition-colors hover:bg-white/[0.04] hover:text-white"
        >
          <iconify-icon
            icon={sidebarCollapsed ? 'solar:alt-arrow-right-linear' : 'solar:alt-arrow-left-linear'}
            class="shrink-0 text-xl"
          />
          {!sidebarCollapsed && <span>Recolher</span>}
        </button>
      </div>
    </motion.aside>
  );
}
