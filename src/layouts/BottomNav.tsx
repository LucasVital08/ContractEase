import { NavLink } from 'react-router-dom';

const MOBILE_NAV_ITEMS = [
  { to: '/dashboard', icon: 'solar:widget-5-bold-duotone', label: 'Início' },
  { to: '/contracts', icon: 'solar:document-text-bold-duotone', label: 'Docs' },
  { to: '/contracts/new', icon: 'solar:add-circle-bold-duotone', label: 'Novo' },
  { to: '/finance', icon: 'solar:card-bold-duotone', label: 'Plano' },
  { to: '/settings', icon: 'solar:settings-bold-duotone', label: 'Menu' },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-neutral-950 border-t border-white/5 pb-safe sm:hidden flex justify-around px-2">
      {MOBILE_NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center py-3 px-2 flex-1 transition-colors ${
              isActive
                ? 'text-emerald-400'
                : 'text-neutral-500 hover:text-white'
            }`
          }
        >
          <iconify-icon icon={item.icon} class="text-2xl mb-1" />
          <span className="text-[10px] font-medium">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
