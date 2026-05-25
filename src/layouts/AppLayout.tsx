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
      <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-3 pointer-events-none w-full max-w-sm">
        <AnimatePresence>
          {notifications.map((n) => {
            const styles = n.type === 'success'
              ? { ring: 'border-emerald-500/30', accent: 'text-emerald-400', icon: 'solar:check-circle-bold' }
              : n.type === 'error'
                ? { ring: 'border-red-500/30', accent: 'text-red-400', icon: 'solar:danger-circle-bold' }
                : n.type === 'warning'
                  ? { ring: 'border-amber-500/30', accent: 'text-amber-400', icon: 'solar:danger-triangle-bold' }
                  : { ring: 'border-blue-500/30', accent: 'text-blue-400', icon: 'solar:info-circle-bold' };
            return (
              <motion.div
                key={n.id}
                layout
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 80, scale: 0.95 }}
                className={`pointer-events-auto px-4 py-3 rounded-xl flex items-start gap-3 shadow-2xl border bg-neutral-900/95 backdrop-blur-md cursor-pointer ${styles.ring}`}
                onClick={() => removeNotification(n.id)}
              >
                <iconify-icon icon={styles.icon} class={`text-xl shrink-0 mt-0.5 ${styles.accent}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white leading-tight">{n.title}</p>
                  {n.message && (
                    <p className="text-xs text-neutral-300 mt-1 leading-relaxed break-words">{n.message}</p>
                  )}
                </div>
                <iconify-icon icon="solar:close-circle-linear" class="text-neutral-500 text-sm shrink-0 mt-0.5" />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      <CookieBanner />
      <CommandPalette />
      <BottomNav />
    </div>
  );
}
