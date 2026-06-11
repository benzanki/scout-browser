import { useEffect, useRef, useState } from 'react'
import type { Tab } from '../../../shared/types'
import type { WebviewElement } from '../webview.d'
import { useAppStore } from '../store/appStore'
import { useUiStore } from '../store/uiStore'
import { registerWebview } from '../lib/webviewRegistry'
import { hostnameOf, NEWTAB_URL } from '../lib/url'
import { isElectron } from '../lib/env'
import { MAIN_PARTITION, PRIVATE_PARTITION } from '../../../shared/types'
import NewTabPage from './NewTabPage'
import { Globe, WifiOff, RotateCw, ShieldAlert, Frown } from 'lucide-react'
import type { CSSProperties } from 'react'

export type Region = 'full' | 'left' | 'right' | 'hidden'

interface Props {
  tab: Tab
  region: Region
  active: boolean
}

// Position a tab's view: full screen, a split half, or hidden (kept mounted).
// NOTE: visible states use `display: flex`, not `block` — Electron's <webview>
// collapses to its default 150px intrinsic height unless it's a flex box.
function regionStyle(region: Region): CSSProperties {
  switch (region) {
    case 'hidden':
      return { display: 'none' }
    case 'left':
      return { display: 'flex', left: 0, width: '50%' }
    case 'right':
      return { display: 'flex', left: '50%', width: '50%' }
    default:
      return { display: 'flex', left: 0, width: '100%' }
  }
}

const preloadPath = isElectron ? window.scout.webviewPreloadPath : undefined

// Present as plain Chrome. Electron's default UA contains "Electron/…", which
// makes UA-sniffing sites (notably Google) serve a blank "unsupported browser"
// page. A clean desktop-Chrome UA fixes that.
const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

interface LoadError {
  code: number
  desc: string
  url: string
  blocked: boolean
  crashed?: boolean
}

