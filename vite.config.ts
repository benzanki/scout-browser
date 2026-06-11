import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Standalone Vite config used ONLY for previewing the renderer UI in a plain
// browser during development/verification. The actual app is built and run via
// electron.vite.config.ts. Components guard Electron-only APIs (window.scout?.)
// so the UI renders fine here without the main process.
export default defineConfig({
  root: 'src/renderer',
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src')
    }
  },
  plugins: [react(), tailwindcss()],
  server: {
    port: 5199,
    strictPort: true
  }
})
