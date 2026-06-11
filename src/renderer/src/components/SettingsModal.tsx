import { useEffect, useState } from 'react'
import {
  Settings as SettingsIcon,
  X,
  Check,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Trash2
} from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { useUiStore } from '../store/uiStore'
import { isElectron } from '../lib/env'
import type { SearchEngine, UpdateInfo } from '../../../shared/types'

const ENGINES: { id: SearchEngine; label: string; host: string }[] = [
  { id: 'google', label: 'Google', host: 'google.com' },
  { id: 'duckduckgo', label: 'DuckDuckGo', host: 'duckduckgo.com' },
  { id: 'bing', label: 'Bing', host: 'bing.com' }
]

function Toggle({
  label,
  hint,
  checked,
  onChange
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (v: boolean) => void
}): JSX.Element {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-scout-surface-2"
    >
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium">{label}</div>
        <div className="text-[11px] text-scout-faint">{hint}</div>
      </div>
      <span
        className={[
          'relative h-5 w-9 shrink-0 rounded-full transition-colors',
          checked ? 'bg-scout-accent' : 'bg-scout-surface-2'
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          ].join(' ')}
        />
      </span>
    </button>
  )
}

export default function SettingsModal(): JSX.Element | null {
  const open = useUiStore((s) => s.settingsOpen)
  const close = useUiStore((s) => s.closeSettings)
  const settings = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const setUpdateInfo = useUiStore((s) => s.setUpdateInfo)
  const [engine, setEngine] = useState<UpdateInfo | null>(null)
  const [checking, setChecking] = useState(false)
  const [allowedSites, setAllowedSites] = useState<string[]>([])

  const setOpenAtLogin = (v: boolean): void => {
    updateSettings({ openAtLogin: v })
    if (isElectron) window.scout.setStartup(v)
  }

  const revoke = (host: string): void => {
    if (!isElectron) return
    window.scout.revokeSite(host)
    setAllowedSites((s) => s.filter((h) => h !== host))
  }

  const check = (): void => {
    if (!isElectron) return
    setChecking(true)
    void window.scout
      .checkUpdate()
      .then((info) => {
        setEngine(info)
        setUpdateInfo(info)
      })
      .finally(() => setChecking(false))
  }

  useEffect(() => {
    if (!open || !isElectron) return
    if (!engine) check()
    void window.scout.listAllowedSites().then(setAllowedSites)
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm"
      onMouseDown={close}
    >
      <div
        className="glass-strong mt-[14vh] w-full max-w-[520px] overflow-hidden rounded-2xl border border-scout-border shadow-2xl shadow-black/50"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex h-12 items-center gap-2 border-b border-scout-border px-4">
          <SettingsIcon size={17} className="text-scout-accent" />
          <span className="text-sm font-semibold">Settings</span>
          <button
            onClick={close}
            className="ml-auto rounded-md p-1.5 text-scout-muted hover:bg-scout-surface-2 hover:text-scout-text"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-6 p-5">
          {/* Search engine */}
          <div>
            <div className="mb-2 text-[13px] font-semibold">Default search engine</div>
            <div className="flex flex-col gap-1.5">
              {ENGINES.map((e) => {
                const active = settings.searchEngine === e.id
                return (
                  <button
                    key={e.id}
                    onClick={() => updateSettings({ searchEngine: e.id })}
                    className={[
                      'flex items-center gap-3 rounded-lg border px-3 py-2 text-left',
                      active
                        ? 'border-scout-accent bg-scout-accent-soft'
                        : 'border-scout-border hover:bg-scout-surface-2'
                    ].join(' ')}
                  >
                    <div className="flex-1">
                      <div className="text-[13px] font-medium">{e.label}</div>
                      <div className="text-[11px] text-scout-faint">{e.host}</div>
                    </div>
                    {active && <Check size={16} className="text-scout-accent" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Homepage */}
          <div>
            <label className="mb-2 block text-[13px] font-semibold">Homepage</label>
            <input
              value={settings.homepage}
              onChange={(e) => updateSettings({ homepage: e.target.value })}
              spellCheck={false}
              placeholder="https://…"
              className="h-10 w-full select-text rounded-lg border border-scout-border bg-scout-bg px-3 text-sm text-scout-text placeholder:text-scout-faint focus:border-scout-accent focus:outline-none"
            />
            <p className="mt-1.5 text-[11px] text-scout-faint">
              Opened by the Home button.
            </p>
          </div>

          {/* Hub & startup */}
          <div>
            <div className="mb-2 text-[13px] font-semibold">Hub &amp; startup</div>
            <div className="divide-y divide-scout-border overflow-hidden rounded-lg border border-scout-border bg-scout-bg">
              <Toggle
                label="Launch Scout on startup"
                hint="Open Scout automatically when you sign in to Windows."
                checked={settings.openAtLogin ?? false}
                onChange={setOpenAtLogin}
              />
              <Toggle
                label="Open fullscreen on launch"
                hint="Start in the Hub, filling the screen."
                checked={settings.startFullscreen ?? false}
                onChange={(v) => updateSettings({ startFullscreen: v })}
              />
              <div className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium">Suspend unused apps</div>
                  <div className="text-[11px] text-scout-faint">
                    Unload an app panel after it’s been idle, to free memory (audio &
                    calls keep running).
                  </div>
                </div>
                <select
                  value={settings.appSuspendMinutes ?? 10}
                  onChange={(e) => updateSettings({ appSuspendMinutes: Number(e.target.value) })}
                  className="h-8 shrink-0 rounded-lg border border-scout-border bg-scout-bg px-2 text-[12px] focus:border-scout-accent focus:outline-none"
                >
                  <option value={0}>Never</option>
                  <option value={5}>After 5 min</option>
                  <option value={10}>After 10 min</option>
                  <option value={20}>After 20 min</option>
                  <option value={30}>After 30 min</option>
                </select>
              </div>
            </div>
          </div>

          {/* Dashboard widgets */}
          <div>
            <div className="mb-2 text-[13px] font-semibold">Dashboard widgets</div>
            <div className="divide-y divide-scout-border overflow-hidden rounded-lg border border-scout-border bg-scout-bg">
              {(
                [
                  ['calendar', 'Calendar'],
                  ['clock', 'Clock'],
                  ['weather', 'Weather'],
                  ['tasks', 'Tasks'],
                  ['games', 'Games']
                ] as [string, string][]
              ).map(([key, label]) => (
                <Toggle
                  key={key}
                  label={label}
                  hint={`Show the ${label.toLowerCase()} on the Hub home.`}
                  checked={!(settings.hiddenWidgets ?? []).includes(key)}
                  onChange={(show) => {
                    const set = new Set(settings.hiddenWidgets ?? [])
                    show ? set.delete(key) : set.add(key)
                    updateSettings({ hiddenWidgets: [...set] })
                  }}
                />
              ))}
            </div>
          </div>

          {/* Browser engine / updates */}
          <div>
            <div className="mb-2 text-[13px] font-semibold">Browser engine</div>
            <div className="rounded-lg border border-scout-border bg-scout-bg p-3">
              {!isElectron ? (
                <p className="text-[12px] text-scout-faint">
                  Engine info is available in the desktop app.
                </p>
              ) : engine ? (
                <>
                  <div className="flex items-center gap-2.5">
                    {engine.behind ? (
                      <ShieldAlert size={18} className="shrink-0 text-scout-amber" />
                    ) : (
                      <ShieldCheck size={18} className="shrink-0 text-scout-green" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium">
                        Chromium {engine.chromium}
                        <span className="text-scout-faint">
                          {' '}
                          · Electron {engine.currentElectron}
                        </span>
                      </div>
                      <div
                        className={[
                          'text-[11.5px]',
                          engine.behind ? 'text-scout-amber' : 'text-scout-green'
                        ].join(' ')}
                      >
                        {engine.behind
                          ? `Update available — Electron ${engine.latestElectron}`
                          : 'Up to date'}
                      </div>
                    </div>
                    <button
                      onClick={check}
                      disabled={checking}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-scout-border px-2.5 py-1.5 text-[12px] hover:bg-scout-surface-2 disabled:opacity-50"
                    >
                      <RefreshCw size={13} className={checking ? 'animate-spin' : ''} />
                      Check
                    </button>
                  </div>
                  {engine.behind && (
                    <p className="mt-2.5 border-t border-scout-border pt-2.5 text-[11.5px] text-scout-faint">
                      A newer engine includes the latest security patches. Rebuild Scout
                      to update — run <span className="text-scout-muted">npm install</span>{' '}
                      then <span className="text-scout-muted">npm run build</span>, or ask
                      Claude to do the upgrade.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-[12px] text-scout-faint">
                  {checking ? 'Checking…' : 'Engine info unavailable.'}
                </p>
              )}
            </div>
          </div>

          {/* Unblocked sites (safety exceptions) */}
          {allowedSites.length > 0 && (
            <div>
              <div className="mb-2 text-[13px] font-semibold">Unblocked sites</div>
              <div className="divide-y divide-scout-border overflow-hidden rounded-lg border border-scout-border bg-scout-bg">
                {allowedSites.map((host) => (
                  <div key={host} className="flex items-center gap-2 px-3 py-2">
                    <ShieldAlert size={14} className="shrink-0 text-scout-amber" />
                    <span className="flex-1 truncate text-[13px]">{host}</span>
                    <button
                      onClick={() => revoke(host)}
                      className="rounded p-1 text-scout-faint hover:text-scout-pink"
                      title="Re-block this site"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-scout-faint">
                Sites you chose to open despite a safety warning. Remove to re-block.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
