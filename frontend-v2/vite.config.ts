import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Fully offline app: no CDN calls at runtime. Fonts are bundled via @fontsource,
// the map has no basemap tiles. Dev server proxies /api and /ws to the backend so
// there is a single origin and no CORS surprises in the demo.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5273,
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
      '/ws': { target: 'ws://localhost:8000', ws: true },
      '/health': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
