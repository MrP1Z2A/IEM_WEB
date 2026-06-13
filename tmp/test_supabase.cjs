const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env file
const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
  if (match) {
    const key = match[1].trim();
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[key] = val;
  }
});

const url = env.VITE_SUPABASE_URL || 'https://sb.iemsms.com';
const key = env.VITE_SUPABASE_ANON_KEY;

console.log('Testing query on:', url);
const supabase = createClient(url, key);

async function run() {
  try {
    const { data, error } = await supabase.from('schools').select('*').limit(1);
    if (error) {
      console.error('Database query error:', error);
    } else {
      console.log('Success! Fetched data:', data);
    }
  } catch (err) {
    console.error('Thrown error:', err);
  }
}

run();
