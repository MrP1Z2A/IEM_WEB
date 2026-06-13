const { createClient } = require('@supabase/supabase-js');

const sourceUrl = 'https://lzlhsmtkkcpomabqaqdu.supabase.co';
const sourceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6bGhzbXRra2Nwb21hYnFhcWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMTc0ODksImV4cCI6MjA4NTY5MzQ4OX0.Tmday5nk3oElp1UMZCjeTfLBefw4oOLBOIfcAb__DYE';

const destUrl = 'https://sb.iemsms.com';
const destKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4MTI4MTgwMCwiZXhwIjo0OTM2OTU1NDAwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.rgTTYz1PcNqwkBpM5_jRRvYOOz_iBgc4URoSdKrxPXM';

const sourceSupabase = createClient(sourceUrl, sourceKey);
const destSupabase = createClient(destUrl, destKey);

const BUCKETS = [
  'homework_files',
  'class_image',
  'notice_board',
  'report_cards',
  'student_profile',
  'announcements'
];

async function listAllFiles(supabaseClient, bucket, folder = '') {
  let allFiles = [];
  const { data, error } = await supabaseClient.storage.from(bucket).list(folder, { limit: 100 });
  if (error) {
    console.error(`Error listing folder "${folder}" in bucket "${bucket}":`, error);
    return [];
  }
  for (const item of data) {
    const itemPath = folder ? `${folder}/${item.name}` : item.name;
    // In Supabase listing, folders have no metadata or id
    if (item.id && item.metadata) {
      allFiles.push({ path: itemPath, mimetype: item.metadata.mimetype });
    } else {
      // It's a folder, list recursively
      const subFiles = await listAllFiles(supabaseClient, bucket, itemPath);
      allFiles = allFiles.concat(subFiles);
    }
  }
  return allFiles;
}

async function migrate() {
  console.log('Starting Storage migration...');
  console.log('Source:', sourceUrl);
  console.log('Destination:', destUrl);

  for (const bucket of BUCKETS) {
    console.log(`\nProcessing bucket: "${bucket}"...`);
    
    // List all files from source
    const files = await listAllFiles(sourceSupabase, bucket);
    console.log(`Found ${files.length} files in source bucket "${bucket}".`);

    for (const file of files) {
      console.log(`-> Migrating file: "${file.path}" (${file.mimetype || 'unknown type'})...`);
      
      // 1. Download file from source
      const { data, error: downloadError } = await sourceSupabase.storage.from(bucket).download(file.path);
      if (downloadError) {
        console.error(`   [Error] Failed to download "${file.path}":`, downloadError.message);
        continue;
      }

      // Convert Blob to Buffer
      const buffer = Buffer.from(await data.arrayBuffer());

      // 2. Upload file to destination
      const { error: uploadError } = await destSupabase.storage.from(bucket).upload(file.path, buffer, {
        upsert: true,
        contentType: file.mimetype || 'application/octet-stream'
      });

      if (uploadError) {
        console.error(`   [Error] Failed to upload "${file.path}":`, uploadError.message);
      } else {
        console.log(`   [Success] Migrated "${file.path}".`);
      }
    }
  }
  console.log('\nStorage migration process finished.');
}

migrate();
