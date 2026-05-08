import { Outlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import BottomNav from './BottomNav';
import { useUIStore, useNotificationStore } from '@/stores';
import { CookieBanner } from '@/components/CookieBanner';
import CommandPalette from '@/components/CommandPalette';

export default function AppLayout() {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const notifications = useNotificationStore((s) => s.notifications);
  const removeNotification = useNotificationStore((s) => s.remove);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans">
      <div className="bg-grain" />
      <Sidebar />

      <div
        className="transition-all duration-300 sm:ml-0 md:ml-[var(--sidebar-width)] pb-20 sm:pb-0"
        style={{ '--sidebar-width': sidebarCollapsed ? '72px' : '260px' } as any}
      >
        <Topbar />
        <main className="p-4 sm:p-8">
          <Outlet />
        </main>
      </div>

      {/* Toast notifications */}
      <div className="fixed top-20 right-6 z-50 flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 80, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.95 }}
              className={`pointer-events-auto px-5 py-3 rounded-xl flex items-center gap-3 shadow-2xl border cursor-pointer ${
                n.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : n.type === 'error'
                    ? 'bg-red-500/10 border-red-500/20 text-red-400'
                    : n.type === 'warning'
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                      : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
              }`}
              onClick={() => removeNotification(n.id)}
            >
              <iconify-icon
                icon={
                  n.type === 'success'
                    ? 'solar:check-circle-bold'
                    : n.type === 'error'
                      ? 'solar:danger-circle-bold'
                      : n.type === 'warning'
                        ? 'solar:danger-triangle-bold'
                        : 'solar:info-circle-bold'
                }
                class="text-xl shrink-0"
              />
              <div>
                <p className="text-sm font-semibold">{n.title}</p>
                {n.message && <p className="text-xs opacity-70">{n.message}</p>}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <CookieBanner />
      <CommandPalette />
      <BottomNav />
    </div>
  );
}
