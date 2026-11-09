import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Same as the /supabase rule in netlify.toml: route Supabase through our
      // own domain to bypass regional ISP blocks.
      '/supabase': {
        target: 'https://lzlhsmtkkcpomabqaqdu.supabase.co',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/supabase/, ''),
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
