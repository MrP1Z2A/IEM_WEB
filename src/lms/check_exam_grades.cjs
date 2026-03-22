const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data, error } = await supabase.from('exam_grades').select('*').limit(3);
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Data:', data);
  }
}
main();
