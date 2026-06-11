import { useEffect, useRef } from 'react'
import type { WebviewElement } from '../webview.d'
import type { AppPanel } from '../../../shared/types'
import { isElectron } from '../lib/env'
import { hostnameOf } from '../lib/url'
import { useUiStore } from '../store/uiStore'
import { RotateCw, ExternalLink, MonitorPlay, Globe } from 'lucide-react'

// Injected into the page (main world) on dom-ready: hook getUserMedia/
// getDisplayMedia so we know when the mic/cam/screen is being captured (e.g. in a
// voice call) — true the whole time, even when nobody is speaking.
const CAPTURE_HOOK = `(function(){
  if (window.__scoutCapHook) return; window.__scoutCapHook = true;
  var live = 0;
  var report = function(){ document.dispatchEvent(new Event(live > 0 ? 'scout:capture-on' : 'scout:capture-off')); };
  var watch = function(stream){
    if(!stream||!stream.getTracks) return;
    live++; report();
    var tracks = stream.getTracks(); var remaining = tracks.length;
    tracks.forEach(function(t){ t.addEventListener('ended', function(){ remaining--; if(remaining<=0){ live=Math.max(0,live-1); report(); } }); });
  };
  var md = navigator.mediaDevices;
  if(md && md.getUserMedia){ var g = md.getUserMedia.bind(md); md.getUserMedia = function(){ return g.apply(null, arguments).then(function(s){ watch(s); return s; }); }; }
  if(md && md.getDisplayMedia){ var d = md.getDisplayMedia.bind(md); md.getDisplayMedia = function(){ return d.apply(null, arguments).then(function(s){ watch(s); return s; }); }; }
})();`

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
const preloadPath = isElectron ? window.scout.webviewPreloadPath : undefined

interface Props {
  panel: AppPanel
  active: boolean
}

// An always-alive web app (Discord, Spotify, …). Kept mounted and only hidden
// via CSS when another panel is active, so sessions/calls stay connected.
export default function AppPanelView({ panel, active }: Props): JSX.Element {
  const ref = useRef<WebviewElement | null>(null)
  const setPanelBusy = useUiStore((s) => s.setPanelBusy)
  const isDiscord = /discord\.com/i.test(panel.url)

  // Track whether this panel is "busy" (playing audio OR capturing mic/cam) so
  // the Hub never suspends it mid-music or mid-call. Reported to uiStore.
  useEffect(() => {
    if (!isElectron) return
    const el = ref.current
    if (!el) return
    let audible = false
    let capturing = false
    const sync = (): void => setPanelBusy(panel.id, audible || capturing)

    const onPlay = (): void => {
      audible = true
      sync()
    }
    const onPause = (): void => {
      audible = false
      sync()
    }
    const onReady = (): void => {
      try {
        void el.executeJavaScript(CAPTURE_HOOK)
      } catch {
        /* not ready */
      }
    }
    const onMessage = (e: Event): void => {
      const { channel, args } = e as unknown as { channel: string; args: unknown[] }
      if (channel === 'scout:capture') {
        capturing = Boolean(args[0])
        sync()
      }
    }

    el.addEventListener('media-started-playing', onPlay)
    el.addEventListener('media-paused', onPause)
    el.addEventListener('dom-ready', onReady)
    el.addEventListener('ipc-message', onMessage)
    return () => {
      el.removeEventListener('media-started-playing', onPlay)
      el.removeEventListener('media-paused', onPause)
      el.removeEventListener('dom-ready', onReady)
      el.removeEventListener('ipc-message', onMessage)
      setPanelBusy(panel.id, false)
    }
  }, [panel.id, setPanelBusy])

  return (
    <div
      className="absolute inset-0 flex flex-col"
      style={{ display: active ? 'flex' : 'none' }}
    >
      {/* Slim app toolbar */}
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-scout-border bg-scout-surface px-3">
        <span className="text-[13px] font-medium text-scout-text">{panel.label}</span>
        <span className="text-[11px] text-scout-faint">{hostnameOf(panel.url)}</span>
        <div className="ml-auto flex items-center gap-1">
          {isDiscord && (
            <button
              onClick={() => void window.scout?.launchDiscord()}
              title="Open the Discord desktop app (for noise suppression & hotkeys)"
              className="flex items-center gap-1.5 rounded-md border border-scout-border px-2 py-1 text-[11px] text-scout-muted hover:border-scout-accent hover:text-scout-text"
            >
              <MonitorPlay size={12} /> Desktop app
            </button>
          )}
          <button
            onClick={() => {
              try {
                ref.current?.reload()
              } catch {
                /* not ready */
              }
            }}
            title="Reload"
            className="rounded-md p-1 text-scout-faint hover:bg-scout-surface-2 hover:text-scout-text"
          >
            <RotateCw size={13} />
          </button>
          <button
            onClick={() => window.scout?.launchExternal(panel.url)}
            title="Open in default browser"
            className="rounded-md p-1 text-scout-faint hover:bg-scout-surface-2 hover:text-scout-text"
          >
            <ExternalLink size={13} />
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {isElectron ? (
          <webview
            ref={(el) => (ref.current = el as WebviewElement | null)}
            src={panel.url}
            preload={preloadPath}
            partition="persist:scout"
            useragent={CHROME_UA}
            plugins
            allowpopups
            className="absolute inset-0 h-full w-full"
            style={{ display: 'flex' }}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-scout-bg">
            <Globe size={28} className="text-scout-faint" />
            <div className="text-sm text-scout-muted">{panel.label}</div>
            <div className="text-xs text-scout-faint">{hostnameOf(panel.url)}</div>
            <div className="mt-1 rounded-md border border-scout-border bg-scout-surface px-2.5 py-1 text-[11px] text-scout-faint">
              Live app runs in the desktop app (npm run dev)
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
