
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  const { data, error } = await supabase.rpc('get_table_columns_v2', { t_name: 'students' });
  // Since I don't know if get_table_columns_v2 exists, I'll try a direct query if possible, 
  // but Supabase usually blocks information_schema via RPC unless defined.
  // I'll try to select a non-existent column to see the error message which might listed allowed columns.
  
  const { error: error2 } = await supabase
    .from('students')
    .select('non_existent_column_for_schema_check');
    
  if (error2) {
    console.log('Error message (might contain column names):', error2.message);
  }
}

checkColumns();
