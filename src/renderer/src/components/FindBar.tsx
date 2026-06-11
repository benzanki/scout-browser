import { useEffect, useRef, useState } from 'react'
import { ChevronUp, ChevronDown, X } from 'lucide-react'
import { useUiStore } from '../store/uiStore'
import { useActiveTab } from '../store/appStore'
import { getWebview } from '../lib/webviewRegistry'

// Ctrl+F find-in-page, driven by the active webview's findInPage/stopFindInPage.
export default function FindBar(): JSX.Element | null {
  const open = useUiStore((s) => s.findOpen)
  const close = useUiStore((s) => s.closeFind)
  const activeTab = useActiveTab()
  const [query, setQuery] = useState('')
  const [result, setResult] = useState({ active: 0, total: 0 })
  const inputRef = useRef<HTMLInputElement>(null)
  const wasOpen = useRef(false)

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.select())
  }, [open])

  // Track match counts reported by the webview.
  useEffect(() => {
    if (!open || !activeTab) return
    const wv = getWebview(activeTab.id)
    if (!wv) return
    const onFound = (e: Event): void => {
      const r = (e as unknown as { result?: { activeMatchOrdinal: number; matches: number } }).result
      if (r) setResult({ active: r.activeMatchOrdinal, total: r.matches })
    }
    wv.addEventListener('found-in-page', onFound)
    return () => wv.removeEventListener('found-in-page', onFound)
  }, [open, activeTab?.id])

  // Clear the page highlight when the bar transitions from open → closed.
  // (Guard against running on initial mount, when the webview may not yet be
  // dom-ready — calling stopFindInPage too early throws.)
  useEffect(() => {
    if (open) {
      wasOpen.current = true
      return
    }
    if (!wasOpen.current) return
    wasOpen.current = false
    if (activeTab) {
      try {
        getWebview(activeTab.id)?.stopFindInPage('clearSelection')
      } catch {
        /* webview not ready */
      }
    }
    setResult({ active: 0, total: 0 })
  }, [open, activeTab?.id])

  if (!open) return null

  const search = (forward: boolean, findNext: boolean): void => {
    const wv = activeTab ? getWebview(activeTab.id) : undefined
    if (!wv) return
    try {
      if (!query) {
        wv.stopFindInPage('clearSelection')
        setResult({ active: 0, total: 0 })
        return
      }
      wv.findInPage(query, { forward, findNext })
    } catch {
      /* webview not ready */
    }
  }

  return (
    <div className="absolute right-4 top-2 z-30 flex items-center gap-1 rounded-xl border border-scout-border bg-scout-surface/95 p-1 shadow-lg shadow-black/40 backdrop-blur">
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          // Restart the search on each keystroke.
          requestAnimationFrame(() => search(true, false))
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            search(!e.shiftKey, true)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            close()
          }
        }}
        placeholder="Find in page"
        className="h-7 w-48 select-text bg-transparent px-2 text-[13px] placeholder:text-scout-faint focus:outline-none"
      />
      <span className="min-w-[44px] px-1 text-center text-[11px] tabular-nums text-scout-faint">
        {result.total ? `${result.active}/${result.total}` : query ? '0/0' : ''}
      </span>
      <button
        onClick={() => search(false, true)}
        className="rounded-md p-1 text-scout-muted hover:bg-scout-surface-2 hover:text-scout-text"
        title="Previous (Shift+Enter)"
      >
        <ChevronUp size={15} />
      </button>
      <button
        onClick={() => search(true, true)}
        className="rounded-md p-1 text-scout-muted hover:bg-scout-surface-2 hover:text-scout-text"
        title="Next (Enter)"
      >
        <ChevronDown size={15} />
      </button>
      <button
        onClick={close}
        className="rounded-md p-1 text-scout-muted hover:bg-scout-surface-2 hover:text-scout-text"
        title="Close (Esc)"
      >
        <X size={15} />
      </button>
    </div>
  )
}
