import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Layers,
  Search,
  Trash2,
  Globe,
  NotebookPen,
  X,
  ChevronDown,
  Check,
  Plus
} from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { useUiStore } from '../store/uiStore'
import { categoryStyle, PRESET_CATEGORIES } from '../lib/categorize'
import { hostnameOf } from '../lib/url'

interface Props {
  onClose: () => void
}

// Compact category dropdown (reassign / create custom) used on each card.
function CategoryPicker({
  value,
  onChange
}: {
  value: string
  onChange: (c: string) => void
}): JSX.Element {
  const library = useAppStore((s) => s.library)
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const options = useMemo(() => {
    const used = new Set(library.map((i) => i.category))
    const customs = [...used].filter((c) => !PRESET_CATEGORIES.includes(c as never)).sort()
    return [...PRESET_CATEGORIES, ...customs]
  }, [library])

  const style = categoryStyle(value)
  const choose = (c: string): void => {
    const v = c.trim()
    if (v) onChange(v)
    setCustom('')
    setOpen(false)
  }

  return (
    <div
      ref={ref}
      className="relative"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-scout-surface-2"
        title="Change category"
      >
        <span className={['h-1.5 w-1.5 rounded-full', style.dot].join(' ')} />
        <span className={['text-[11px] font-medium', style.text].join(' ')}>{value}</span>
        <ChevronDown size={10} className="text-scout-faint" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-40 overflow-hidden rounded-lg border border-scout-border bg-scout-surface-2 py-1 shadow-xl shadow-black/50">
          <div className="max-h-48 overflow-y-auto">
            {options.map((c) => {
              const st = categoryStyle(c)
              return (
                <button
                  key={c}
                  onClick={() => choose(c)}
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] hover:bg-scout-surface"
                >
                  <span className={['h-1.5 w-1.5 rounded-full', st.dot].join(' ')} />
                  <span className="flex-1 truncate">{c}</span>
                  {c === value && <Check size={12} className="text-scout-accent" />}
                </button>
              )
            })}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              choose(custom)
            }}
            className="mt-1 flex items-center gap-1.5 border-t border-scout-border px-2 pt-1.5"
          >
            <Plus size={12} className="text-scout-faint" />
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="New category…"
              className="h-6 w-full select-text bg-transparent text-[12px] placeholder:text-scout-faint focus:outline-none"
            />
          </form>
        </div>
      )}
    </div>
  )
}

export default function LibraryPanel({ onClose }: Props): JSX.Element {
  const library = useAppStore((s) => s.library)
  const removeLibraryItem = useAppStore((s) => s.removeLibraryItem)
  const setItemCategory = useAppStore((s) => s.setItemCategory)
  const addTab = useAppStore((s) => s.addTab)
  const setRightPanel = useUiStore((s) => s.setRightPanel)

  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<string>('All')

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const it of library) c[it.category] = (c[it.category] ?? 0) + 1
    return c
  }, [library])

  const chips = useMemo(() => {
    const used = new Set(library.map((i) => i.category))
    const presets = PRESET_CATEGORIES.filter((c) => used.has(c))
    const customs = [...used].filter((c) => !PRESET_CATEGORIES.includes(c as never)).sort()
    return ['All', ...presets, ...customs]
  }, [library])

  useEffect(() => {
    if (cat !== 'All' && !chips.includes(cat)) setCat('All')
  }, [chips, cat])

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    return library
      .filter((it) => (cat === 'All' ? true : it.category === cat))
      .filter((it) =>
        !q
          ? true
          : (it.title + ' ' + it.description + ' ' + it.url + ' ' + it.tags.join(' '))
              .toLowerCase()
              .includes(q)
      )
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [library, query, cat])

  return (
    <aside className="glass flex h-full w-[340px] shrink-0 flex-col border-l border-scout-border">
      {/* Header */}
      <div className="flex h-12 items-center gap-1.5 border-b border-scout-border px-3">
        <Layers size={17} className="text-scout-accent" />
        <span className="text-sm font-semibold">Visual Canvas</span>
        <span className="rounded-full bg-scout-surface-2 px-1.5 py-0.5 text-[10px] text-scout-muted">
          {library.length}
        </span>
        <button
          onClick={() => setRightPanel('notes')}
          className="ml-auto rounded-md p-1.5 text-scout-muted hover:bg-scout-surface-2 hover:text-scout-text"
          title="Back to notes"
        >
          <NotebookPen size={16} />
        </button>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-scout-muted hover:bg-scout-surface-2 hover:text-scout-text"
          title="Close panel"
        >
          <X size={16} />
        </button>
      </div>

      {/* Search */}
      <div className="border-b border-scout-border p-2">
        <div className="flex h-8 items-center gap-2 rounded-lg border border-scout-border bg-scout-bg px-2.5">
          <Search size={14} className="text-scout-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search bookmarks"
            className="h-full w-full select-text bg-transparent text-[13px] placeholder:text-scout-faint focus:outline-none"
          />
        </div>
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-1 border-b border-scout-border px-2 py-2">
        {chips.map((c) => {
          const active = cat === c
          const count = c === 'All' ? library.length : counts[c] ?? 0
          const st = c === 'All' ? null : categoryStyle(c)
          return (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={[
                'flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                active
                  ? 'bg-scout-accent-soft text-scout-accent'
                  : 'text-scout-muted hover:bg-scout-surface-2 hover:text-scout-text'
              ].join(' ')}
            >
              {st && <span className={['h-1.5 w-1.5 rounded-full', st.dot].join(' ')} />}
              {c}
              <span className="text-scout-faint">{count}</span>
            </button>
          )
        })}
      </div>

      {/* List */}
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-scout-faint">
            <Layers size={28} />
            <p className="text-xs">
              {library.length === 0
                ? 'No bookmarks yet — hit the bookmark icon to capture a page.'
                : 'No matches.'}
            </p>
          </div>
        ) : (
          items.map((it) => {
            const style = categoryStyle(it.category)
            return (
              <div
                key={it.id}
                onClick={() => addTab(undefined, it.url)}
                className="group/card flex cursor-default gap-2.5 rounded-lg p-1.5 hover:bg-scout-surface-2"
              >
                {/* Thumbnail */}
                <div className="relative h-12 w-[68px] shrink-0 overflow-hidden rounded-md bg-scout-surface-2">
                  {it.thumbnail ? (
                    <img src={it.thumbnail} className="h-full w-full object-cover object-top" />
                  ) : (
                    <div className={['flex h-full w-full items-center justify-center', style.bg].join(' ')}>
                      {it.favicon ? (
                        <img src={it.favicon} className="h-5 w-5 rounded" />
                      ) : (
                        <Globe size={16} className={style.text} />
                      )}
                    </div>
                  )}
                </div>
                {/* Meta */}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-start gap-1">
                    <span className="line-clamp-2 flex-1 text-[12.5px] font-medium leading-snug">
                      {it.title}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeLibraryItem(it.id)
                      }}
                      className="rounded p-0.5 text-scout-faint opacity-0 hover:text-scout-pink group-hover/card:opacity-100"
                      title="Remove"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CategoryPicker
                      value={it.category}
                      onChange={(c) => setItemCategory(it.id, c)}
                    />
                    <span className="ml-auto truncate text-[10.5px] text-scout-faint">
                      {hostnameOf(it.url)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}
