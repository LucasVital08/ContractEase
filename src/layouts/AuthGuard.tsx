import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores';

export default function AuthGuard() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const initialized = useAuthStore((s) => s.initialized);
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    // initialize() is idempotent only within a session — `initialized` is no
    // longer persisted, so it starts as false on every tab/page load and this
    // effect always runs the full Supabase session check before rendering routes.
    initialize();
  }, [initialize]);

  // Always show the spinner until initialize() has finished verifying the
  // Supabase session. This prevents queries from firing with a missing token
  // on fresh tab loads where the Supabase client hasn't restored the session yet.
  if (!initialized || isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex">
        {/* Sidebar skeleton */}
        <div className="w-64 shrink-0 border-r border-white/5 bg-neutral-950 p-4 flex flex-col gap-3">
          <div className="h-8 w-32 bg-white/10 rounded-lg animate-pulse" />
          <div className="mt-4 space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-9 w-full bg-white/5 rounded-xl animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
        </div>
        {/* Main area skeleton */}
        <div className="flex-1 flex flex-col">
          <div className="h-14 border-b border-white/5 bg-neutral-950 px-6 flex items-center gap-4">
            <div className="h-8 w-64 bg-white/10 rounded-lg animate-pulse" />
          </div>
          <div className="flex-1 p-6 space-y-4">
            <div className="h-8 w-48 bg-white/10 rounded-lg animate-pulse" />
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-28 bg-neutral-900 border border-white/5 rounded-2xl animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
              ))}
            </div>
            <div className="h-48 bg-neutral-900 border border-white/5 rounded-2xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
