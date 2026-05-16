import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { useNotificationStore } from '@/stores';

const MOBILE_NAV_ITEMS = [
  { to: '/dashboard', icon: 'solar:widget-5-bold-duotone', label: 'Início' },
  { to: '/contracts', icon: 'solar:document-text-bold-duotone', label: 'Docs' },
  { to: '/contracts/new', icon: 'solar:add-circle-bold-duotone', label: 'Novo', highlight: true },
  { to: '/finance', icon: 'solar:card-bold-duotone', label: 'Plano' },
  { to: '/settings', icon: 'solar:settings-bold-duotone', label: 'Menu' },
];

export default function BottomNav() {
  const location = useLocation();
  const unreadCount = useNotificationStore(state => {
    const notifications = state.notifications || [];
    return notifications.filter(n => !n.read).length;
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-neutral-950/95 backdrop-blur-xl border-t border-white/5 pb-safe sm:hidden flex justify-around px-2 py-1">
      {MOBILE_NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => {
            const baseClass = 'flex flex-col items-center justify-center py-2 px-3 flex-1 rounded-xl transition-all relative group';
            const activeClass = isActive
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'text-neutral-500 hover:text-white hover:bg-white/5';
            return `${baseClass} ${activeClass}`;
          }}
        >
          {({ isActive }) => (
            <>
              <div className="relative">
                <motion.div
                  animate={{ scale: isActive ? 1.1 : 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                >
                  <iconify-icon
                    icon={item.icon}
                    class={`text-2xl transition-transform ${isActive ? 'scale-110' : 'scale-100'}`}
                  />
                </motion.div>

                {/* Badge for notifications on settings */}
                {item.to === '/settings' && unreadCount > 0 && (
                  <motion.span
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </motion.span>
                )}
              </div>
              <span className="text-[10px] font-medium mt-1 text-center truncate px-1">{item.label}</span>

              {/* Active indicator */}
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-indicator"
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1 rounded-full bg-emerald-500"
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
