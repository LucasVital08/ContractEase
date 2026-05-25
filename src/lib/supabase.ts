import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase URL ou chave publica ausentes no arquivo .env. As funcionalidades de backend nao funcionarao.');
}

// Use placeholder values when env vars are absent so createClient never throws
// during ES module initialisation — an empty string causes an immediate crash
// that breaks the entire import chain (including unrelated stores).
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-key-not-configured',
  {
    auth: {
      // Ensure the session is restored from localStorage before any query fires.
      // Without this, a fresh tab can send unauthenticated requests while the
      // client is still reading the stored token — causing silent RLS blocks.
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
