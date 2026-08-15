import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const effectiveUrl = supabaseUrl || 'https://lzlhsmtkkcpomabqaqdu.supabase.co';
const effectiveKey = supabaseAnonKey || 'sb_publishable_wTAOBsSeZ-3V-pFwHzqy5w_5xyOng6-';

export const isSupabaseConfigured = true;

export const supabase = createClient(effectiveUrl, effectiveKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
