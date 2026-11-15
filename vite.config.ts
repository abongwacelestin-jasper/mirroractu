import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

/** Give the service worker a new id on every build, so each deploy refreshes its caches. */
const stampServiceWorker = () => ({
  name: 'stamp-service-worker',
  apply: 'build' as const,
  closeBundle() {
    const file = fileURLToPath(new URL('./dist/sw.js', import.meta.url))
    if (!existsSync(file)) return
    writeFileSync(file, readFileSync(file, 'utf8').replaceAll('__BUILD_ID__', Date.now().toString(36)))
  },
})

// ADMIN_GATEWAY_KEY from the local .env file, if there is one. In development the dev server
// plays the part of the dashboard's web server and adds the key to the requests it forwards.
const gatewayKey = loadEnv('development', process.cwd(), '').ADMIN_GATEWAY_KEY ?? ''

export default defineConfig({
  plugins: [react(), tailwindcss(), stampServiceWorker()],
  // When this copy of the site was built or started. Shown in the dashboard so it is easy to
  // tell which version a browser is showing.
  define: { __BUILD_STAMP__: JSON.stringify(new Date().toISOString()) },
  server: {
    // In development the API runs on port 4000 (docker compose up db api). In production nginx does this.
    proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: false, headers: gatewayKey ? { 'X-Admin-Gateway-Key': gatewayKey } : undefined } },
  },
  resolve: {
    // `@/components/...` means `src/components/...`
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
