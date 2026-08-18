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

const supabase = createClient(supabaseUrl, supabaseKey);

// Recursive URL rewriting function
function rewriteUrls(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    const directDomain = 'https://lzlhsmtkkcpomabqaqdu.supabase.co';
    if (obj.startsWith(directDomain)) {
      return obj.replace(directDomain, 'http://localhost:5173/supabase');
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => rewriteUrls(item));
  }
  if (typeof obj === 'object') {
    const newObj = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        newObj[key] = rewriteUrls(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
}

// Intercept PostgrestBuilder's then method
const dummyQuery = supabase.from('classes').select('*').limit(1);
const proto1 = Object.getPrototypeOf(dummyQuery);
const proto2 = Object.getPrototypeOf(proto1);

console.log('Chaining protos...');
console.log('proto1 name:', proto1.constructor.name);
console.log('proto2 name:', proto2.constructor.name);

const targetProto = typeof proto2.then === 'function' ? proto2 : (typeof proto1.then === 'function' ? proto1 : null);

if (targetProto) {
  console.log('Found target prototype with "then" method!');
  const originalThen = targetProto.then;
  targetProto.then = function (onfulfilled, onrejected) {
    return originalThen.call(this, (res) => {
      if (res && res.data) {
        res.data = rewriteUrls(res.data);
      }
      return onfulfilled ? onfulfilled(res) : res;
    }, onrejected);
  };
} else {
  console.error('Could not find prototype with "then" method.');
}

async function run() {
  console.log('Querying classes...');
  const { data, error } = await supabase.from('classes').select('id, name, image_url').limit(1);
  if (error) {
    console.error('Query error:', error);
  } else {
    console.log('Query success! Rewritten result:', data);
  }
}

run();
