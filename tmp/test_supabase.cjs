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

console.log('Testing signInAnonymously on:', url);

const supabase = createClient(url, key);

async function run() {
  try {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error('Error signing in anonymously:', error.message);
    } else {
      console.log('Success! Signed in anonymously. User ID:', data.user.id);
    }
  } catch (err) {
    console.error('Thrown error:', err);
  }
}

run();
