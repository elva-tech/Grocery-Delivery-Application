import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5175,
    proxy: {
      // Same-origin proxy → hosted Map Service (Render has no CORS for browsers; do not call it cross-origin from the SPA)
      '/map-service-remote': {
        target: 'https://ola-map-service.onrender.com',
        changeOrigin: true,
        secure: true,
        rewrite: (pathStr) => pathStr.replace(/^\/map-service-remote/, ''),
      },
      // Local Map Service on :3000 (optional fallback while developing)
      '/map-service': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (pathStr) => pathStr.replace(/^\/map-service/, ''),
      },
    },
  },
})