import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Ports are offset from denwa-alert's (5173 / 3000) so both can run at once.
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3001';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    strictPort: true,
    // Same-origin in dev: the app calls /api/v1/... on :5174 and Vite
    // forwards it, so there's no CORS and no base URL to configure.
    proxy: { '/api': BACKEND_URL },
  },
  preview: { port: 5174, strictPort: true },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
});
