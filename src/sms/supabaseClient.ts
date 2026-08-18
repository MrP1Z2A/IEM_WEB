/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const fallbackUrl = supabaseUrl || 'https://lzlhsmtkkcpomabqaqdu.supabase.co';
const isBrowser = typeof window !== 'undefined';
const effectiveUrl = isBrowser ? `${window.location.origin}/supabase` : fallbackUrl;
const effectiveKey = supabaseAnonKey || 'sb_publishable_wTAOBsSeZ-3V-pFwHzqy5w_5xyOng6-';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing in environment variables. Using fallback/proxy values.');
}

// Helper to rewrite Supabase direct URLs to proxy URLs in the browser
function rewriteUrls(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    const directDomain = 'https://lzlhsmtkkcpomabqaqdu.supabase.co';
    if (obj.startsWith(directDomain) && typeof window !== 'undefined') {
      return obj.replace(directDomain, `${window.location.origin}/supabase`);
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => rewriteUrls(item));
  }
  if (typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        newObj[key] = rewriteUrls(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
}

// Global prototype interceptor for PostgrestBuilders
const patchQueryBuilder = (queryInstance: any) => {
  let proto = Object.getPrototypeOf(queryInstance);
  while (proto && proto !== Object.prototype) {
    if (typeof proto.then === 'function' && !proto.__isPatched) {
      const originalThen = proto.then;
      proto.then = function (this: any, onfulfilled?: any, onrejected?: any) {
        return originalThen.call(this, (res: any) => {
          if (res && res.data) {
            res.data = rewriteUrls(res.data);
          }
          return onfulfilled ? onfulfilled(res) : res;
        }, onrejected);
      };
      proto.__isPatched = true;
    }
    proto = Object.getPrototypeOf(proto);
  }
};

// Initialize Supabase Client
export const supabase = createClient(effectiveUrl, effectiveKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Apply interceptors in the browser environment
if (isBrowser) {
  try {
    // Patch select, insert, update, and delete builders
    patchQueryBuilder(supabase.from('dummy_intercept').select('*'));
    patchQueryBuilder(supabase.from('dummy_intercept').insert({}));
  } catch (e) {
    console.warn('Failed to apply global query URL proxy interceptors:', e);
  }

  // Wrap storage client functions to route generated URLs through the proxy
  try {
    const originalFrom = supabase.storage.from.bind(supabase.storage);
    supabase.storage.from = (bucket: string) => {
      const client = originalFrom(bucket);
      
      const originalGetPublicUrl = client.getPublicUrl.bind(client);
      client.getPublicUrl = (path: string, options?: any) => {
        const res = originalGetPublicUrl(path, options);
        if (res.data && res.data.publicUrl) {
          res.data.publicUrl = rewriteUrls(res.data.publicUrl);
        }
        return res;
      };

      const originalCreateSignedUrl = client.createSignedUrl.bind(client);
      client.createSignedUrl = async (path: string, expiresIn: number, options?: any) => {
        const res = await originalCreateSignedUrl(path, expiresIn, options);
        if (res.data && res.data.signedUrl) {
          res.data.signedUrl = rewriteUrls(res.data.signedUrl);
        }
        return res;
      };

      const originalCreateSignedUrls = client.createSignedUrls.bind(client);
      client.createSignedUrls = async (paths: string[], expiresIn: number, options?: any) => {
        const res = await originalCreateSignedUrls(paths, expiresIn, options);
        if (res.data) {
          res.data = res.data.map((item: any) => {
            if (item.signedUrl) {
              item.signedUrl = rewriteUrls(item.signedUrl);
            }
            return item;
          });
        }
        return res;
      };

      return client;
    };
  } catch (e) {
    console.warn('Failed to wrap storage client functions:', e);
  }
}
