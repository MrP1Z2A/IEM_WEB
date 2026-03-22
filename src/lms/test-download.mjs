import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim();
const anonKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

const supabase = createClient(supabaseUrl, anonKey);
const fileName = '1774077125427-elementary-school-report-card-design-template-5355659cd4a057d97311f83c8ba2b68c_screen.jpg';

async function testDownload() {
  const buckets = ['resources_buckets', 'resources', 'course_resources', 'files'];
  for (const b of buckets) {
    console.log(`Testing bucket: ${b}`);
    const { data, error } = await supabase.storage.from(b).download(fileName);
    if (error) {
      console.log(`Failed for ${b}:`, error.message);
    } else {
      console.log(`SUCCESS for ${b}, size:`, data.size);
    }
  }
}

testDownload();