export default function Webview({ tab, region, active }: Props): JSX.Element {
  const ref = useRef<WebviewElement | null>(null)
  const updateTabMeta = useAppStore((s) => s.updateTabMeta)
  const setNavStatus = useAppStore((s) => s.setNavStatus)
  const addHistory = useAppStore((s) => s.addHistory)
  const appendToActiveNote = useAppStore((s) => s.appendToActiveNote)
  const inspectMode = useUiStore((s) => s.inspectMode)
  const setInspectMode = useUiStore((s) => s.setInspectMode)
  const setRightOpen = useUiStore((s) => s.setRightOpen)
  const isNewTab = tab.url === NEWTAB_URL
  // The src attribute is set once, the first time the tab points at a real URL
  // (a tab can start on the dashboard, then navigate to a site).
  const srcRef = useRef<string | null>(isNewTab ? null : tab.url)
  if (srcRef.current === null && !isNewTab) srcRef.current = tab.url
  const currentUrl = useRef(tab.url)
  const [error, setError] = useState<LoadError | null>(null)
  const [confirmBypass, setConfirmBypass] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Private tabs never write to history.
    const logHistory = (entry: { url: string; title?: string; favicon?: string }): void => {
      if (!tab.private) addHistory(entry)
    }

    const syncNav = (): void =>
      setNavStatus(tab.id, {
        canGoBack: el.canGoBack(),
        canGoForward: el.canGoForward()
      })

    const onStartLoading = (): void => {
      setError(null)
      setConfirmBypass(false)
      setNavStatus(tab.id, { loading: true })
    }
    const onStopLoading = (): void => {
      setNavStatus(tab.id, { loading: false })
      syncNav()
    }
    const onNavigate = (e: Event): void => {
      const url = (e as unknown as { url?: string }).url
      if (url) {
        currentUrl.current = url
        updateTabMeta(tab.id, { url })
        logHistory({ url, title: tab.title, favicon: tab.favicon })
      }
      syncNav()
    }
    const onTitle = (e: Event): void => {
      const title = (e as unknown as { title?: string }).title
      if (title) {
        updateTabMeta(tab.id, { title })
        logHistory({ url: currentUrl.current, title })
      }
    }
    const onFavicon = (e: Event): void => {
      const favicons = (e as unknown as { favicons?: string[] }).favicons
      if (favicons?.length) {
        updateTabMeta(tab.id, { favicon: favicons[0] })
        logHistory({ url: currentUrl.current, favicon: favicons[0] })
      }
    }
    const onMediaPlay = (): void => setNavStatus(tab.id, { audible: true })
    const onMediaPause = (): void => setNavStatus(tab.id, { audible: false })
    const onCrash = (e: Event): void => {
      const reason = (e as unknown as { reason?: string }).reason
      if (reason === 'clean-exit') return // normal teardown, not a crash
      setNavStatus(tab.id, { loading: false })
      setError({ code: 0, desc: reason || 'crashed', url: currentUrl.current, blocked: false, crashed: true })
    }
    const onFail = (e: Event): void => {
      const { errorCode, errorDescription, validatedURL, isMainFrame } =
        e as unknown as {
          errorCode: number
          errorDescription: string
          validatedURL: string
          isMainFrame: boolean
        }
      // -3 is ERR_ABORTED (e.g. user navigated away) — ignore.
      if (!isMainFrame || errorCode === -3) return
      setNavStatus(tab.id, { loading: false })
      // Our blocklist cancels via webRequest → ERR_BLOCKED_BY_CLIENT.
      const blocked = /BLOCKED_BY_CLIENT/i.test(errorDescription) || errorCode === -20
      setConfirmBypass(false)
      setError({ code: errorCode, desc: errorDescription, url: validatedURL, blocked })
    }
    const onHostMessage = (e: Event): void => {
      const { channel, args } = e as unknown as { channel: string; args: unknown[] }
      if (channel === 'scout:scraped') {
        appendToActiveNote(String(args[0] ?? ''))
        setRightOpen(true)
        setInspectMode(false)
      } else if (channel === 'scout:inspect-state') {
        setInspectMode(Boolean(args[0]))
      }
    }

    el.addEventListener('did-start-loading', onStartLoading)
    el.addEventListener('did-stop-loading', onStopLoading)
    el.addEventListener('did-navigate', onNavigate)
    el.addEventListener('did-navigate-in-page', onNavigate)
    el.addEventListener('page-title-updated', onTitle)
    el.addEventListener('page-favicon-updated', onFavicon)
    el.addEventListener('media-started-playing', onMediaPlay)
    el.addEventListener('media-paused', onMediaPause)
    el.addEventListener('render-process-gone', onCrash)
    el.addEventListener('did-fail-load', onFail)
    el.addEventListener('ipc-message', onHostMessage)

    return () => {
      el.removeEventListener('did-start-loading', onStartLoading)
      el.removeEventListener('did-stop-loading', onStopLoading)
      el.removeEventListener('did-navigate', onNavigate)
      el.removeEventListener('did-navigate-in-page', onNavigate)
      el.removeEventListener('page-title-updated', onTitle)
      el.removeEventListener('page-favicon-updated', onFavicon)
      el.removeEventListener('media-started-playing', onMediaPlay)
      el.removeEventListener('media-paused', onMediaPause)
      el.removeEventListener('render-process-gone', onCrash)
      el.removeEventListener('did-fail-load', onFail)
      el.removeEventListener('ipc-message', onHostMessage)
    }
    // isNewTab is included so the listeners attach when a dashboard tab becomes
    // a real page (the <webview> mounts after the tab navigates away from NEWTAB).
  }, [tab.id, isNewTab, setNavStatus, updateTabMeta, addHistory, appendToActiveNote, setInspectMode, setRightOpen])

  // Arm/disarm inspect mode on the active tab's webview when the flag changes.
  useEffect(() => {
    if (!active) return
    const el = ref.current
    if (!el) return
    try {
      el.send('scout:inspect', inspectMode)
    } catch {
      /* webview not ready yet */
    }
  }, [active, inspectMode, isNewTab])

  const style = regionStyle(region)

  // New-tab dashboard (no live page yet).
  if (isNewTab) {
    return (
      <div className="absolute bottom-0 top-0" style={style}>
        <NewTabPage isPrivate={tab.private} />
      </div>
    )
  }

  // Browser-preview fallback: <webview> isn't a real element outside Electron.
  if (!isElectron) {
    return (
      <div
        className="absolute bottom-0 top-0 flex flex-col items-center justify-center gap-3 bg-scout-bg"
        style={style}
      >
        <Globe size={28} className="text-scout-faint" />
        <div className="text-sm text-scout-muted">{tab.title}</div>
        <div className="text-xs text-scout-faint">{hostnameOf(tab.url)}</div>
        <div className="mt-1 rounded-md border border-scout-border bg-scout-surface px-2.5 py-1 text-[11px] text-scout-faint">
          Live browsing runs in the desktop app (npm run dev)
        </div>
      </div>
    )
  }

  return (
    <>
      <webview
        ref={(el) => {
          ref.current = el as WebviewElement | null
          registerWebview(tab.id, el as WebviewElement | null)
        }}
        src={srcRef.current ?? tab.url}
        preload={preloadPath}
        partition={tab.private ? PRIVATE_PARTITION : MAIN_PARTITION}
        useragent={CHROME_UA}
        plugins
        allowpopups
        className="absolute bottom-0 top-0 h-full"
        style={style}
      />
      {region !== 'hidden' && error && (
        <div
          className="absolute bottom-0 top-0 flex items-center justify-center bg-scout-bg"
          style={style}
        >
          <div className="flex max-w-sm flex-col items-center text-center">
            {error.crashed ? (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-scout-surface-2">
                  <Frown size={26} className="text-scout-amber" />
                </div>
                <h2 className="mt-4 text-lg font-semibold">This page crashed</h2>
                <p className="mt-1 break-all text-xs text-scout-faint">
                  {hostnameOf(error.url)}
                </p>
                <p className="mt-2 text-[13px] text-scout-muted">
                  Something made this tab stop responding. Reloading usually fixes it.
                </p>
                <button
                  onClick={() => {
                    setError(null)
                    try {
                      ref.current?.reload()
                    } catch {
                      ref.current?.loadURL(error.url).catch(() => void 0)
                    }
                  }}
                  className="mt-5 flex items-center gap-2 rounded-lg border border-scout-border bg-scout-surface px-4 py-2 text-sm hover:border-scout-accent hover:bg-scout-surface-2"
                >
                  <RotateCw size={15} /> Reload page
                </button>
              </>
            ) : error.blocked ? (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-scout-pink/10">
                  <ShieldAlert size={26} className="text-scout-pink" />
                </div>
                <h2 className="mt-4 text-lg font-semibold">Blocked for your safety</h2>
                <p className="mt-1 break-all text-xs text-scout-faint">
                  {hostnameOf(error.url)}
                </p>
                <p className="mt-2 text-[13px] text-scout-muted">
                  This site is on a known malware or phishing list, so Scout didn’t
                  open it.
                </p>
                {confirmBypass ? (
                  <div className="mt-5 flex flex-col items-center gap-2.5 rounded-lg border border-scout-pink/40 bg-scout-pink/5 px-4 py-3">
                    <p className="text-[12px] text-scout-muted">
                      This site is flagged as dangerous. Only continue if you’re sure you
                      trust it.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmBypass(false)}
                        className="rounded-lg border border-scout-border px-3 py-1.5 text-[13px] hover:bg-scout-surface-2"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          const host = hostnameOf(error.url)
                          const url = error.url
                          window.scout?.allowSite(host)
                          setError(null)
                          setConfirmBypass(false)
                          ref.current?.loadURL(url).catch(() => void 0)
                        }}
                        className="rounded-lg bg-scout-pink px-3 py-1.5 text-[13px] font-medium text-white hover:brightness-110"
                      >
                        Continue anyway
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmBypass(true)}
                    className="mt-5 text-[12px] text-scout-faint underline-offset-2 hover:text-scout-muted hover:underline"
                  >
                    I trust this site — continue anyway
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-scout-surface-2">
                  <WifiOff size={26} className="text-scout-amber" />
                </div>
                <h2 className="mt-4 text-lg font-semibold">This page didn’t load</h2>
                <p className="mt-1 break-all text-xs text-scout-faint">
                  {hostnameOf(error.url)}
                </p>
                <p className="mt-2 text-[13px] text-scout-muted">{error.desc}</p>
                <button
                  onClick={() => {
                    setError(null)
                    ref.current?.loadURL(error.url).catch(() => void 0)
                  }}
                  className="mt-5 flex items-center gap-2 rounded-lg border border-scout-border bg-scout-surface px-4 py-2 text-sm hover:border-scout-accent hover:bg-scout-surface-2"
                >
                  <RotateCw size={15} /> Try again
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
