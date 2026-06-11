// True only inside the real Electron renderer (where the preload bridge exists).
// In the standalone Vite UI preview, window.scout is undefined, so we render
// placeholders instead of live <webview> elements.
export const isElectron =
  typeof window !== 'undefined' && typeof window.scout !== 'undefined'
