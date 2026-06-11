import { useEffect, useMemo, useRef, useState } from 'react'
import { Lock, Globe } from 'lucide-react'
import { isElectron } from '../lib/env'
import { MANAGED_PERMISSIONS, permTitle, permIcon } from '../lib/permissions'
import { hostnameOf } from '../lib/url'
import type { PermissionEntry, PermissionDecision } from '../../../shared/types'

type State = PermissionDecision | 'ask'

// The lock/globe icon in the omnibox doubles as a site-info button: click it to
// review and change what this site is allowed to do (camera/mic/location).
export default function SitePermissions({ url }: { url: string | null }): JSX.Element {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<PermissionEntry[]>([])
  const ref = useRef<HTMLDivElement>(null)

  const origin = useMemo(() => {
    if (!url || !/^https?:/i.test(url)) return null
    try {
      return new URL(url).origin
    } catch {
      return null
    }
  }, [url])

  const isSecure = !!url && url.startsWith('https://')

  useEffect(() => {
    if (!open || !origin || !isElectron) return
    void window.scout.listPermissions(origin).then(setEntries)
  }, [open, origin])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const stateFor = (perm: string): State =>
    entries.find((e) => e.permission === perm)?.decision ?? 'ask'

  const set = (perm: string, decision: State): void => {
    if (!origin || !isElectron) return
    window.scout.setPermission({ origin, permission: perm, decision })
    setEntries((prev) => {
      const others = prev.filter((e) => e.permission !== perm)
      return decision === 'ask' ? others : [...others, { permission: perm, decision }]
    })
  }

  return (
    <div ref={ref} className="relative flex items-center">
      <button
        type="button"
        onClick={() => origin && setOpen((v) => !v)}
        title={origin ? 'Site information & permissions' : undefined}
        className={[
          'flex h-6 w-6 items-center justify-center rounded-md',
          origin ? 'hover:bg-scout-surface-2' : 'cursor-default'
        ].join(' ')}
      >
        {isSecure ? (
          <Lock size={13} className="text-scout-green" />
        ) : (
          <Globe size={13} className="text-scout-faint" />
        )}
      </button>

      {open && origin && (
        <div className="absolute left-0 top-8 z-50 w-72 overflow-hidden rounded-xl border border-scout-border bg-scout-surface shadow-2xl shadow-black/50">
          <div className="border-b border-scout-border px-3.5 py-2.5">
            <div className="text-[11px] uppercase tracking-wider text-scout-faint">
              Permissions
            </div>
            <div className="truncate text-[13px] font-medium">{hostnameOf(origin)}</div>
          </div>
          <div className="flex flex-col gap-1 p-2">
            {MANAGED_PERMISSIONS.map((perm) => {
              const Icon = permIcon(perm)
              const cur = stateFor(perm)
              return (
                <div key={perm} className="flex items-center gap-2.5 px-1.5 py-1">
                  <Icon size={15} className="shrink-0 text-scout-muted" />
                  <span className="flex-1 truncate text-[13px]">{permTitle(perm)}</span>
                  <div className="flex shrink-0 overflow-hidden rounded-md border border-scout-border">
                    {(['ask', 'allow', 'block'] as State[]).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => set(perm, opt)}
                        className={[
                          'px-2 py-0.5 text-[11px] capitalize',
                          cur === opt
                            ? opt === 'block'
                              ? 'bg-scout-pink/20 text-scout-pink'
                              : opt === 'allow'
                                ? 'bg-scout-green/20 text-scout-green'
                                : 'bg-scout-surface-2 text-scout-text'
                            : 'text-scout-faint hover:bg-scout-surface-2'
                        ].join(' ')}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="border-t border-scout-border px-3.5 py-2 text-[11px] text-scout-faint">
            “Ask” will prompt next time the site needs it.
          </div>
        </div>
      )}
    </div>
  )
}
