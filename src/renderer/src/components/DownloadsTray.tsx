import { useEffect, useRef } from 'react'
import { Download, FolderOpen, Check, AlertCircle, X } from 'lucide-react'
import { useUiStore } from '../store/uiStore'
import { isElectron } from '../lib/env'

function fmtBytes(n: number): string {
  if (!n) return ''
  const u = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let v = n
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`
}

export default function DownloadsTray(): JSX.Element | null {
  const downloads = useUiStore((s) => s.downloads)
  const open = useUiStore((s) => s.downloadsOpen)
  const toggle = useUiStore((s) => s.toggleDownloads)
  const setOpen = useUiStore((s) => s.setDownloadsOpen)
  const clear = useUiStore((s) => s.clearDownloads)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, setOpen])

  // Only show the tray once there's something to show.
  if (!isElectron || downloads.length === 0) return null

  const active = downloads.filter((d) => d.state === 'progressing').length

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        title="Downloads"
        className={[
          'app-no-drag relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
          open
            ? 'bg-scout-accent-soft text-scout-accent'
            : 'text-scout-muted hover:bg-scout-surface-2 hover:text-scout-text'
        ].join(' ')}
      >
        <Download size={17} />
        {active > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-scout-accent text-[9px] font-bold text-white">
            {active}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 overflow-hidden rounded-xl border border-scout-border bg-scout-surface shadow-2xl shadow-black/50">
          <div className="flex items-center gap-2 border-b border-scout-border px-3 py-2">
            <span className="text-[13px] font-semibold">Downloads</span>
            <button
              onClick={clear}
              className="ml-auto text-[11px] text-scout-faint hover:text-scout-text"
            >
              Clear finished
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto p-1.5">
            {downloads.map((d) => {
              const pct = d.totalBytes ? Math.round((d.receivedBytes / d.totalBytes) * 100) : 0
              const done = d.state === 'completed'
              const failed = d.state === 'interrupted' || d.state === 'cancelled'
              return (
                <div key={d.id} className="rounded-lg px-2.5 py-2 hover:bg-scout-surface-2">
                  <div className="flex items-center gap-2">
                    {done ? (
                      <Check size={14} className="shrink-0 text-scout-green" />
                    ) : failed ? (
                      <AlertCircle size={14} className="shrink-0 text-scout-pink" />
                    ) : (
                      <Download size={14} className="shrink-0 text-scout-accent" />
                    )}
                    <span className="flex-1 truncate text-[12.5px]">{d.filename}</span>
                    {done && (
                      <button
                        onClick={() => window.scout.showDownload(d.savePath)}
                        className="rounded p-0.5 text-scout-faint hover:text-scout-text"
                        title="Show in folder"
                      >
                        <FolderOpen size={13} />
                      </button>
                    )}
                  </div>
                  {d.state === 'progressing' && (
                    <div className="mt-1.5 flex items-center gap-2 pl-6">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-scout-border">
                        <div
                          className="h-full rounded-full bg-scout-accent transition-[width]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] tabular-nums text-scout-faint">
                        {fmtBytes(d.receivedBytes)}
                        {d.totalBytes ? ` / ${fmtBytes(d.totalBytes)}` : ''}
                      </span>
                    </div>
                  )}
                  {done && (
                    <button
                      onClick={() => window.scout.openDownload(d.savePath)}
                      className="ml-6 mt-0.5 text-[11px] text-scout-accent hover:underline"
                    >
                      Open file
                    </button>
                  )}
                  {failed && (
                    <div className="ml-6 mt-0.5 flex items-center gap-2 text-[11px] text-scout-faint">
                      <span>{d.state === 'cancelled' ? 'Cancelled' : 'Failed'}</span>
                      <X size={11} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
