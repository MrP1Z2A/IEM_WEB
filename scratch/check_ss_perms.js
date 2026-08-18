const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read env variables from .env
const envFile = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL || 'https://lzlhsmtkkcpomabqaqdu.supabase.co';
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: userAuth, error: authError } = await supabase
    .from('student_services')
    .select('*')
    .eq('email', 'ryan.low17@gmail.com');
  
  console.log('Student Services Record:', JSON.stringify(userAuth, null, 2));
}

check();
