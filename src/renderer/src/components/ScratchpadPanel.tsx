import { useEffect, useMemo, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { EditorView } from '@codemirror/view'
import {
  NotebookPen,
  Link2,
  Link2Off,
  Plus,
  X,
  ListTree,
  Search,
  Trash2,
  Layers,
  FileText
} from 'lucide-react'
import { useAppStore, useActiveTab } from '../store/appStore'
import { useUiStore } from '../store/uiStore'
import { scoutCmTheme } from '../lib/cmTheme'
import { hostnameOf } from '../lib/url'

interface Props {
  onClose: () => void
}

const cmExtensions = [
  markdown({ base: markdownLanguage, codeLanguages: languages }),
  EditorView.lineWrapping,
  // Browser spellcheck (red squiggles) in the notes editor.
  EditorView.contentAttributes.of({ spellcheck: 'true', autocapitalize: 'on' })
]

const cmBasicSetup = {
  lineNumbers: false,
  foldGutter: false,
  highlightActiveLine: false,
  highlightActiveLineGutter: false,
  autocompletion: false,
  searchKeymap: false as const
}

function relativeTime(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

export default function ScratchpadPanel({ onClose }: Props): JSX.Element {
  const activeTab = useActiveTab()
  const url = activeTab?.url ?? null
  const notes = useAppStore((s) => s.notes)
  const activeNoteId = useAppStore((s) => s.activeNoteId)
  const setActiveNote = useAppStore((s) => s.setActiveNote)
  const createNote = useAppStore((s) => s.createNote)
  const updateNoteBody = useAppStore((s) => s.updateNoteBody)
  const deleteNote = useAppStore((s) => s.deleteNote)
  const navigate = useAppStore((s) => s.navigate)
  const openLibrary = useUiStore((s) => s.openLibrary)

  const [showList, setShowList] = useState(false)
  const [query, setQuery] = useState('')

  const current = useMemo(() => {
    if (activeNoteId) return notes.find((n) => n.id === activeNoteId) ?? null
    return notes.find((n) => n.url != null && n.url === url) ?? null
  }, [activeNoteId, notes, url])

  useEffect(() => {
    setActiveNote(null)
  }, [activeTab?.id, url, setActiveNote])

  const onChange = (value: string): void => {
    if (current) {
      updateNoteBody(current.id, value)
    } else if (value.trim().length) {
      createNote({
        url,
        title: activeTab?.title || (url ? hostnameOf(url) : 'Untitled note'),
        body: value
      })
    }
  }

  const openNote = (id: string): void => {
    const note = notes.find((n) => n.id === id)
    if (note?.url) navigate(note.url)
    setActiveNote(id)
    setShowList(false)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...notes].sort((a, b) => b.updatedAt - a.updatedAt)
    if (!q) return sorted
    return sorted.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        (n.url ?? '').toLowerCase().includes(q)
    )
  }, [notes, query])

  const body = current?.body ?? ''
  const words = body.trim() ? body.trim().split(/\s+/).length : 0
  const linkedHost = current?.url ? hostnameOf(current.url) : url ? hostnameOf(url) : null

  return (
    <aside className="glass flex h-full w-[340px] shrink-0 flex-col border-l border-scout-border">
      {/* Header */}
      <div className="flex h-12 items-center gap-1.5 border-b border-scout-border px-3">
        <NotebookPen size={17} className="text-scout-purple" />
        <span className="mr-auto truncate text-sm font-semibold">
          {showList ? 'All Notes' : current?.title || 'Scratchpad'}
        </span>
        <button
          onClick={() => setShowList((v) => !v)}
          className={[
            'rounded-md p-1.5',
            showList
              ? 'bg-scout-accent-soft text-scout-accent'
              : 'text-scout-muted hover:bg-scout-surface-2 hover:text-scout-text'
          ].join(' ')}
          title="Browse all notes"
        >
          <ListTree size={16} />
        </button>
        <button
          onClick={() => {
            createNote({ url: null, title: 'Untitled note' })
            setShowList(false)
          }}
          className="rounded-md p-1.5 text-scout-muted hover:bg-scout-surface-2 hover:text-scout-text"
          title="New note"
        >
          <Plus size={16} />
        </button>
        <button
          onClick={openLibrary}
          className="rounded-md p-1.5 text-scout-muted hover:bg-scout-surface-2 hover:text-scout-text"
          title="Visual Canvas (bookmarks)"
        >
          <Layers size={16} />
        </button>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-scout-muted hover:bg-scout-surface-2 hover:text-scout-text"
          title="Close panel"
        >
          <X size={16} />
        </button>
      </div>

      {showList ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-scout-border p-2">
            <div className="flex h-8 items-center gap-2 rounded-lg border border-scout-border bg-scout-bg px-2.5">
              <Search size={14} className="text-scout-faint" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notes"
                className="h-full w-full select-text bg-transparent text-[13px] placeholder:text-scout-faint focus:outline-none"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {filtered.length === 0 && (
              <div className="px-3 py-8 text-center text-xs text-scout-faint">
                {notes.length === 0 ? 'No notes yet' : 'No matches'}
              </div>
            )}
            {filtered.map((n) => (
              <div
                key={n.id}
                onClick={() => openNote(n.id)}
                className="group/note flex cursor-default flex-col gap-0.5 rounded-lg px-2.5 py-2 hover:bg-scout-surface-2"
              >
                <div className="flex items-center gap-2">
                  <FileText size={13} className="shrink-0 text-scout-faint" />
                  <span className="truncate text-[13px] font-medium">{n.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteNote(n.id)
                    }}
                    className="ml-auto rounded p-0.5 text-scout-faint opacity-0 hover:text-scout-pink group-hover/note:opacity-100"
                    title="Delete note"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="flex items-center gap-1.5 pl-5 text-[11px] text-scout-faint">
                  <span className="truncate">{n.url ? hostnameOf(n.url) : 'Unlinked'}</span>
                  <span>·</span>
                  <span className="shrink-0">{relativeTime(n.updatedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 border-b border-scout-border px-3 py-2 text-xs text-scout-faint">
            {linkedHost ? (
              <>
                <Link2 size={13} className="text-scout-green" />
                <span className="truncate">{linkedHost}</span>
              </>
            ) : (
              <>
                <Link2Off size={13} />
                <span className="truncate">Unlinked note</span>
              </>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            <CodeMirror
              value={body}
              onChange={onChange}
              theme={scoutCmTheme}
              extensions={cmExtensions}
              basicSetup={cmBasicSetup}
              placeholder={'# Notes\n\nStart typing in Markdown…'}
              height="100%"
              style={{ height: '100%' }}
            />
          </div>

          <div className="flex items-center gap-2 border-t border-scout-border px-3 py-2 text-[11px] text-scout-faint">
            <span>{words} words</span>
            <span className="ml-auto">Auto-saved locally · Markdown</span>
          </div>
        </>
      )}
    </aside>
  )
}
