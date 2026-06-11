import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Home,
  Search,
  X as XIcon,
  Clock,
  Layers,
  Columns2,
  ScanText,
  PictureInPicture2,
  Bookmark,
  BookmarkCheck,
  AppWindow,
  Check,
  PanelRight
} from 'lucide-react'
import { useAppStore, useActiveTab, useActiveWorkspace } from '../store/appStore'
import { useUiStore } from '../store/uiStore'
import { bookmarkActivePage } from '../lib/bookmark'
import { triggerPip } from '../lib/pip'
import { NEWTAB_URL, hostnameOf } from '../lib/url'
import DownloadsTray from './DownloadsTray'
import SitePermissions from './SitePermissions'

interface Suggestion {
  url: string
  title: string
  favicon?: string
  kind: 'history' | 'bookmark'
}

interface Props {
  rightOpen: boolean
  onToggleRight: () => void
  leftCollapsed: boolean
  onToggleLeft: () => void
}

function IconButton({
  children,
  title,
  onClick,
  active,
  disabled
}: {
  children: React.ReactNode
  title: string
  onClick?: () => void
  active?: boolean
  disabled?: boolean
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={[
        'app-no-drag flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
        disabled
          ? 'cursor-default text-scout-faint/40'
          : active
            ? 'bg-scout-accent-soft text-scout-accent'
            : 'text-scout-muted hover:bg-scout-surface-2 hover:text-scout-text'
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export default function TopBar({ rightOpen, onToggleRight }: Props): JSX.Element {
  const activeTab = useActiveTab()
  const nav = useAppStore((s) => (activeTab ? s.navStatus[activeTab.id] : undefined))
  const navigate = useAppStore((s) => s.navigate)
  const goBack = useAppStore((s) => s.goBack)
  const goForward = useAppStore((s) => s.goForward)
  const reload = useAppStore((s) => s.reload)
  const stop = useAppStore((s) => s.stop)
  const goHome = useAppStore((s) => s.goHome)
  const inspectMode = useUiStore((s) => s.inspectMode)
  const toggleInspect = useUiStore((s) => s.toggleInspect)
  const omniboxFocus = useUiStore((s) => s.omniboxFocus)
  const history = useAppStore((s) => s.history)
  const library = useAppStore((s) => s.library)
  const activeWorkspace = useActiveWorkspace()
  const splitTabId = useUiStore((s) => s.splitTabId)
  const setSplitTab = useUiStore((s) => s.setSplitTab)
  const appPanels = useAppStore((s) => s.appPanels)
  const addAppPanel = useAppStore((s) => s.addAppPanel)
  const [justPinned, setJustPinned] = useState(false)

  // Pin the current site as an always-available Hub app panel.
  const canPin = !!activeTab && activeTab.url !== NEWTAB_URL && /^https?:/i.test(activeTab.url)
  const originOf = (u: string): string => {
    try {
      return new URL(u).origin
    } catch {
      return ''
    }
  }
  const alreadyPinned =
    canPin && appPanels.some((p) => originOf(p.url) === originOf(activeTab!.url))
  const pinAsApp = (): void => {
    if (!canPin || !activeTab) return
    const origin = originOf(activeTab.url)
    if (origin && !appPanels.some((p) => originOf(p.url) === origin)) {
      addAppPanel(hostnameOf(activeTab.url).replace(/^www\./, ''), origin)
    }
    setJustPinned(true)
    setTimeout(() => setJustPinned(false), 1500)
  }

  const splitActive =
    !!splitTabId &&
    splitTabId !== activeWorkspace?.activeTabId &&
    !!activeWorkspace?.tabs.some((t) => t.id === splitTabId)

  const toggleSplit = (): void => {
    if (splitActive) {
      setSplitTab(null)
      return
    }
    const ws = activeWorkspace
    if (!ws || ws.tabs.length < 2) return
    const idx = ws.tabs.findIndex((t) => t.id === ws.activeTabId)
    const neighbor = ws.tabs[idx + 1] ?? ws.tabs[idx - 1]
    if (neighbor) setSplitTab(neighbor.id)
  }

  const [value, setValue] = useState('')
  const [editing, setEditing] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [sugIndex, setSugIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  // The dashboard tab has an internal URL; show a blank omnibox for it.
  const displayUrl = activeTab?.url === NEWTAB_URL ? '' : activeTab?.url ?? ''

  // Omnibox autocomplete from history (then bookmarks).
  const suggestions = useMemo<Suggestion[]>(() => {
    const v = value.trim().toLowerCase()
    if (!editing || !v || v === displayUrl.toLowerCase()) return []
    const seen = new Set<string>()
    const out: Suggestion[] = []
    const match = (s: string): boolean => s.toLowerCase().includes(v)
    for (const h of history) {
      if (out.length >= 6) break
      if (seen.has(h.url) || !match(h.title + ' ' + h.url)) continue
      seen.add(h.url)
      out.push({ url: h.url, title: h.title, favicon: h.favicon, kind: 'history' })
    }
    for (const b of library) {
      if (out.length >= 8) break
      if (seen.has(b.url) || !match(b.title + ' ' + b.url)) continue
      seen.add(b.url)
      out.push({ url: b.url, title: b.title, favicon: b.favicon, kind: 'bookmark' })
    }
    return out
  }, [value, editing, displayUrl, history, library])

  // Ctrl+L (and "new tab") pull focus to the omnibox.
  useEffect(() => {
    if (omniboxFocus > 0) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [omniboxFocus])

  const onBookmark = async (): Promise<void> => {
    const result = await bookmarkActivePage()
    if (result) {
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 1400)
    }
  }

  // Keep the omnibox in sync with the active tab's URL, but don't clobber what
  // the user is currently typing.
  useEffect(() => {
    if (!editing) setValue(displayUrl)
  }, [displayUrl, activeTab?.id, editing])

  // Reset the highlighted suggestion as the list changes.
  useEffect(() => {
    setSugIndex(-1)
  }, [value])

  const go = (url: string): void => {
    navigate(url)
    setEditing(false)
    inputRef.current?.blur()
  }

  const submit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (sugIndex >= 0 && suggestions[sugIndex]) go(suggestions[sugIndex].url)
    else go(value)
  }

  const onOmniKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSugIndex((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSugIndex((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Escape') {
      inputRef.current?.blur()
    }
  }

  const loading = nav?.loading ?? false
  const showSuggestions = editing && suggestions.length > 0

  return (
    <header className="app-drag glass flex h-12 items-center gap-1.5 border-b border-scout-border px-2.5">
      {/* Navigation cluster */}
      <div className="app-no-drag flex items-center gap-0.5">
        <IconButton title="Back" onClick={goBack} disabled={!nav?.canGoBack}>
          <ArrowLeft size={17} />
        </IconButton>
        <IconButton title="Forward" onClick={goForward} disabled={!nav?.canGoForward}>
          <ArrowRight size={17} />
        </IconButton>
        {loading ? (
          <IconButton title="Stop" onClick={stop}>
            <XIcon size={16} />
          </IconButton>
        ) : (
          <IconButton title="Refresh" onClick={reload} disabled={!activeTab}>
            <RotateCw size={16} />
          </IconButton>
        )}
        <IconButton title="Home" onClick={goHome}>
          <Home size={16} />
        </IconButton>
      </div>

      {/* Address bar (floating, with history autocomplete). Caps its width on
          large monitors and centres, but still shrinks on narrow windows. */}
      <div className="mx-2 flex flex-1 justify-center">
       <div className="app-no-drag relative w-full max-w-2xl">
        <form
          onSubmit={submit}
          className={[
            'focus-glow flex h-9 items-center gap-2.5 border border-scout-border bg-scout-bg px-3.5 shadow-sm shadow-black/20 transition-all focus-within:border-scout-accent',
            showSuggestions ? 'rounded-t-2xl rounded-b-none' : 'rounded-full'
          ].join(' ')}
        >
          <SitePermissions url={activeTab?.url ?? null} />
          <input
            ref={inputRef}
            spellCheck={false}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={(e) => {
              setEditing(true)
              e.target.select()
            }}
            onBlur={() => {
              setEditing(false)
              setValue(displayUrl)
            }}
            onKeyDown={onOmniKeyDown}
            placeholder="Search or enter a URL"
            className="h-full w-full select-text bg-transparent text-sm text-scout-text placeholder:text-scout-faint focus:outline-none"
          />
          {loading ? (
            <RotateCw size={14} className="shrink-0 animate-spin text-scout-accent" />
          ) : (
            <Search size={15} className="shrink-0 text-scout-faint" />
          )}
        </form>

        {showSuggestions && (
          <div className="absolute left-0 right-0 top-9 z-40 overflow-hidden rounded-b-2xl border border-t-0 border-scout-border bg-scout-bg shadow-xl shadow-black/40">
            {suggestions.map((sug, i) => (
              <button
                key={sug.url}
                // mousedown (not click) so it fires before the input blur hides us.
                onMouseDown={(e) => {
                  e.preventDefault()
                  go(sug.url)
                }}
                onMouseMove={() => setSugIndex(i)}
                className={[
                  'flex w-full items-center gap-2.5 px-3.5 py-2 text-left',
                  i === sugIndex ? 'bg-scout-surface-2' : 'hover:bg-scout-surface'
                ].join(' ')}
              >
                {sug.kind === 'bookmark' ? (
                  <Layers size={14} className="shrink-0 text-scout-faint" />
                ) : (
                  <Clock size={14} className="shrink-0 text-scout-faint" />
                )}
                <span className="truncate text-[13px] text-scout-text">{sug.title}</span>
                <span className="ml-auto shrink-0 truncate text-[11px] text-scout-faint">
                  {hostnameOf(sug.url)}
                </span>
              </button>
            ))}
          </div>
        )}
       </div>
      </div>

      {/* Tool cluster */}
      <div className="app-no-drag flex items-center gap-0.5">
        <IconButton
          title="Inspect & Scrape"
          onClick={toggleInspect}
          active={inspectMode}
          disabled={!activeTab}
        >
          <ScanText size={17} />
        </IconButton>
        <IconButton
          title={splitActive ? 'Exit split view' : 'Split view'}
          onClick={toggleSplit}
          active={splitActive}
          disabled={(activeWorkspace?.tabs.length ?? 0) < 2}
        >
          <Columns2 size={17} />
        </IconButton>
        <IconButton title="Picture-in-Picture" onClick={() => void triggerPip()} disabled={!activeTab}>
          <PictureInPicture2 size={17} />
        </IconButton>
        <IconButton
          title={justSaved ? 'Saved to Library' : 'Bookmark to Library'}
          onClick={() => void onBookmark()}
          active={justSaved}
          disabled={!activeTab}
        >
          {justSaved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
        </IconButton>
        <IconButton
          title={
            alreadyPinned
              ? 'Already in your apps'
              : justPinned
                ? 'Added to apps'
                : 'Pin site as app'
          }
          onClick={pinAsApp}
          active={justPinned || alreadyPinned}
          disabled={!canPin}
        >
          {justPinned ? <Check size={16} /> : <AppWindow size={17} />}
        </IconButton>
        <DownloadsTray />
        <IconButton title="Toggle notes" onClick={onToggleRight} active={rightOpen}>
          <PanelRight size={17} />
        </IconButton>
      </div>
    </header>
  )
}
