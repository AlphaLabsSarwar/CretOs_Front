import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Sandbox-only override: points Vite's dependency-optimizer cache at /tmp instead of
// node_modules/.vite, because this session's mounted filesystem cannot unlink files
// that existed before the session started. Not needed on the user's own machine —
// the regular vite.config.ts is what ships/runs there.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  cacheDir: '/tmp/vite-cache-sandbox',
  server: { port: 5173, host: '0.0.0.0', proxy: { '/api': 'http://localhost:3001' } },
})
