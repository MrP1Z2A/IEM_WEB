import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim();
const anonKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

fetch(`${supabaseUrl}/rest/v1/resources_buckets?select=*&limit=2`, {
  headers: {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`
  }
}).then(res => res.json()).then(data => {
  fs.writeFileSync('buckets_full.json', JSON.stringify(data, null, 2));
  console.log('Written to buckets_full.json');
}).catch(console.error);
