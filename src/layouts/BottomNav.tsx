/**
 * Navegação no celular.
 *
 * Cinco destinos, todos tirados da mesma lista da barra lateral e na mesma
 * ordem — mesmo ícone, mesmo rótulo, mesmo lugar. Modelos e Painel ficam
 * de fora só por espaço; ambos têm atalho no Início.
 */

import { NavLink } from 'react-router-dom';
import { motion } from 'motion/react';
import { MOBILE_NAV } from './Sidebar';

export default function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-white/8 bg-neutral-950/95 px-1 py-1 backdrop-blur-xl sm:hidden">
      {MOBILE_NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `relative flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 transition-colors ${
              isActive ? 'text-emerald-300' : 'text-neutral-500'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <iconify-icon icon={item.icon} class="text-2xl" />
              <span className="text-center text-[10px] font-medium leading-tight">{item.label}</span>
              {isActive && (
                <motion.span
                  layoutId="bottom-nav-indicator"
                  className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-emerald-400"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
