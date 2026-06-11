import { useEffect, useRef, useState } from 'react'
import {
  LayoutGrid,
  Globe,
  Plus,
  Settings as SettingsIcon,
  Move,
  Minus,
  Square,
  X,
  Trash2
} from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { useUiStore } from '../store/uiStore'
import { hostnameOf } from '../lib/url'
import HubHome from './HubHome'
import BrowserView from './BrowserView'
import AppPanelView from './AppPanelView'
import AppIcon from './AppIcon'

function normalizeUrl(raw: string): string {
  const u = raw.trim()
  if (!u) return ''
  return /^https?:\/\//i.test(u) ? u : `https://${u}`
}

export default function Hub(): JSX.Element {
  const hubView = useUiStore((s) => s.hubView)
  const setHubView = useUiStore((s) => s.setHubView)
  const openSettings = useUiStore((s) => s.openSettings)
  const appPanels = useAppStore((s) => s.appPanels)
  const addAppPanel = useAppStore((s) => s.addAppPanel)
  const removeAppPanel = useAppStore((s) => s.removeAppPanel)
  const reorderAppPanels = useAppStore((s) => s.reorderAppPanels)
  const [adding, setAdding] = useState<{ label: string; url: string } | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  // Lazy-load: an app's webview is only mounted once it's first opened, then
  // kept alive. Keeps boot + idle resource use low (no apps run until you use them).
  const [loaded, setLoaded] = useState<Set<string>>(new Set())
  const openPanel = (id: string): void => {
    setLoaded((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
    setHubView(id)
  }

  // Auto-suspend: unload an app panel after it's been unviewed for a while, to
  // reclaim memory. Skips the active panel and anything "busy" (audio/call).
  const suspendMin = useAppStore((s) => s.settings.appSuspendMinutes)
  const lastViewed = useRef<Record<string, number>>({})
  const prevView = useRef<string>(hubView)
  useEffect(() => {
    const prev = prevView.current
    if (prev !== hubView) {
      if (prev !== 'home' && prev !== 'browser') lastViewed.current[prev] = Date.now()
      prevView.current = hubView
    }
  }, [hubView])

  useEffect(() => {
    const mins = suspendMin ?? 10
    if (mins <= 0) return // "Never"
    const ms = mins * 60_000
    const timer = setInterval(() => {
      const view = useUiStore.getState().hubView
      const busy = useUiStore.getState().panelBusy
      setLoaded((prev) => {
        let changed = false
        const next = new Set(prev)
        for (const id of prev) {
          if (id === view || busy[id]) continue
          if (Date.now() - (lastViewed.current[id] ?? Date.now()) > ms) {
            next.delete(id)
            changed = true
          }
        }
        return changed ? next : prev
      })
    }, 30_000)
    return () => clearInterval(timer)
  }, [suspendMin])

  const railBtn = (active: boolean): string =>
    `relative flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200 ${
      active
        ? 'bg-scout-accent-soft text-scout-text glow-accent'
        : 'text-scout-muted hover:bg-scout-surface-2 hover:text-scout-text hover:scale-105'
    }`

  const accentBar = (active: boolean): JSX.Element | null =>
    active ? (
      <span className="absolute -left-2 h-5 w-1 rounded-full bg-gradient-to-b from-scout-accent to-scout-purple" />
    ) : null

  const saveAdd = (): void => {
    if (!adding) return
    const url = normalizeUrl(adding.url)
    if (!url) return
    addAppPanel(adding.label.trim() || hostnameOf(url), url)
    setAdding(null)
  }

  return (
    <div className="aurora-bg fixed inset-0 z-30 flex flex-col text-scout-text">
      {/* Top strip: drag region + window controls (frameless window). */}
      <header className="app-drag glass flex h-9 shrink-0 items-center gap-2 border-b border-scout-border px-3">
        <span className="text-[13px] font-semibold tracking-tight">
          Scout <span className="text-gradient font-bold">Hub</span>
        </span>
        <div className="app-no-drag ml-auto flex items-center gap-0.5">
          <div
            title="Drag to move window"
            className="app-drag flex h-7 w-8 cursor-grab items-center justify-center rounded-lg text-scout-faint hover:bg-scout-surface-2 hover:text-scout-text active:cursor-grabbing"
          >
            <Move size={14} />
          </div>
          <button
            onClick={() => window.scout?.minimize()}
            className="flex h-7 w-8 items-center justify-center rounded-lg text-scout-muted hover:bg-scout-surface-2 hover:text-scout-text"
          >
            <Minus size={15} />
          </button>
          <button
            onClick={() => window.scout?.maximize()}
            className="flex h-7 w-8 items-center justify-center rounded-lg text-scout-muted hover:bg-scout-surface-2 hover:text-scout-text"
          >
            <Square size={12} />
          </button>
          <button
            onClick={() => window.scout?.close()}
            className="flex h-7 w-8 items-center justify-center rounded-lg text-scout-muted hover:bg-[#e0445533] hover:text-[#f17]"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* App rail — always visible, so apps + browser are one click away. */}
        <nav className="glass flex w-16 shrink-0 flex-col items-center gap-1.5 border-r border-scout-border py-3">
          <button
            onClick={() => setHubView('home')}
            title="Home"
            className={railBtn(hubView === 'home')}
          >
            {accentBar(hubView === 'home')}
            <LayoutGrid size={19} />
          </button>
          <button
            onClick={() => setHubView('browser')}
            title="Browser"
            className={railBtn(hubView === 'browser')}
          >
            {accentBar(hubView === 'browser')}
            <Globe size={19} />
          </button>

          <div className="my-1 h-px w-7 bg-scout-border" />

          {appPanels.map((p, i) => (
            <div
              key={p.id}
              className={`group/app relative ${dragIdx === i ? 'opacity-40' : ''}`}
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragEnd={() => setDragIdx(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIdx !== null) reorderAppPanels(dragIdx, i)
                setDragIdx(null)
              }}
            >
              <button
                onClick={() => openPanel(p.id)}
                title={`${p.label} (drag to reorder)`}
                className={railBtn(hubView === p.id)}
              >
                {accentBar(hubView === p.id)}
                <AppIcon label={p.label} url={p.url} color={p.color} />
              </button>
              <button
                onClick={() => {
                  if (hubView === p.id) setHubView('home')
                  removeAppPanel(p.id)
                }}
                title={`Remove ${p.label}`}
                className="absolute -right-0.5 -top-0.5 hidden rounded-full bg-scout-bg p-0.5 text-scout-faint hover:text-scout-pink group-hover/app:block"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}

          <button
            onClick={() => setAdding({ label: '', url: '' })}
            title="Add app"
            className={`${railBtn(false)} border border-dashed border-scout-border`}
          >
            <Plus size={17} />
          </button>

          <button
            onClick={openSettings}
            title="Settings"
            className={`${railBtn(false)} mt-auto`}
          >
            <SettingsIcon size={18} />
          </button>
        </nav>

        {/* Content: every view kept mounted (alive); shown by hubView. */}
        <div className="relative min-h-0 flex-1">
          <div
            className="absolute inset-0"
            style={{ display: hubView === 'home' ? 'block' : 'none' }}
          >
            <HubHome />
          </div>
          <div
            className="absolute inset-0"
            style={{ display: hubView === 'browser' ? 'block' : 'none' }}
          >
            <BrowserView />
          </div>
          {appPanels
            .filter((p) => loaded.has(p.id))
            .map((p) => (
              <AppPanelView key={p.id} panel={p} active={hubView === p.id} />
            ))}
        </div>
      </div>

      {/* Add-app modal */}
      {adding && (
        <div
          className="absolute inset-0 z-10 flex items-start justify-center bg-black/40 backdrop-blur-sm"
          onMouseDown={() => setAdding(null)}
        >
          <div
            className="glass-strong mt-[20vh] w-full max-w-sm rounded-2xl border border-scout-border p-4 shadow-2xl shadow-black/50"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="mb-3 text-sm font-semibold">Add app</div>
            <label className="mb-1 block text-[11px] text-scout-faint">Name</label>
            <input
              value={adding.label}
              onChange={(e) => setAdding({ ...adding, label: e.target.value })}
              placeholder="WhatsApp"
              className="mb-3 h-9 w-full select-text rounded-lg border border-scout-border bg-scout-bg px-3 text-sm focus:border-scout-accent focus:outline-none"
            />
            <label className="mb-1 block text-[11px] text-scout-faint">URL</label>
            <input
              autoFocus
              value={adding.url}
              onChange={(e) => setAdding({ ...adding, url: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && saveAdd()}
              placeholder="web.whatsapp.com"
              spellCheck={false}
              className="mb-4 h-9 w-full select-text rounded-lg border border-scout-border bg-scout-bg px-3 text-sm focus:border-scout-accent focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setAdding(null)}
                className="rounded-lg border border-scout-border px-3 py-1.5 text-[13px] hover:bg-scout-surface-2"
              >
                Cancel
              </button>
              <button
                onClick={saveAdd}
                className="btn-gradient rounded-lg px-3.5 py-1.5 text-[13px] font-medium text-white"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
