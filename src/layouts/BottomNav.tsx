/**
 * Navegação no celular — espelha exatamente os quatro destinos do menu lateral.
 *
 * Antes eram seis ícones, dois deles ("Plano", "Menu") levando a lugares que
 * não correspondiam ao rótulo. Mesma navegação em todo tamanho de tela é
 * metade do trabalho de tornar o app previsível.
 */

import { NavLink } from 'react-router-dom';
import { motion } from 'motion/react';
import { PRIMARY_NAV } from './Sidebar';

export default function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-white/8 bg-neutral-950/95 px-1 py-1 backdrop-blur-xl sm:hidden">
      {PRIMARY_NAV.map((item) => (
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
