import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim();
const anonKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

const buckets = ['resources_buckets', 'resources', 'course_resources', 'files', 'class_image', 'course_profile'];
const fileName = '1774077125427-elementary-school-report-card-design-template-5355659cd4a057d97311f83c8ba2b68c_screen.jpg';

async function testFolders() {
  for (const b of buckets) {
    const res = await fetch(`${supabaseUrl}/storage/v1/object/public/${b}/${fileName}`);
    console.log(`[Public] ${b}: ${res.status}`);
    
    // Test authenticated
    const resAuth = await fetch(`${supabaseUrl}/storage/v1/object/authenticated/${b}/${fileName}`, {
       headers: { Authorization: `Bearer ${anonKey}` }
    });
    console.log(`[Auth] ${b}: ${resAuth.status}`);
  }
}
testFolders();
