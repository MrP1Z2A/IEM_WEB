
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching student:', error.message);
    return;
  }

  if (data && data.length > 0) {
    console.log('Student columns:', Object.keys(data[0]).join(', '));
  } else {
    console.log('No students found to check schema.');
  }
}

checkSchema();
