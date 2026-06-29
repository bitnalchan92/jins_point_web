import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    clearMocks: true,
    // Supabase Edge Function tests are Deno tests (run via `npm run test:edge`),
    // not vitest tests. Keep vitest scoped to the React app.
    exclude: [...configDefaults.exclude, 'supabase/**'],
  },
})
