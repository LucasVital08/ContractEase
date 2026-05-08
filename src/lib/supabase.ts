import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL ou Anon Key ausentes no arquivo .env. As funcionalidades de backend não funcionarão.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
