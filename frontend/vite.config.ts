import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // The API sends no CORS headers, and the refresh cookie is SameSite=Strict on /api/v1/auth: in development the
    // browser must talk to ONE origin, so Vite forwards /api to the Spring Boot server.
    proxy: {
      '/api': { target: process.env.QISMA_API_URL ?? 'http://localhost:8080', changeOrigin: false },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true,
    testTimeout: 20_000, // a whole screen flow with several requests can take a while on a busy machine
  },
})
