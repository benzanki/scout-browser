import { useEffect, useState } from 'react'
import { Download, RefreshCw, X } from 'lucide-react'
import { isElectron } from '../lib/env'
import type { AppUpdateStatus } from '../../../shared/types'

// Small bottom-right toast for Scout's self-update: shows download progress, then
// a "Restart to update" button once the new version is ready.
export default function AppUpdateToast(): JSX.Element | null {
  const [status, setStatus] = useState<AppUpdateStatus | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!isElectron) return
    return window.scout.onAppUpdate((s) => {
      setStatus(s)
      setDismissed(false)
    })
  }, [])

  // Only surface while downloading or once ready (ignore none/checking/error noise).
  if (!status || dismissed) return null
  if (status.state !== 'downloading' && status.state !== 'downloaded') return null

  const downloading = status.state === 'downloading'

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[300px] overflow-hidden rounded-xl border border-scout-border bg-scout-surface shadow-2xl shadow-black/50">
      <div className="flex items-start gap-3 p-3.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-scout-accent-soft">
          {downloading ? (
            <Download size={17} className="text-scout-accent" />
          ) : (
            <RefreshCw size={17} className="text-scout-accent" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-scout-text">
            {downloading ? 'Downloading update…' : 'Update ready'}
          </div>
          <div className="mt-0.5 text-[11.5px] text-scout-faint">
            {downloading
              ? `Scout ${status.version ?? ''} — ${status.percent ?? 0}%`
              : `Scout ${status.version ?? ''} will install on restart.`}
          </div>
          {downloading && (
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-scout-surface-2">
              <div
                className="h-full rounded-full bg-scout-accent transition-[width]"
                style={{ width: `${status.percent ?? 0}%` }}
              />
            </div>
          )}
        </div>
        {!downloading && (
          <button
            onClick={() => setDismissed(true)}
            className="shrink-0 rounded p-1 text-scout-faint hover:text-scout-text"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {!downloading && (
        <div className="flex justify-end gap-2 border-t border-scout-border px-3 py-2.5">
          <button
            onClick={() => setDismissed(true)}
            className="rounded-lg px-3 py-1.5 text-[13px] text-scout-muted hover:bg-scout-surface-2 hover:text-scout-text"
          >
            Later
          </button>
          <button
            onClick={() => window.scout.installUpdate()}
            className="rounded-lg bg-scout-accent px-3.5 py-1.5 text-[13px] font-medium text-white hover:brightness-110"
          >
            Restart now
          </button>
        </div>
      )}
    </div>
  )
}
