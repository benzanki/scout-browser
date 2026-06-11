import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  RotateCw,
  Trash2,
  X,
  ExternalLink,
  Unlink
} from 'lucide-react'
import { isElectron } from '../lib/env'
import type { GCalEvent, GCalEventInput, GCalStatus } from '../../../shared/types'

const pad = (n: number): string => String(n).padStart(2, '0')
const localYmd = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const eventDayKey = (ev: GCalEvent): string =>
  ev.allDay ? ev.start.slice(0, 10) : localYmd(new Date(ev.start))

const eventTime = (ev: GCalEvent): string =>
  ev.allDay
    ? 'All day'
    : new Date(ev.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

interface EditState {
  id?: string
  calendarId: string
  editable: boolean
  summary: string
  date: string
  allDay: boolean
  startTime: string
  endTime: string
  location: string
}

function Shell({ className, children }: { className: string; children: React.ReactNode }): JSX.Element {
  return (
    <div
      className={`glass-card flex min-h-[340px] flex-col overflow-hidden rounded-2xl ${className}`}
    >
      {children}
    </div>
  )
}

export default function CalendarTile({ className = '' }: { className?: string }): JSX.Element {
  if (!isElectron) {
    return (
      <Shell className={className}>
        <div className="flex h-full flex-col items-center justify-center gap-3 text-scout-faint">
          <CalendarDays size={28} />
          <div className="text-sm text-scout-muted">Calendar</div>
          <div className="rounded-md border border-scout-border bg-scout-surface px-2.5 py-1 text-[11px]">
            Runs in the desktop app (npm run dev)
          </div>
        </div>
      </Shell>
    )
  }
  return <NativeCalendar className={className} />
}

function NativeCalendar({ className }: { className: string }): JSX.Element {
  const today = useMemo(() => new Date(), [])
  const [status, setStatus] = useState<GCalStatus | null>(null)
  const [events, setEvents] = useState<GCalEvent[]>([])
  const [view, setView] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState<Date>(() => new Date())
  const [editing, setEditing] = useState<EditState | null>(null)
  const [creds, setCreds] = useState({ clientId: '', clientSecret: '' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void window.scout.gcalStatus().then(setStatus)
  }, [])

  const loadEvents = useCallback(async () => {
    if (!status?.connected) return
    const min = new Date(view.getFullYear(), view.getMonth(), 1).toISOString()
    const max = new Date(view.getFullYear(), view.getMonth() + 1, 1).toISOString()
    setEvents(await window.scout.gcalList(min, max))
  }, [status?.connected, view])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  const connect = async (): Promise<void> => {
    setBusy(true)
    if (creds.clientId && creds.clientSecret) {
      window.scout.gcalSetCreds(creds.clientId, creds.clientSecret)
    }
    const s = await window.scout.gcalConnect()
    setStatus(s)
    setBusy(false)
  }

  const disconnect = async (): Promise<void> => {
    if (!window.confirm('Disconnect Google Calendar?')) return
    setStatus(await window.scout.gcalDisconnect())
    setEvents([])
  }

  // ----- not connected: setup / connect -----
  if (status && !status.connected) {
    return (
      <Shell className={className}>
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
          <CalendarDays size={26} className="text-scout-accent" />
          <div className="text-sm font-semibold">Connect Google Calendar</div>
          {!status.hasCredentials && (
            <>
              <p className="max-w-sm text-[12px] text-scout-faint">
                One-time setup: create a free OAuth client in Google Cloud (Calendar API,
                Desktop app), then paste its ID & secret below.
              </p>
              <button
                onClick={() => window.scout.launchExternal('https://console.cloud.google.com/apis/credentials')}
                className="flex items-center gap-1.5 text-[11px] text-scout-accent hover:underline"
              >
                <ExternalLink size={11} /> Open Google Cloud credentials
              </button>
              <input
                value={creds.clientId}
                onChange={(e) => setCreds({ ...creds, clientId: e.target.value })}
                placeholder="Client ID"
                spellCheck={false}
                className="h-8 w-full max-w-sm select-text rounded-lg border border-scout-border bg-scout-bg px-3 text-[13px] focus:border-scout-accent focus:outline-none"
              />
              <input
                value={creds.clientSecret}
                onChange={(e) => setCreds({ ...creds, clientSecret: e.target.value })}
                placeholder="Client secret"
                spellCheck={false}
                className="h-8 w-full max-w-sm select-text rounded-lg border border-scout-border bg-scout-bg px-3 text-[13px] focus:border-scout-accent focus:outline-none"
              />
            </>
          )}
          {status.error && <p className="text-[11px] text-scout-pink">{status.error}</p>}
          <button
            onClick={() => void connect()}
            disabled={busy || (!status.hasCredentials && (!creds.clientId || !creds.clientSecret))}
            className="rounded-lg bg-scout-accent px-4 py-2 text-[13px] font-medium text-white hover:brightness-110 disabled:opacity-50"
          >
            {busy ? 'Waiting for Google…' : 'Connect'}
          </button>
        </div>
      </Shell>
    )
  }

  // ----- connected: calendar -----
  const cells = (() => {
    const year = view.getFullYear()
    const month = view.getMonth()
    const lead = new Date(year, month, 1).getDay()
    const days = new Date(year, month + 1, 0).getDate()
    const arr: (Date | null)[] = []
    for (let i = 0; i < lead; i++) arr.push(null)
    for (let d = 1; d <= days; d++) arr.push(new Date(year, month, d))
    return arr
  })()

  const sameDay = (a: Date, b: Date): boolean => localYmd(a) === localYmd(b)
  const dayEvents = (d: Date): GCalEvent[] =>
    events.filter((ev) => eventDayKey(ev) === localYmd(d))
  const selectedEvents = dayEvents(selected).sort((a, b) =>
    a.allDay === b.allDay ? a.start.localeCompare(b.start) : a.allDay ? -1 : 1
  )

  const shiftMonth = (delta: number): void =>
    setView((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1))

  const openAdd = (): void =>
    setEditing({
      calendarId: 'primary',
      editable: true,
      summary: '',
      date: localYmd(selected),
      allDay: false,
      startTime: '09:00',
      endTime: '10:00',
      location: ''
    })

  const openEdit = (ev: GCalEvent): void => {
    setEditing({
      id: ev.id,
      calendarId: ev.calendarId,
      editable: ev.editable !== false,
      summary: ev.summary,
      date: eventDayKey(ev),
      allDay: ev.allDay,
      startTime: ev.allDay ? '09:00' : new Date(ev.start).toTimeString().slice(0, 5),
      endTime: ev.allDay ? '10:00' : new Date(ev.end).toTimeString().slice(0, 5),
      location: ev.location ?? ''
    })
  }

  const save = async (): Promise<void> => {
    if (!editing || !editing.summary.trim()) return
    setBusy(true)
    const input: GCalEventInput = editing.allDay
      ? { summary: editing.summary, start: editing.date, end: editing.date, allDay: true, location: editing.location }
      : {
          summary: editing.summary,
          start: new Date(`${editing.date}T${editing.startTime}:00`).toISOString(),
          end: new Date(`${editing.date}T${editing.endTime}:00`).toISOString(),
          allDay: false,
          location: editing.location
        }
    if (editing.id) await window.scout.gcalUpdate(editing.id, editing.calendarId, input)
    else await window.scout.gcalCreate(input)
    setEditing(null)
    await loadEvents()
    setBusy(false)
  }

  const remove = async (): Promise<void> => {
    if (!editing?.id) return
    setBusy(true)
    await window.scout.gcalDelete(editing.id, editing.calendarId)
    setEditing(null)
    await loadEvents()
    setBusy(false)
  }

  return (
    <Shell className={`relative ${className}`}>
      {/* Header */}
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-scout-border px-3">
        <CalendarDays size={14} className="text-scout-accent" />
        <span className="text-sm font-semibold">
          {MONTHS[view.getMonth()]} {view.getFullYear()}
        </span>
        <div className="ml-2 flex items-center gap-0.5">
          <button onClick={() => shiftMonth(-1)} className="rounded-md p-1 text-scout-faint hover:bg-scout-surface-2 hover:text-scout-text">
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={() => {
              const n = new Date()
              setView(new Date(n.getFullYear(), n.getMonth(), 1))
              setSelected(n)
            }}
            className="rounded-md px-2 py-0.5 text-[11px] text-scout-muted hover:bg-scout-surface-2 hover:text-scout-text"
          >
            Today
          </button>
          <button onClick={() => shiftMonth(1)} className="rounded-md p-1 text-scout-faint hover:bg-scout-surface-2 hover:text-scout-text">
            <ChevronRight size={15} />
          </button>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={openAdd} title="Add event" className="btn-gradient flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-white">
            <Plus size={12} /> Add
          </button>
          <button onClick={() => void loadEvents()} title="Refresh" className="rounded-md p-1 text-scout-faint hover:bg-scout-surface-2 hover:text-scout-text">
            <RotateCw size={13} />
          </button>
          <button onClick={() => void disconnect()} title={status?.email ? `Disconnect ${status.email}` : 'Disconnect'} className="rounded-md p-1 text-scout-faint hover:bg-scout-surface-2 hover:text-scout-pink">
            <Unlink size={13} />
          </button>
        </div>
      </div>

      {/* Body: month grid + selected day's events */}
      <div className="flex min-h-0 flex-1">
        <div className="w-1/2 border-r border-scout-border p-3">
          <div className="grid grid-cols-7 gap-y-1 text-center">
            {DOW.map((d, i) => (
              <div key={i} className="text-[10px] font-medium text-scout-faint">{d}</div>
            ))}
            {cells.map((d, i) => {
              if (!d) return <div key={i} />
              const isToday = sameDay(d, today)
              const isSel = sameDay(d, selected)
              const has = dayEvents(d).length > 0
              return (
                <button
                  key={i}
                  onClick={() => setSelected(d)}
                  className="flex flex-col items-center"
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] ${
                      isSel
                        ? 'bg-scout-accent font-semibold text-white'
                        : isToday
                          ? 'text-scout-accent'
                          : 'text-scout-muted hover:bg-scout-surface-2'
                    }`}
                  >
                    {d.getDate()}
                  </span>
                  <span className={`mt-0.5 h-1 w-1 rounded-full ${has && !isSel ? 'bg-scout-accent' : 'bg-transparent'}`} />
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col p-3">
          <div className="mb-2 text-[13px] font-semibold text-scout-text">
            {selected.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })}
          </div>
          <div className="-mr-1 min-h-0 flex-1 overflow-y-auto pr-1">
            {selectedEvents.length === 0 ? (
              <div className="py-6 text-center text-xs text-scout-faint">No events</div>
            ) : (
              <div className="flex flex-col gap-1">
                {selectedEvents.map((ev) => (
                  <button
                    key={`${ev.calendarId}:${ev.id}`}
                    onClick={() => openEdit(ev)}
                    style={{ borderLeftColor: ev.color ?? 'var(--color-scout-accent)' }}
                    className="group/ev flex items-start gap-2 rounded-lg border-l-2 bg-scout-surface-2/60 px-2.5 py-1.5 text-left hover:bg-scout-surface-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] text-scout-text">{ev.summary}</div>
                      <div className="text-[11px] text-scout-faint">
                        {eventTime(ev)}
                        {ev.location ? ` · ${ev.location}` : ''}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Event editor overlay */}
      {editing && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onMouseDown={() => setEditing(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-scout-border bg-scout-surface p-4 shadow-2xl shadow-black/50" onMouseDown={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center">
              <span className="text-sm font-semibold">{editing.id ? 'Edit event' : 'New event'}</span>
              <button onClick={() => setEditing(null)} className="ml-auto rounded-md p-1 text-scout-muted hover:bg-scout-surface-2 hover:text-scout-text">
                <X size={15} />
              </button>
            </div>
            <input
              autoFocus
              value={editing.summary}
              onChange={(e) => setEditing({ ...editing, summary: e.target.value })}
              placeholder="Event title"
              className="mb-2 h-9 w-full select-text rounded-lg border border-scout-border bg-scout-bg px-3 text-sm focus:border-scout-accent focus:outline-none"
            />
            <div className="mb-2 flex items-center gap-2">
              <input
                type="date"
                value={editing.date}
                onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                className="h-9 flex-1 select-text rounded-lg border border-scout-border bg-scout-bg px-3 text-[13px] focus:border-scout-accent focus:outline-none"
              />
              <label className="flex items-center gap-1.5 text-[12px] text-scout-muted">
                <input type="checkbox" checked={editing.allDay} onChange={(e) => setEditing({ ...editing, allDay: e.target.checked })} />
                All day
              </label>
            </div>
            {!editing.allDay && (
              <div className="mb-2 flex items-center gap-2">
                <input type="time" value={editing.startTime} onChange={(e) => setEditing({ ...editing, startTime: e.target.value })} className="h-9 flex-1 select-text rounded-lg border border-scout-border bg-scout-bg px-3 text-[13px] focus:border-scout-accent focus:outline-none" />
                <span className="text-scout-faint">→</span>
                <input type="time" value={editing.endTime} onChange={(e) => setEditing({ ...editing, endTime: e.target.value })} className="h-9 flex-1 select-text rounded-lg border border-scout-border bg-scout-bg px-3 text-[13px] focus:border-scout-accent focus:outline-none" />
              </div>
            )}
            <input
              value={editing.location}
              onChange={(e) => setEditing({ ...editing, location: e.target.value })}
              placeholder="Location (optional)"
              className="mb-4 h-9 w-full select-text rounded-lg border border-scout-border bg-scout-bg px-3 text-[13px] focus:border-scout-accent focus:outline-none"
            />
            {!editing.editable && (
              <p className="mb-3 text-[11px] text-scout-faint">
                This event is on a read-only calendar, so it can’t be changed here.
              </p>
            )}
            <div className="flex items-center gap-2">
              {editing.id && editing.editable && (
                <button onClick={() => void remove()} disabled={busy} className="flex items-center gap-1 rounded-lg border border-scout-border px-3 py-1.5 text-[13px] text-scout-pink hover:bg-scout-pink/10 disabled:opacity-50">
                  <Trash2 size={13} /> Delete
                </button>
              )}
              <button onClick={() => void save()} disabled={busy || !editing.editable || !editing.summary.trim()} className="ml-auto rounded-lg bg-scout-accent px-4 py-1.5 text-[13px] font-medium text-white hover:brightness-110 disabled:opacity-50">
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  )
}
