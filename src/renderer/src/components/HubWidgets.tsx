import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Cpu,
  MemoryStick,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  Check,
  Plus,
  X,
  ListTodo
} from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { isElectron } from '../lib/env'
import type { SystemStats } from '../../../shared/types'

/** Shared card chrome for every widget. */
function Card({
  title,
  children,
  className = ''
}: {
  title?: string
  children: React.ReactNode
  className?: string
}): JSX.Element {
  return (
    <div className={`glass-card flex flex-col rounded-2xl p-4 ${className}`}>
      {title && (
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-scout-faint">
          {title}
        </div>
      )}
      {children}
    </div>
  )
}

function Bar({ value, tint }: { value: number; tint: string }): JSX.Element {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-scout-surface-2">
      <div className={`h-full rounded-full ${tint}`} style={{ width: `${value}%` }} />
    </div>
  )
}

// ----- Clock -----
export function ClockWidget(): JSX.Element {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const date = now.toLocaleDateString([], {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  })
  return (
    <Card className="items-start justify-center">
      <div className="text-4xl font-semibold tracking-tight text-scout-text">{time}</div>
      <div className="mt-1 text-sm text-scout-muted">{date}</div>
    </Card>
  )
}

// ----- System stats -----
function gb(bytes: number): string {
  return (bytes / 1024 ** 3).toFixed(1)
}

