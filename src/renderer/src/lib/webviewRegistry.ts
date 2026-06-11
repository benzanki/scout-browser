import type { WebviewElement } from '../webview.d'

// Live <webview> DOM elements are imperative and must not live in React state.
// We keep them in a module-level registry keyed by tab id so the top bar's
// navigation controls and the command palette can drive whichever tab is active.
const registry = new Map<string, WebviewElement>()

export function registerWebview(tabId: string, el: WebviewElement | null): void {
  if (el) registry.set(tabId, el)
  else registry.delete(tabId)
}

export function getWebview(tabId: string | null | undefined): WebviewElement | undefined {
  if (!tabId) return undefined
  return registry.get(tabId)
}

/** Reverse lookup: which tab owns a given webContents id (e.g. the source of a
 *  middle-click / popup). Used to inherit the private flag onto the new tab. */
export function getTabIdByWebContents(wcId: number): string | null {
  for (const [tabId, el] of registry) {
    try {
      if (el.getWebContentsId() === wcId) return tabId
    } catch {
      /* not ready */
    }
  }
  return null
}

// Convenience wrappers that no-op safely if the webview isn't mounted/ready yet
// (e.g. in the browser preview, a frozen tab, or before the dom-ready event —
// many webview methods throw if called before then).
export function wvBack(tabId: string | null): void {
  try {
    const wv = getWebview(tabId)
    if (wv?.canGoBack()) wv.goBack()
  } catch {
    /* not ready */
  }
}
export function wvForward(tabId: string | null): void {
  try {
    const wv = getWebview(tabId)
    if (wv?.canGoForward()) wv.goForward()
  } catch {
    /* not ready */
  }
}
export function wvReload(tabId: string | null): void {
  try {
    getWebview(tabId)?.reload()
  } catch {
    /* not ready */
  }
}
export function wvStop(tabId: string | null): void {
  try {
    getWebview(tabId)?.stop()
  } catch {
    /* not ready */
  }
}
export function wvNavigate(tabId: string | null, url: string): void {
  try {
    getWebview(tabId)?.loadURL(url).catch(() => void 0)
  } catch {
    /* not ready */
  }
}

export function wvSetMuted(tabId: string | null, muted: boolean): void {
  try {
    getWebview(tabId)?.setAudioMuted(muted)
  } catch {
    /* not ready */
  }
}

// Per-tab zoom levels (Electron zoom level units; 0 = 100%).
const zoom = new Map<string, number>()
export function wvZoom(tabId: string | null, delta: number | 'reset'): number {
  const wv = getWebview(tabId)
  if (!tabId) return 0
  const next = delta === 'reset' ? 0 : Math.max(-3, Math.min(4.5, (zoom.get(tabId) ?? 0) + delta))
  zoom.set(tabId, next)
  try {
    wv?.setZoomLevel(next)
  } catch {
    /* not ready */
  }
  return next
}
