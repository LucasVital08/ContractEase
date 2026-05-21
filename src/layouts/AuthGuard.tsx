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
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-neutral-400 text-sm">Verificando sessão...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
