import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// BASE_PATH: where the site lives. "/" for a custom domain or
// you.github.io; "/repo-name/" for https://you.github.io/repo-name/.
// The GitHub Pages workflow sets it for you.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  logLevel: 'error', // Suppress warnings, only show errors
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
