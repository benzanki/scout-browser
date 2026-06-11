import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          // App preload (renderer <-> main bridge)
          index: resolve(__dirname, 'src/preload/index.ts'),
          // Webview preload (injected into embedded web pages)
          webview: resolve(__dirname, 'src/preload/webview.ts')
        },
        output: {
          // Disable code-splitting so each preload is a single self-contained file.
          // Use .cjs so Electron loads them as CommonJS even though package.json
          // is "type": "module" (otherwise the require() preloads fail as ESM).
          format: 'cjs',
          entryFileNames: '[name].cjs'
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
