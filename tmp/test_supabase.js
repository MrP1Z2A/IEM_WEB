const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const url = process.env.VITE_SUPABASE_URL || 'https://sb.iemsms.com';
const key = process.env.VITE_SUPABASE_ANON_KEY;

console.log('Testing connection to:', url);
console.log('Using key length:', key ? key.length : 0);

const supabase = createClient(url, key);

async function run() {
  try {
    const { data, error } = await supabase.from('schools').select('*').limit(1);
    if (error) {
      console.error('Error fetching schools:', error);
    } else {
      console.log('Success! Fetched data:', data);
    }
  } catch (err) {
    console.error('Thrown error:', err);
  }
}

run();
