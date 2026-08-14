import fs from 'fs';
const env = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim();
const anonKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

fetch(`${supabaseUrl}/rest/v1/class_courses?select=*&limit=1`, {
  headers: {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`
  }
}).then(res => res.json()).then(data => {
  fs.writeFileSync('courses_out.json', JSON.stringify(data, null, 2), 'utf-8');
}).catch(console.error);
