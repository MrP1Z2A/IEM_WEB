import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim();
const anonKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

const supabase = createClient(supabaseUrl, anonKey);

async function checkUrl() {
  const { data } = supabase.storage.from('resources_buckets').getPublicUrl('1774077125427-elementary-school-report-card-design-template-5355659cd4a057d97311f83c8ba2b68c_screen.jpg');
  console.log('Public URL resources_buckets:', data.publicUrl);
  
  const { data: buckets } = await supabase.storage.listBuckets();
  console.log('Buckets:', buckets?.map(b => b.name));
}

checkUrl();
