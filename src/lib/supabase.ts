import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL ou Anon Key ausentes no arquivo .env. As funcionalidades de backend não funcionarão.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Ensure the session is restored from localStorage before any query fires.
    // Without this, a fresh tab can send unauthenticated requests while the
    // client is still reading the stored token — causing silent RLS blocks.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
