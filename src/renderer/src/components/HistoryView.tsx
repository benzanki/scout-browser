import { useMemo, useState } from 'react'
import { History as HistoryIcon, Search, X, Trash2, Globe } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { useUiStore } from '../store/uiStore'
import { hostnameOf } from '../lib/url'
import type { HistoryEntry } from '../../../shared/types'

function dayLabel(ts: number): string {
  const d = new Date(ts)
  const today = new Date()
  const yest = new Date()
  yest.setDate(today.getDate() - 1)
  const same = (a: Date, b: Date): boolean => a.toDateString() === b.toDateString()
  if (same(d, today)) return 'Today'
  if (same(d, yest)) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

export default function HistoryView(): JSX.Element | null {
  const open = useUiStore((s) => s.historyOpen)
  const close = useUiStore((s) => s.closeHistory)
  const history = useAppStore((s) => s.history)
  const clearHistory = useAppStore((s) => s.clearHistory)
  const removeHistory = useAppStore((s) => s.removeHistory)
  const addTab = useAppStore((s) => s.addTab)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Filter + group by day (preserving recency order).
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? history.filter((h) => (h.title + ' ' + h.url).toLowerCase().includes(q))
      : history
    const out: { label: string; items: HistoryEntry[] }[] = []
    for (const h of filtered) {
      const label = dayLabel(h.visitedAt)
      const last = out[out.length - 1]
      if (last && last.label === label) last.items.push(h)
      else out.push({ label, items: [h] })
    }
    return out
  }, [history, query])

  if (!open) return null

  const openEntry = (url: string): void => {
    addTab(undefined, url)
    close()
  }

  const toggleSel = (id: string): void =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const deleteSelected = (): void => {
    removeHistory([...selected])
    setSelected(new Set())
  }

  const selecting = selected.size > 0

  return (
    <div className="aurora-bg absolute inset-0 z-40 flex flex-col">
      <div className="flex h-14 items-center gap-3 border-b border-scout-border px-5">
        <HistoryIcon size={19} className="text-scout-accent" />
        <span className="text-base font-semibold">History</span>
        <span className="rounded-full bg-scout-surface-2 px-2 py-0.5 text-[11px] text-scout-muted">
          {history.length}
        </span>
        <div className="ml-4 flex h-9 w-72 items-center gap-2 rounded-xl border border-scout-border bg-scout-surface px-3 focus-within:border-scout-accent">
          <Search size={15} className="text-scout-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search history"
            className="h-full w-full select-text bg-transparent text-sm placeholder:text-scout-faint focus:outline-none"
          />
        </div>

        {selecting ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={deleteSelected}
              className="flex items-center gap-1.5 rounded-lg bg-scout-pink/15 px-2.5 py-1.5 text-[12px] text-scout-pink hover:bg-scout-pink/25"
            >
              <Trash2 size={14} /> Delete {selected.size}
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="rounded-lg px-2.5 py-1.5 text-[12px] text-scout-muted hover:bg-scout-surface-2 hover:text-scout-text"
            >
              Cancel
            </button>
          </div>
        ) : (
          history.length > 0 && (
            <button
              onClick={() => clearHistory()}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] text-scout-muted hover:bg-scout-surface-2 hover:text-scout-pink"
              title="Clear all history"
            >
              <Trash2 size={14} /> Clear all
            </button>
          )
        )}
        <button
          onClick={close}
          className="ml-auto rounded-lg p-2 text-scout-muted hover:bg-scout-surface-2 hover:text-scout-text"
          title="Close"
        >
          <X size={18} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {groups.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-scout-faint">
            <HistoryIcon size={36} />
            <p className="text-sm">{history.length === 0 ? 'No history yet' : 'No matches'}</p>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl">
            {groups.map((g) => (
              <div key={g.label} className="mb-5">
                <div className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-scout-faint">
                  {g.label}
                </div>
                <div className="flex flex-col">
                  {g.items.map((h) => (
                    <div
                      key={h.id}
                      className="group flex items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-scout-surface-2"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(h.id)}
                        onChange={() => toggleSel(h.id)}
                        className={`h-3.5 w-3.5 shrink-0 cursor-pointer accent-scout-accent ${
                          selecting ? '' : 'opacity-0 group-hover:opacity-100'
                        }`}
                      />
                      <button
                        onClick={() => openEntry(h.url)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        {h.favicon ? (
                          <img src={h.favicon} className="h-4 w-4 shrink-0 rounded-sm" />
                        ) : (
                          <Globe size={15} className="shrink-0 text-scout-faint" />
                        )}
                        <span className="w-[42%] shrink-0 truncate text-[13px]">{h.title}</span>
                        <span className="flex-1 truncate text-[12px] text-scout-faint">
                          {hostnameOf(h.url)}
                        </span>
                        <span className="shrink-0 text-[11px] tabular-nums text-scout-faint">
                          {new Date(h.visitedAt).toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </button>
                      <button
                        onClick={() => removeHistory([h.id])}
                        title="Delete from history"
                        className="shrink-0 rounded p-1 text-scout-faint opacity-0 hover:text-scout-pink group-hover:opacity-100"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