export function SystemStatsWidget(): JSX.Element {
  const [stats, setStats] = useState<SystemStats | null>(null)
  useEffect(() => {
    if (!isElectron) return
    let alive = true
    const poll = async (): Promise<void> => {
      try {
        const s = await window.scout.getSystemStats()
        if (alive) setStats(s)
      } catch {
        /* ignore */
      }
    }
    void poll()
    const t = setInterval(poll, 2000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])

  return (
    <Card title="System">
      <div className="flex flex-col gap-3">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-scout-muted">
              <Cpu size={13} /> CPU
            </span>
            <span className="text-scout-faint">{stats ? `${stats.cpu}%` : '—'}</span>
          </div>
          <Bar value={stats?.cpu ?? 0} tint="bg-scout-accent" />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-scout-muted">
              <MemoryStick size={13} /> Memory
            </span>
            <span className="text-scout-faint">
              {stats ? `${gb(stats.memUsed)} / ${gb(stats.memTotal)} GB` : '—'}
            </span>
          </div>
          <Bar value={stats?.memPercent ?? 0} tint="bg-scout-green" />
        </div>
      </div>
    </Card>
  )
}

// ----- Calendar -----
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export function CalendarWidget(): JSX.Element {
  const today = useMemo(() => new Date(), [])
  const [view, setView] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))

  const cells = useMemo(() => {
    const year = view.getFullYear()
    const month = view.getMonth()
    const first = new Date(year, month, 1)
    // Convert Sun=0 week start to Mon=0.
    const lead = (first.getDay() + 6) % 7
    const days = new Date(year, month + 1, 0).getDate()
    const arr: (number | null)[] = []
    for (let i = 0; i < lead; i++) arr.push(null)
    for (let d = 1; d <= days; d++) arr.push(d)
    return arr
  }, [view])

  const isToday = (d: number): boolean =>
    d === today.getDate() &&
    view.getMonth() === today.getMonth() &&
    view.getFullYear() === today.getFullYear()

  const shift = (delta: number): void =>
    setView((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1))

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-scout-text">
          {MONTHS[view.getMonth()]} {view.getFullYear()}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => shift(-1)}
            className="rounded-md p-1 text-scout-faint hover:bg-scout-surface-2 hover:text-scout-text"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={() => shift(1)}
            className="rounded-md p-1 text-scout-faint hover:bg-scout-surface-2 hover:text-scout-text"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {DOW.map((d, i) => (
          <div key={i} className="text-[10px] font-medium text-scout-faint">
            {d}
          </div>
        ))}
        {cells.map((d, i) => (
          <div key={i} className="flex items-center justify-center">
            {d && (
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] ${
                  isToday(d)
                    ? 'bg-scout-accent font-semibold text-white'
                    : 'text-scout-muted'
                }`}
              >
                {d}
              </span>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

// ----- Task list (standalone — not linked to the scratchpad) -----
export function TaskListWidget({ className = '' }: { className?: string }): JSX.Element {
  const tasks = useAppStore((s) => s.tasks)
  const addTask = useAppStore((s) => s.addTask)
  const toggleTask = useAppStore((s) => s.toggleTask)
  const removeTask = useAppStore((s) => s.removeTask)
  const clearCompleted = useAppStore((s) => s.clearCompletedTasks)
  const [text, setText] = useState('')

  // Completed tasks sink below active ones (stable sort keeps insertion order).
  const ordered = useMemo(
    () => [...tasks].sort((a, b) => Number(a.done) - Number(b.done)),
    [tasks]
  )
  const completedCount = tasks.filter((t) => t.done).length

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    addTask(t)
    setText('')
  }

  return (
    <Card title="Tasks" className={`min-h-[160px] ${className}`}>
      <form onSubmit={submit} className="mb-2 flex items-center gap-2 border-b border-scout-border pb-2">
        <Plus size={14} className="shrink-0 text-scout-faint" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a task…"
          spellCheck={false}
          className="w-full select-text bg-transparent text-sm text-scout-text placeholder:text-scout-faint focus:outline-none"
        />
      </form>
      <div className="-mr-1 min-h-0 flex-1 overflow-y-auto pr-1">
        {tasks.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 py-4 text-scout-faint">
            <ListTodo size={20} />
            <span className="text-xs">No tasks yet</span>
          </div>
        ) : (
          <div className="flex flex-col">
            {ordered.map((t) => (
              <div key={t.id} className="group/task flex items-center gap-2.5 py-1">
                <button
                  onClick={() => toggleTask(t.id)}
                  title={t.done ? 'Mark not done' : 'Mark done'}
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                    t.done
                      ? 'border-scout-accent bg-scout-accent'
                      : 'border-scout-faint hover:border-scout-accent'
                  }`}
                >
                  {t.done && <Check size={11} className="text-white" />}
                </button>
                <span
                  className={`flex-1 truncate text-[13px] ${
                    t.done ? 'text-scout-faint line-through' : 'text-scout-text'
                  }`}
                >
                  {t.text}
                </span>
                <button
                  onClick={() => removeTask(t.id)}
                  title="Delete task"
                  className="shrink-0 text-scout-faint opacity-0 transition-opacity hover:text-scout-pink group-hover/task:opacity-100"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      {completedCount > 0 && (
        <button
          onClick={clearCompleted}
          className="mt-2 self-end border-t border-transparent text-[11px] text-scout-faint hover:text-scout-text"
        >
          Clear completed ({completedCount})
        </button>
      )}
    </Card>
  )
}

// ----- Focus timer -----
const PRESETS = [25, 15, 5]

export function FocusTimerWidget(): JSX.Element {
  const [secsLeft, setSecsLeft] = useState(25 * 60)
  const [duration, setDuration] = useState(25 * 60)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!running) return
    const t = setInterval(() => {
      setSecsLeft((s) => {
        if (s <= 1) {
          setRunning(false)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [running])

  const setPreset = (mins: number): void => {
    setDuration(mins * 60)
    setSecsLeft(mins * 60)
    setRunning(false)
  }

  const mm = String(Math.floor(secsLeft / 60)).padStart(2, '0')
  const ss = String(secsLeft % 60).padStart(2, '0')
  const pct = duration > 0 ? ((duration - secsLeft) / duration) * 100 : 0

  return (
    <Card title="Focus">
      <div className="flex items-center justify-between">
        <div className="text-3xl font-semibold tabular-nums tracking-tight text-scout-text">
          {mm}:{ss}
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setRunning((r) => !r)}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-scout-accent text-white hover:brightness-110"
          >
            {running ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <button
            onClick={() => {
              setSecsLeft(duration)
              setRunning(false)
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-scout-border text-scout-muted hover:bg-scout-surface-2 hover:text-scout-text"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>
      <div className="mt-2.5">
        <Bar value={pct} tint="bg-scout-purple" />
      </div>
      <div className="mt-2.5 flex gap-1.5">
        {PRESETS.map((m) => (
          <button
            key={m}
            onClick={() => setPreset(m)}
            className={`rounded-md px-2 py-0.5 text-[11px] ${
              duration === m * 60
                ? 'bg-scout-surface-2 text-scout-text'
                : 'text-scout-faint hover:text-scout-text'
            }`}
          >
            {m}m
          </button>
        ))}
      </div>
    </Card>
  )
}
