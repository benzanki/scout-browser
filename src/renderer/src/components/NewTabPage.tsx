import { useMemo, useState } from 'react'
import { Search, Globe, FileText, Layers, Clock, Plus, Pencil, X, VenetianMask } from 'lucide-react'
import AppIcon from './AppIcon'
import { useAppStore } from '../store/appStore'
import { useUiStore } from '../store/uiStore'
import { hostnameOf } from '../lib/url'
import logo from '../assets/logo.png'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Late night'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function normalizeUrl(raw: string): string {
  const u = raw.trim()
  if (!u) return ''
  return /^https?:\/\//i.test(u) ? u : `https://${u}`
}

interface Editing {
  id?: string
  label: string
  url: string
}

export default function NewTabPage({ isPrivate = false }: { isPrivate?: boolean }): JSX.Element {
  const notes = useAppStore((s) => s.notes)
  const library = useAppStore((s) => s.library)
  const shortcuts = useAppStore((s) => s.shortcuts)
  const navigate = useAppStore((s) => s.navigate)
  const setActiveNote = useAppStore((s) => s.setActiveNote)
  const addShortcut = useAppStore((s) => s.addShortcut)
  const updateShortcut = useAppStore((s) => s.updateShortcut)
  const removeShortcut = useAppStore((s) => s.removeShortcut)
  const setRightOpen = useUiStore((s) => s.setRightOpen)
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Editing | null>(null)

  const recentNotes = useMemo(
    () => [...notes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5),
    [notes]
  )
  const recentBookmarks = useMemo(
    () => [...library].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5),
    [library]
  )

  const saveEditing = (): void => {
    if (!editing) return
    const url = normalizeUrl(editing.url)
    if (!url) return
    const label = editing.label.trim() || hostnameOf(url)
    if (editing.id) updateShortcut(editing.id, label, url)
    else addShortcut(label, url)
    setEditing(null)
  }

  return (
    <div className="absolute inset-0 overflow-y-auto">
      <div className="fade-up mx-auto flex min-h-full w-full max-w-3xl flex-col px-6 py-[8vh]">
        {/* Brand + greeting (or a private-browsing header) */}
        {isPrivate ? (
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-scout-purple/15">
              <VenetianMask size={32} className="text-scout-purple" />
            </div>
            <h1 className="mt-4 text-xl font-semibold">You’re browsing privately</h1>
            <p className="mt-1.5 max-w-md text-sm text-scout-muted">
              Pages you visit won’t be saved to history, and cookies &amp; site data are
              cleared when you close Scout. Downloads and bookmarks are still kept.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <img
              src={logo}
              alt="Scout"
              className="w-[300px] max-w-full select-none drop-shadow-[0_0_28px_rgba(123,140,255,0.35)]"
              draggable={false}
            />
            <p className="mt-2 text-sm text-scout-muted">{greeting()} — where to?</p>
          </div>
        )}

        {/* Search */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (q.trim()) navigate(q)
          }}
          className="glass focus-glow mt-6 flex h-12 items-center gap-3 rounded-full border border-scout-border px-5 shadow-lg shadow-black/30 transition-all focus-within:border-scout-accent"
        >
          <Search size={18} className="shrink-0 text-scout-faint" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the web or enter a URL"
            spellCheck={false}
            className="h-full w-full select-text bg-transparent text-[15px] text-scout-text placeholder:text-scout-faint focus:outline-none"
          />
        </form>

        {!isPrivate && (
          <>
        {/* Editable shortcut tiles */}
        <div className="mt-7 grid grid-cols-4 gap-2.5">
          {shortcuts.map((s) => (
            <div key={s.id} className="group/sc relative">
              <div
                onClick={() => navigate(s.url)}
                className="glass-card flex cursor-default flex-col items-center gap-2 rounded-xl px-2 py-4 hover:-translate-y-0.5"
              >
                <AppIcon label={s.label || hostnameOf(s.url)} url={s.url} size={36} />
                <span className="w-full truncate text-center text-[11.5px] text-scout-muted">
                  {s.label || hostnameOf(s.url)}
                </span>
              </div>
              {/* hover controls */}
              <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition-opacity group-hover/sc:opacity-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditing({ id: s.id, label: s.label, url: s.url })
                  }}
                  className="rounded bg-scout-bg/70 p-1 text-scout-faint backdrop-blur hover:text-scout-text"
                  title="Edit"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removeShortcut(s.id)
                  }}
                  className="rounded bg-scout-bg/70 p-1 text-scout-faint backdrop-blur hover:text-scout-pink"
                  title="Remove"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          ))}
          {/* add tile */}
          <button
            onClick={() => setEditing({ label: '', url: '' })}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-scout-border px-2 py-4 text-scout-faint transition-colors hover:border-scout-accent hover:text-scout-muted"
          >
            <Plus size={18} />
            <span className="text-[11.5px]">Add</span>
          </button>
        </div>

        {/* Recent notes & bookmarks */}
        {(recentNotes.length > 0 || recentBookmarks.length > 0) && (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {recentNotes.length > 0 && (
              <section>
                <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-scout-faint">
                  <FileText size={13} /> Recent notes
                </div>
                <div className="flex flex-col gap-0.5">
                  {recentNotes.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        if (n.url) navigate(n.url)
                        setActiveNote(n.id)
                        setRightOpen(true)
                      }}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-scout-surface-2"
                    >
                      <FileText size={14} className="shrink-0 text-scout-purple" />
                      <span className="truncate text-[13px]">{n.title}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
            {recentBookmarks.length > 0 && (
              <section>
                <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-scout-faint">
                  <Layers size={13} /> Recent bookmarks
                </div>
                <div className="flex flex-col gap-0.5">
                  {recentBookmarks.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => navigate(b.url)}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-scout-surface-2"
                    >
                      {b.favicon ? (
                        <img src={b.favicon} className="h-3.5 w-3.5 shrink-0 rounded-sm" />
                      ) : (
                        <Globe size={14} className="shrink-0 text-scout-faint" />
                      )}
                      <span className="truncate text-[13px]">{b.title}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {notes.length === 0 && library.length === 0 && (
          <div className="mt-10 flex items-center justify-center gap-2 text-xs text-scout-faint">
            <Clock size={13} /> Your recent sites and notes will show up here.
          </div>
        )}
          </>
        )}
      </div>

      {/* Shortcut editor */}
      {editing && (
        <div
          className="absolute inset-0 z-20 flex items-start justify-center bg-black/40 backdrop-blur-sm"
          onMouseDown={() => setEditing(null)}
        >
          <div
            className="glass-strong mt-[22vh] w-full max-w-sm rounded-2xl border border-scout-border p-4 shadow-2xl shadow-black/50"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="mb-3 text-sm font-semibold">
              {editing.id ? 'Edit shortcut' : 'New shortcut'}
            </div>
            <label className="mb-1 block text-[11px] text-scout-faint">Name</label>
            <input
              value={editing.label}
              onChange={(e) => setEditing({ ...editing, label: e.target.value })}
              placeholder="GitHub"
              className="mb-3 h-9 w-full select-text rounded-lg border border-scout-border bg-scout-bg px-3 text-sm focus:border-scout-accent focus:outline-none"
            />
            <label className="mb-1 block text-[11px] text-scout-faint">URL</label>
            <input
              autoFocus
              value={editing.url}
              onChange={(e) => setEditing({ ...editing, url: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && saveEditing()}
              placeholder="github.com"
              spellCheck={false}
              className="mb-4 h-9 w-full select-text rounded-lg border border-scout-border bg-scout-bg px-3 text-sm focus:border-scout-accent focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                className="rounded-lg border border-scout-border px-3 py-1.5 text-[13px] hover:bg-scout-surface-2"
              >
                Cancel
              </button>
              <button
                onClick={saveEditing}
                className="rounded-lg bg-scout-accent px-3.5 py-1.5 text-[13px] font-medium text-white hover:brightness-110"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
