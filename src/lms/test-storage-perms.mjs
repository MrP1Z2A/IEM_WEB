import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim();
const anonKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();
const supabase = createClient(supabaseUrl, anonKey);

const schoolId = "f17d2849-bd51-40eb-855d-1cc3a5685c54";
const classCourseId = "9f60d209-61ca-4874-8942-1657487aee69";
const fileName = "1774077125427-elementary-school-report-card-design-template-5355659cd4a057d97311f83c8ba2b68c_screen.jpg";

const paths = [
  fileName,
  `math/${fileName}`,
  `${schoolId}/${fileName}`,
  `${classCourseId}/${fileName}`,
  `${schoolId}/${classCourseId}/${fileName}`,
  `resources/${fileName}`,
  `${classCourseId}/math/${fileName}`
];

async function check() {
  const buckets = ['resources_buckets', 'resources', 'course_resources', 'class_image', 'course_profile', 'attachments'];
  for (const b of buckets) {
      for(const p of paths) {
          const { data, error } = await supabase.storage.from(b).download(p);
          if (data) {
             console.log(`[${b}] FOUND! Path: ${p} | Size: ${data.size}`);
             return;
          }
      }
  }
  console.log('Not found in any permutation');
}
check();
