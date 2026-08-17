import { supabase as sharedSupabase } from '../../sms/supabaseClient';

export const isSupabaseConfigured = true;
export const supabase = sharedSupabase;
