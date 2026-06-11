import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env manually
const envPath = path.resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let val = match[2] || '';
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    }
    env[key] = val.trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    // 1. Let's try to query one row from class_courses to see what columns it returns
    console.log('Querying class_courses...');
    const { data: courseData, error: courseError } = await supabase
      .from('class_courses')
      .select('*')
      .limit(1);
    
    if (courseError) {
      console.error('Error querying class_courses:', courseError);
    } else {
      console.log('class_courses schema sample:', courseData);
    }

    // 2. Let's try to query one row from classes
    console.log('Querying classes...');
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('*')
      .limit(1);

    if (classError) {
      console.error('Error querying classes:', classError);
    } else {
      console.log('classes schema sample:', classData);
    }

    // 3. Let's check if there is any table named live_meetings or zoom_meetings by trying to query it
    console.log('Querying live_meetings...');
    const { data: liveData, error: liveError } = await supabase
      .from('live_meetings')
      .select('*')
      .limit(1);
    console.log('live_meetings query result:', { data: liveData, error: liveError });

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

run();
