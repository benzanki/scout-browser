import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Search,
  Globe,
  ArrowRight,
  Layers,
  SquareStack,
  FileText,
  NotebookPen,
  ScanText,
  PanelRight,
  Plus,
  RotateCw,
  Home,
  Bookmark,
  PictureInPicture2,
  History,
  Settings as SettingsIcon,
  Clock,
  LayoutGrid,
  CornerDownLeft,
  VenetianMask,
  type LucideIcon
} from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { useUiStore } from '../store/uiStore'
import { normalizeInput, hostnameOf, prettyUrl } from '../lib/url'
import { bookmarkActivePage } from '../lib/bookmark'
import { triggerPip } from '../lib/pip'
import { isElectron } from '../lib/env'

type Group = 'Navigate' | 'Actions' | 'Workspaces' | 'Tabs' | 'History' | 'Notes'

interface Item {
  id: string
  title: string
  subtitle?: string
  icon: LucideIcon
  iconClass?: string
  group: Group
  keywords?: string
  perform: () => void
}

const GROUP_ORDER: Group[] = ['Navigate', 'Actions', 'Workspaces', 'Tabs', 'History', 'Notes']

export default function CommandPalette(): JSX.Element | null {
  const open = useUiStore((s) => s.paletteOpen)
  const togglePalette = useUiStore((s) => s.togglePalette)
  const closePalette = useUiStore((s) => s.closePalette)
  const setRightOpen = useUiStore((s) => s.setRightOpen)
  const toggleRight = useUiStore((s) => s.toggleRight)
  const setInspectMode = useUiStore((s) => s.setInspectMode)
  const openLibrary = useUiStore((s) => s.openLibrary)
  const openSettings = useUiStore((s) => s.openSettings)
  const openHistory = useUiStore((s) => s.openHistory)
  const openBriefing = useUiStore((s) => s.openBriefing)

  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // In the browser preview there's no main process, so the palette owns Ctrl+K.
  // In Electron the main process routes 'palette' (so it also works over a
  // focused <webview>), and this listener is skipped to avoid double-toggling.
  useEffect(() => {
    if (isElectron) return
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        togglePalette()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePalette])

  // Reset transient state each time the palette opens.
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(0)
      // Focus after the element mounts.
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const items = useMemo<Item[]>(() => {
    if (!open) return []
    const s = useAppStore.getState()
    const q = query.trim()
    const list: Item[] = []

    // 1) Quick-jump / search from the query itself.
    if (q) {
      const url = normalizeInput(q)
      const isSearch = url.startsWith('https://www.google.com/search')
      list.push({
        id: 'jump',
        group: 'Navigate',
        icon: isSearch ? Search : Globe,
        title: isSearch ? `Search Google for “${q}”` : `Go to ${prettyUrl(url)}`,
        subtitle: isSearch ? undefined : url,
        keywords: 'open url go navigate search',
        perform: () => s.navigate(q)
      })
    }

    // 2) Static actions.
    list.push(
      {
        id: 'new-note',
        group: 'Actions',
        icon: NotebookPen,
        title: 'New markdown note',
        keywords: 'create note scratch markdown',
        perform: () => {
          s.createNote({ url: null, title: 'Untitled note' })
          setRightOpen(true)
        }
      },
      {
        id: 'new-tab',
        group: 'Actions',
        icon: Plus,
        title: 'New tab',
        keywords: 'open tab',
        perform: () => s.addTab()
      },
      {
        id: 'new-private-tab',
        group: 'Actions',
        icon: VenetianMask,
        title: 'New private tab',
        keywords: 'incognito private tab browsing hidden',
        perform: () => s.addTab(undefined, undefined, true)
      },
      {
        id: 'inspect',
        group: 'Actions',
        icon: ScanText,
        title: 'Toggle Inspect & Scrape mode',
        keywords: 'scrape extract inspect element picker data table',
        perform: () => setInspectMode(true)
      },
      {
        id: 'bookmark',
        group: 'Actions',
        icon: Bookmark,
        title: 'Bookmark this page to Library',
        keywords: 'bookmark save library canvas capture',
        perform: () => void bookmarkActivePage()
      },
      {
        id: 'library',
        group: 'Actions',
        icon: Layers,
        title: 'Open Visual Canvas',
        keywords: 'library bookmarks visual canvas grid',
        perform: () => openLibrary()
      },
      {
        id: 'briefing',
        group: 'Actions',
        icon: FileText,
        title: 'Export research briefing',
        keywords: 'briefing export report research notes bookmarks markdown',
        perform: () => openBriefing()
      },
      {
        id: 'pip',
        group: 'Actions',
        icon: PictureInPicture2,
        title: 'Picture-in-Picture this page',
        keywords: 'pip picture in picture float video popout',
        perform: () => void triggerPip()
      },
      {
        id: 'toggle-notes',
        group: 'Actions',
        icon: PanelRight,
        title: 'Toggle notes panel',
        keywords: 'scratchpad notes sidebar',
        perform: () => toggleRight()
      },
      {
        id: 'reload',
        group: 'Actions',
        icon: RotateCw,
        title: 'Reload page',
        keywords: 'refresh reload',
        perform: () => s.reload()
      },
      {
        id: 'home',
        group: 'Actions',
        icon: Home,
        title: 'Go home',
        keywords: 'home start',
        perform: () => s.goHome()
      },
      {
        id: 'history-view',
        group: 'Actions',
        icon: History,
        title: 'Open History',
        keywords: 'history log visited recent',
        perform: () => openHistory()
      },
      {
        id: 'settings',
        group: 'Actions',
        icon: SettingsIcon,
        title: 'Open Settings',
        keywords: 'settings preferences search engine homepage',
        perform: () => openSettings()
      }
    )

    // 3) Switch workspace (session stacks).
    for (const w of s.workspaces) {
      list.push({
        id: `ws-${w.id}`,
        group: 'Workspaces',
        icon: LayoutGrid,
        iconClass: w.color,
        title: `Switch to ${w.name}`,
        subtitle: `${w.tabs.length} tab${w.tabs.length === 1 ? '' : 's'}`,
        keywords: 'workspace session switch ' + w.name,
        perform: () => s.setActiveWorkspace(w.id)
      })
    }

    // 4) Open tabs across all workspaces (history / session search).
    for (const w of s.workspaces) {
      for (const t of w.tabs) {
        list.push({
          id: `tab-${t.id}`,
          group: 'Tabs',
          icon: SquareStack,
          title: t.title || 'New Tab',
          subtitle: `${w.name} · ${hostnameOf(t.url)}`,
          keywords: `${t.title} ${t.url} ${w.name}`,
          perform: () => {
            s.setActiveWorkspace(w.id)
            s.setActiveTab(t.id)
          }
        })
      }
    }

    // 5) History — show recent entries by default, all of them when searching.
    const histSource = q ? s.history : s.history.slice(0, 6)
    for (const h of histSource) {
      list.push({
        id: `hist-${h.id}`,
        group: 'History',
        icon: Clock,
        title: h.title,
        subtitle: hostnameOf(h.url),
        keywords: `${h.title} ${h.url}`,
        perform: () => s.navigate(h.url)
      })
    }

    // 6) Notes.
    for (const n of s.notes) {
      list.push({
        id: `note-${n.id}`,
        group: 'Notes',
        icon: FileText,
        title: n.title,
        subtitle: n.url ? hostnameOf(n.url) : 'Unlinked',
        keywords: `${n.title} ${n.body} ${n.url ?? ''}`,
        perform: () => {
          if (n.url) s.navigate(n.url)
          s.setActiveNote(n.id)
          setRightOpen(true)
        }
      })
    }

    return list
  }, [open, query, setRightOpen, toggleRight, setInspectMode, openLibrary, openSettings, openHistory, openBriefing])

  // Filter + keep group ordering.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matched = q
      ? items.filter((it) => {
          const hay = (it.title + ' ' + (it.subtitle ?? '') + ' ' + (it.keywords ?? '')).toLowerCase()
          return hay.includes(q)
        })
      : items
    // Always keep the live quick-jump item on top.
    return matched.sort((a, b) => {
      if (a.id === 'jump') return -1
      if (b.id === 'jump') return 1
      return GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group)
    })
  }, [items, query])

  // Keep selection in range as results change.
  useEffect(() => {
    setSelected((i) => Math.min(i, Math.max(0, filtered.length - 1)))
  }, [filtered.length])

  // Groups/actions that act on web content — surface the browser view first.
  const BROWSER_GROUPS = new Set<Group>([
    'Navigate',
    'Workspaces',
    'Tabs',
    'History',
    'Notes'
  ])
  const BROWSER_ACTIONS = new Set(['new-tab', 'new-private-tab', 'new-note', 'inspect', 'bookmark'])

  const run = (item: Item | undefined): void => {
    if (!item) return
    if (BROWSER_GROUPS.has(item.group) || BROWSER_ACTIONS.has(item.id)) {
      useUiStore.getState().setHubView('browser')
    }
    item.perform()
    closePalette()
  }

  if (!open) return null

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      closePalette()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      run(filtered[selected])
    }
  }

  // Render flat list but inject group headers when the group changes.
  let lastGroup: Group | null = null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm"
      onMouseDown={closePalette}
    >
      <div
        className="glass-strong mt-[12vh] w-full max-w-[640px] overflow-hidden rounded-2xl border border-scout-border shadow-2xl shadow-black/50"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-scout-border px-4">
          <Search size={18} className="shrink-0 text-scout-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelected(0)
            }}
            placeholder="Search tabs, notes, workspaces — or type a URL…"
            className="h-14 w-full select-text bg-transparent text-[15px] text-scout-text placeholder:text-scout-faint focus:outline-none"
            spellCheck={false}
          />
          <kbd className="shrink-0 rounded border border-scout-border bg-scout-bg px-1.5 py-0.5 text-[10px] text-scout-faint">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-1.5">
          {filtered.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-scout-faint">
              No matches for “{query}”
            </div>
          )}
          {filtered.map((item, idx) => {
            const showHeader = item.group !== lastGroup
            lastGroup = item.group
            const Icon = item.icon
            const active = idx === selected
            return (
              <div key={item.id}>
                {showHeader && (
                  <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-scout-faint">
                    {item.group}
                  </div>
                )}
                <button
                  onMouseMove={() => setSelected(idx)}
                  onClick={() => run(item)}
                  className={[
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left',
                    active ? 'bg-scout-accent-soft' : 'hover:bg-scout-surface-2'
                  ].join(' ')}
                >
                  <Icon
                    size={17}
                    className={
                      item.iconClass ?? (active ? 'text-scout-accent' : 'text-scout-muted')
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] text-scout-text">
                      {item.title}
                    </div>
                    {item.subtitle && (
                      <div className="truncate text-[11.5px] text-scout-faint">
                        {item.subtitle}
                      </div>
                    )}
                  </div>
                  {active && (
                    <CornerDownLeft size={14} className="shrink-0 text-scout-faint" />
                  )}
                </button>
              </div>
            )
          })}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-3 border-t border-scout-border px-4 py-2 text-[11px] text-scout-faint">
          <span className="flex items-center gap-1">
            <ArrowRight size={12} className="rotate-90" /> navigate
          </span>
          <span className="flex items-center gap-1">
            <CornerDownLeft size={12} /> select
          </span>
          <span className="ml-auto flex items-center gap-1">
            <Layers size={12} /> Scout Command
          </span>
        </div>
      </div>
    </div>
  )
}
