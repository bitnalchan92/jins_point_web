import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    clearMocks: true,
    // Supabase Edge Function tests are Deno tests (run via `npm run test:edge`)
    // and Playwright E2E specs run via `npm run test:e2e`; neither is a vitest
    // test. Keep vitest scoped to the React app.
    exclude: [...configDefaults.exclude, 'supabase/**', 'tests/e2e/**'],
  },
})
