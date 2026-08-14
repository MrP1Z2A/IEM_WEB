import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim();
const anonKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

const supabase = createClient(supabaseUrl, anonKey);
const fileName = '1774077125427-elementary-school-report-card-design-template-5355659cd4a057d97311f83c8ba2b68c_screen.jpg';

const testPaths = [
  fileName,
  `math/${fileName}`,
  `resources/${fileName}`,
  `bb0b5f34-02ad-4155-b.../${fileName}` // Too specific maybe
];

async function check() {
  const buckets = ['resources_buckets', 'resources', 'course_resources'];
  for (const b of buckets) {
    for (const p of testPaths) {
      const { data, error } = await supabase.storage.from(b).download(p);
      if (error) {
         // silent
      } else {
         console.log(`[${b}] Success for path: ${p}! Size: ${data.size}`);
      }
    }
  }
}
check().then(() => console.log('Done'));
