import { useMemo, useState } from 'react'
import { FileText, X, Copy, Check, Download, FolderOpen, Layers, SquareStack } from 'lucide-react'
import { useAppStore, useActiveWorkspace } from '../store/appStore'
import { useUiStore } from '../store/uiStore'
import { isElectron } from '../lib/env'
import {
  buildBriefing,
  defaultBriefingTitle,
  briefingFilename
} from '../lib/briefing'

function Toggle({
  on,
  onClick,
  icon: Icon,
  label,
  count
}: {
  on: boolean
  onClick: () => void
  icon: typeof FileText
  label: string
  count: number
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={[
        'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px]',
        on
          ? 'border-scout-accent bg-scout-accent-soft text-scout-text'
          : 'border-scout-border text-scout-muted hover:bg-scout-surface-2'
      ].join(' ')}
    >
      <Icon size={14} className={on ? 'text-scout-accent' : ''} />
      {label}
      <span className="text-scout-faint">{count}</span>
    </button>
  )
}

export default function BriefingModal(): JSX.Element | null {
  const open = useUiStore((s) => s.briefingOpen)
  const close = useUiStore((s) => s.closeBriefing)
  const notes = useAppStore((s) => s.notes)
  const library = useAppStore((s) => s.library)
  const workspace = useActiveWorkspace()

  const [title, setTitle] = useState(() => defaultBriefingTitle(workspace))
  const [incTabs, setIncTabs] = useState(true)
  const [incNotes, setIncNotes] = useState(true)
  const [incBookmarks, setIncBookmarks] = useState(true)
  const [copied, setCopied] = useState(false)
  const [savedPath, setSavedPath] = useState<string | null>(null)

  const noteCount = useMemo(() => notes.filter((n) => n.body.trim()).length, [notes])
  const tabCount = workspace?.tabs.filter((t) => t.url !== 'scout://newtab').length ?? 0

  const markdown = useMemo(
    () =>
      buildBriefing({
        title,
        includeTabs: incTabs,
        includeNotes: incNotes,
        includeBookmarks: incBookmarks,
        notes,
        bookmarks: library,
        workspace
      }),
    [title, incTabs, incNotes, incBookmarks, notes, library, workspace]
  )

  if (!open) return null

  const copy = (): void => {
    void navigator.clipboard.writeText(markdown).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    })
  }

  const save = (): void => {
    if (!isElectron) return
    void window.scout
      .saveExport({ name: briefingFilename(title), content: markdown })
      .then((path) => {
        if (path) setSavedPath(path)
      })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm"
      onMouseDown={close}
    >
      <div
        className="glass-strong mt-[8vh] flex max-h-[80vh] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl border border-scout-border shadow-2xl shadow-black/50"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex h-12 items-center gap-2 border-b border-scout-border px-4">
          <FileText size={17} className="text-scout-accent" />
          <span className="text-sm font-semibold">Research briefing</span>
          <button
            onClick={close}
            className="ml-auto rounded-md p-1.5 text-scout-muted hover:bg-scout-surface-2 hover:text-scout-text"
          >
            <X size={16} />
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-3 border-b border-scout-border p-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-9 w-full select-text rounded-lg border border-scout-border bg-scout-bg px-3 text-sm focus:border-scout-accent focus:outline-none"
          />
          <div className="flex flex-wrap gap-2">
            <Toggle on={incTabs} onClick={() => setIncTabs((v) => !v)} icon={SquareStack} label="Open sources" count={tabCount} />
            <Toggle on={incNotes} onClick={() => setIncNotes((v) => !v)} icon={FileText} label="Notes" count={noteCount} />
            <Toggle on={incBookmarks} onClick={() => setIncBookmarks((v) => !v)} icon={Layers} label="Bookmarks" count={library.length} />
          </div>
        </div>

        {/* Preview */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-scout-bg p-4">
          <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-scout-muted">
            {markdown}
          </pre>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-scout-border px-4 py-3">
          {savedPath && (
            <button
              onClick={() => window.scout.showDownload(savedPath)}
              className="flex items-center gap-1.5 text-[12px] text-scout-green hover:underline"
            >
              <FolderOpen size={13} /> Saved — show file
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button
              onClick={copy}
              className="flex items-center gap-2 rounded-lg border border-scout-border px-3.5 py-2 text-[13px] hover:bg-scout-surface-2"
            >
              {copied ? <Check size={15} className="text-scout-green" /> : <Copy size={15} />}
              {copied ? 'Copied' : 'Copy Markdown'}
            </button>
            {isElectron && (
              <button
                onClick={save}
                className="flex items-center gap-2 rounded-lg bg-scout-accent px-3.5 py-2 text-[13px] font-medium text-white hover:brightness-110"
              >
                <Download size={15} /> Save as file
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
