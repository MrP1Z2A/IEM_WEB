
import { createClient } from '@supabase/supabase-client';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkTable() {
  const { data, error } = await supabase.from('admin_security_settings').select('*').limit(1);
  if (error) {
    console.error('Error fetching admin_security_settings:', error);
  } else {
    console.log('admin_security_settings sample data:', data);
  }
}

checkTable();
