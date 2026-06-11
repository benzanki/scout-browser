import { useEffect, useState } from 'react'
import { isElectron } from '../lib/env'
import { permLabel, permIcon } from '../lib/permissions'
import type { PermissionRequest, PermissionDecision } from '../../../shared/types'

// A Chrome-style in-app permission bubble that drops in under the address bar,
// replacing the native Windows dialog. Requests queue one at a time.
export default function PermissionPrompt(): JSX.Element | null {
  const [queue, setQueue] = useState<PermissionRequest[]>([])

  useEffect(() => {
    if (!isElectron) return
    return window.scout.onPermissionRequest((req) =>
      setQueue((q) => (q.some((r) => r.id === req.id) ? q : [...q, req]))
    )
  }, [])

  const req = queue[0]
  if (!req) return null

  const respond = (decision: PermissionDecision): void => {
    window.scout.respondPermission({ id: req.id, decision })
    setQueue((q) => q.slice(1))
  }

  const Icon = permIcon(req.permission)

  return (
    <div className="absolute left-3 top-3 z-40 w-[340px]">
      <div className="overflow-hidden rounded-xl border border-scout-border bg-scout-surface shadow-2xl shadow-black/50">
        <div className="flex items-start gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-scout-accent-soft">
            <Icon size={18} className="text-scout-accent" />
          </div>
          <div className="min-w-0">
            <div className="text-[13.5px] font-medium leading-snug text-scout-text">
              <span className="font-semibold">{req.host}</span> wants to use your{' '}
              {permLabel(req.permission, req.mediaTypes)}
            </div>
            <div className="mt-0.5 text-[11.5px] text-scout-faint">
              Scout will remember this choice for this site.
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-scout-border px-3 py-2.5">
          <button
            onClick={() => respond('block')}
            className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-scout-muted hover:bg-scout-surface-2 hover:text-scout-text"
          >
            Block
          </button>
          <button
            onClick={() => respond('allow')}
            className="rounded-lg bg-scout-accent px-3.5 py-1.5 text-[13px] font-medium text-white hover:brightness-110"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  )
}
