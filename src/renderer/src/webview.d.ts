import type { DetailedHTMLProps, HTMLAttributes } from 'react'

// Minimal typing for Electron's <webview> tag and the subset of its API Scout
// uses. Electron ships full types via Electron.WebviewTag, but declaring just
// what we touch keeps the renderer free of the electron main types.
export interface WebviewElement extends HTMLElement {
  src: string
  loadURL(url: string): Promise<void>
  getURL(): string
  getTitle(): string
  goBack(): void
  goForward(): void
  canGoBack(): boolean
  canGoForward(): boolean
  reload(): void
  stop(): void
  executeJavaScript(code: string, userGesture?: boolean): Promise<unknown>
  send(channel: string, ...args: unknown[]): void
  capturePage(): Promise<Electron.NativeImage>
  getWebContentsId(): number
  findInPage(text: string, options?: { forward?: boolean; findNext?: boolean }): number
  stopFindInPage(action: 'clearSelection' | 'keepSelection' | 'activateSelection'): void
  setZoomLevel(level: number): void
  getZoomLevel(): number
  setAudioMuted(muted: boolean): void
  isAudioMuted(): boolean
  print(options?: Record<string, unknown>): void
  reloadIgnoringCache(): void
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: DetailedHTMLProps<
        HTMLAttributes<HTMLElement> & {
          src?: string
          preload?: string
          partition?: string
          allowpopups?: boolean
          useragent?: string
          webpreferences?: string
          // Enables Chromium's built-in PDF viewer (and other plugins).
          plugins?: boolean
          // React lowercases unknown attrs; declare both for safety.
          nodeintegration?: boolean
        },
        HTMLElement
      >
    }
  }
}
