import { useState } from 'react'
import { Search, Globe } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { useUiStore } from '../store/uiStore'
import { hostnameOf } from '../lib/url'
import AppIcon from './AppIcon'
import { ClockWidget, TaskListWidget } from './HubWidgets'
import WeatherWidget from './WeatherWidget'
import CalendarTile from './CalendarTile'
import SteamWall from './SteamWall'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Late night'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function HubHome(): JSX.Element {
  const shortcuts = useAppStore((s) => s.shortcuts)
  const navigate = useAppStore((s) => s.navigate)
  const hiddenWidgets = useAppStore((s) => s.settings.hiddenWidgets)
  const setHubView = useUiStore((s) => s.setHubView)
  const [q, setQ] = useState('')

  // Search / shortcuts switch to the browser view inside the Hub.
  const go = (input: string): void => {
    if (!input.trim()) return
    navigate(input)
    setHubView('browser')
  }

  // Widget visibility (toggled in Settings → Dashboard).
  const showW = (k: string): boolean => !(hiddenWidgets ?? []).includes(k)
  const smallWidgets = [
    showW('clock') && <ClockWidget key="clock" />,
    showW('weather') && <WeatherWidget key="weather" />,
    showW('tasks') && <TaskListWidget key="tasks" className="min-h-[160px] flex-1" />
  ].filter(Boolean)

  return (
    <div className="absolute inset-0 overflow-y-auto">
      <div className="fade-up mx-auto w-full max-w-5xl px-8 py-[6vh]">
        {/* Greeting + search */}
        <h1 className="text-gradient text-3xl font-bold tracking-tight">
          {greeting()}
        </h1>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            go(q)
          }}
          className="glass focus-glow mt-5 flex h-13 items-center gap-3 rounded-2xl border border-scout-border px-5 shadow-lg shadow-black/30 transition-shadow focus-within:border-scout-accent"
        >
          <Search size={18} className="shrink-0 text-scout-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the web or enter a URL"
            spellCheck={false}
            className="h-full w-full select-text bg-transparent text-[15px] text-scout-text placeholder:text-scout-faint focus:outline-none"
          />
        </form>

        {/* Quick links */}
        {shortcuts.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {shortcuts.map((s) => (
              <button
                key={s.id}
                onClick={() => go(s.url)}
                className="glass flex items-center gap-2 rounded-full border border-scout-border px-3 py-1.5 text-[13px] text-scout-muted transition-all hover:-translate-y-0.5 hover:border-scout-accent hover:text-scout-text"
              >
                <AppIcon label={s.label || hostnameOf(s.url)} url={s.url} size={18} />
                {s.label || hostnameOf(s.url)}
              </button>
            ))}
          </div>
        )}

        {/* Widgets — calendar centrepiece (2/3) + a side column; each toggleable
            in Settings. Layout adapts when the calendar or all smalls are hidden. */}
        {showW('calendar') ? (
          <div className="mt-7 grid grid-cols-1 gap-3 lg:grid-cols-3">
            <CalendarTile
              className={smallWidgets.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}
            />
            {smallWidgets.length > 0 && (
              <div className="flex flex-col gap-3">{smallWidgets}</div>
            )}
          </div>
        ) : smallWidgets.length > 0 ? (
          <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {smallWidgets}
          </div>
        ) : null}

        {/* Games */}
        {showW('games') && (
          <div className="mt-8">
            <SteamWall />
          </div>
        )}

        <div className="mt-10 flex items-center justify-center gap-2 text-[11px] text-scout-faint">
          <Globe size={12} /> Search above to jump into the browser
        </div>
      </div>
    </div>
  )
}
