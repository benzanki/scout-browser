import { useEffect, useState } from 'react'
import {
  Sun,
  Cloud,
  CloudRain,
  CloudDrizzle,
  CloudSnow,
  CloudFog,
  CloudLightning,
  Wind,
  Droplets,
  Sunrise,
  Sunset,
  SunMedium,
  MapPin,
  Search,
  Maximize2,
  X
} from 'lucide-react'
import { useAppStore } from '../store/appStore'
import RadarMap from './RadarMap'

interface DayForecast {
  date: string
  code: number
  hi: number
  lo: number
  precip: number
}
interface Weather {
  temp: number
  feels: number
  code: number
  humidity: number
  wind: number
  uv: number
  sunrise: string
  sunset: string
  precipToday: number
  place: string
  region: string
  lat: number
  lon: number
  days: DayForecast[]
}

function weatherIcon(code: number, size = 30): JSX.Element {
  if (code === 0 || code === 1) return <Sun size={size} className="text-scout-amber" />
  if (code === 2) return <Cloud size={size} className="text-scout-muted" />
  if (code === 3) return <Cloud size={size} className="text-scout-faint" />
  if (code >= 45 && code <= 48) return <CloudFog size={size} className="text-scout-muted" />
  if (code >= 51 && code <= 57) return <CloudDrizzle size={size} className="text-scout-accent" />
  if (code >= 71 && code <= 77) return <CloudSnow size={size} className="text-scout-teal" />
  if (code >= 85 && code <= 86) return <CloudSnow size={size} className="text-scout-teal" />
  if (code >= 95) return <CloudLightning size={size} className="text-scout-purple" />
  if (code >= 61) return <CloudRain size={size} className="text-scout-accent" />
  return <Cloud size={size} className="text-scout-muted" />
}

function weatherText(code: number): string {
  const map: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Rime fog',
    51: 'Light drizzle',
    53: 'Drizzle',
    55: 'Heavy drizzle',
    56: 'Freezing drizzle',
    57: 'Freezing drizzle',
    61: 'Light rain',
    63: 'Rain',
    65: 'Heavy rain',
    66: 'Freezing rain',
    67: 'Freezing rain',
    71: 'Light snow',
    73: 'Snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Light showers',
    81: 'Showers',
    82: 'Violent showers',
    85: 'Snow showers',
    86: 'Snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm',
    99: 'Thunderstorm, hail'
  }
  return map[code] ?? '—'
}

const dayName = (iso: string, i: number): string =>
  i === 0 ? 'Today' : new Date(iso).toLocaleDateString([], { weekday: 'short' })

const clockTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export default function WeatherWidget(): JSX.Element {
  const city = useAppStore((s) => s.settings.weatherCity) ?? 'London'
  const updateSettings = useAppStore((s) => s.updateSettings)
  const [weather, setWeather] = useState<Weather | null>(null)
  const [error, setError] = useState(false)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    setError(false)
    setWeather(null)
    const run = async (): Promise<void> => {
      try {
        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
            city
          )}&count=1`
        )
        const geo = await geoRes.json()
        const loc = geo?.results?.[0]
        if (!loc) throw new Error('no location')
        const params = new URLSearchParams({
          latitude: String(loc.latitude),
          longitude: String(loc.longitude),
          current:
            'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m',
          daily:
            'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,uv_index_max',
          timezone: 'auto',
          wind_speed_unit: 'mph',
          forecast_days: '7'
        })
        const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
        const w = await wRes.json()
        if (cancelled) return
        const d = w.daily
        const days: DayForecast[] = d.time.map((date: string, i: number) => ({
          date,
          code: d.weather_code[i],
          hi: Math.round(d.temperature_2m_max[i]),
          lo: Math.round(d.temperature_2m_min[i]),
          precip: d.precipitation_probability_max?.[i] ?? 0
        }))
        setWeather({
          temp: Math.round(w.current.temperature_2m),
          feels: Math.round(w.current.apparent_temperature),
          code: w.current.weather_code,
          humidity: w.current.relative_humidity_2m,
          wind: Math.round(w.current.wind_speed_10m),
          uv: Math.round(d.uv_index_max?.[0] ?? 0),
          sunrise: d.sunrise[0],
          sunset: d.sunset[0],
          precipToday: d.precipitation_probability_max?.[0] ?? 0,
          place: loc.name,
          region: loc.admin1 ?? loc.country ?? '',
          lat: loc.latitude,
          lon: loc.longitude,
          days
        })
      } catch {
        if (!cancelled) setError(true)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [city])

  const submitSearch = (): void => {
    const c = search.trim()
    if (c) updateSettings({ weatherCity: c })
    setSearch('')
  }

  return (
    <>
      {/* Compact card */}
      <div className="glass-card flex flex-col rounded-2xl p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-scout-faint">
            Weather
          </span>
          {weather && (
            <button
              onClick={() => setOpen(true)}
              title="Forecast & radar"
              className="rounded-md p-1 text-scout-faint hover:bg-scout-surface-2 hover:text-scout-text"
            >
              <Maximize2 size={13} />
            </button>
          )}
        </div>

        {error ? (
          <button
            onClick={() => setOpen(true)}
            className="text-left text-sm text-scout-muted hover:text-scout-text"
          >
            Couldn’t load weather — set your city
          </button>
        ) : !weather ? (
          <div className="text-sm text-scout-faint">Loading…</div>
        ) : (
          <button onClick={() => setOpen(true)} className="text-left">
            <div className="flex items-center gap-3">
              {weatherIcon(weather.code, 32)}
              <div className="min-w-0">
                <div className="text-2xl font-semibold leading-none text-scout-text">
                  {weather.temp}°
                </div>
                <div className="mt-0.5 truncate text-xs text-scout-muted">
                  {weatherText(weather.code)}
                </div>
              </div>
              <div className="ml-auto flex items-center gap-1 text-xs text-scout-faint">
                <MapPin size={11} /> {weather.place}
              </div>
            </div>
            {/* 7-day mini strip */}
            <div className="mt-3 grid grid-cols-7 gap-1 border-t border-scout-border pt-2.5">
              {weather.days.map((d, i) => (
                <div key={d.date} className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-scout-faint">{dayName(d.date, i)}</span>
                  {weatherIcon(d.code, 15)}
                  <span className="text-[10px] font-medium text-scout-text">{d.hi}°</span>
                  <span className="text-[10px] text-scout-faint">{d.lo}°</span>
                </div>
              ))}
            </div>
          </button>
        )}
      </div>

      {/* Detailed panel */}
      {open && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 backdrop-blur-sm"
          onMouseDown={() => setOpen(false)}
        >
          <div
            className="glass-strong mt-[6vh] flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-scout-border shadow-2xl shadow-black/50"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* header + city search */}
            <div className="flex items-center gap-2 border-b border-scout-border px-4 py-3">
              <MapPin size={15} className="text-scout-accent" />
              <span className="text-sm font-semibold">
                {weather ? `${weather.place}${weather.region ? `, ${weather.region}` : ''}` : 'Weather'}
              </span>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  submitSearch()
                }}
                className="ml-auto flex h-8 items-center gap-1.5 rounded-lg border border-scout-border bg-scout-bg px-2.5"
              >
                <Search size={13} className="text-scout-faint" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Change city"
                  className="w-28 select-text bg-transparent text-[13px] focus:outline-none"
                />
              </form>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-scout-muted hover:bg-scout-surface-2 hover:text-scout-text"
              >
                <X size={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {!weather ? (
                <div className="py-10 text-center text-sm text-scout-faint">
                  {error ? 'Couldn’t load weather for that city.' : 'Loading…'}
                </div>
              ) : (
                <>
                  {/* Current conditions */}
                  <div className="flex items-center gap-4">
                    {weatherIcon(weather.code, 52)}
                    <div>
                      <div className="text-5xl font-semibold tracking-tight text-scout-text">
                        {weather.temp}°
                      </div>
                      <div className="text-sm text-scout-muted">
                        {weatherText(weather.code)} · feels {weather.feels}°
                      </div>
                    </div>
                  </div>

                  {/* Stat grid */}
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <Stat icon={<Droplets size={15} />} label="Humidity" value={`${weather.humidity}%`} />
                    <Stat icon={<Wind size={15} />} label="Wind" value={`${weather.wind} mph`} />
                    <Stat icon={<CloudRain size={15} />} label="Rain chance" value={`${weather.precipToday}%`} />
                    <Stat icon={<SunMedium size={15} />} label="UV index" value={`${weather.uv}`} />
                    <Stat icon={<Sunrise size={15} />} label="Sunrise" value={clockTime(weather.sunrise)} />
                    <Stat icon={<Sunset size={15} />} label="Sunset" value={clockTime(weather.sunset)} />
                  </div>

                  {/* 7-day forecast */}
                  <div className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-scout-faint">
                    7-day forecast
                  </div>
                  <div className="mt-2 divide-y divide-scout-border overflow-hidden rounded-xl border border-scout-border">
                    {weather.days.map((d, i) => (
                      <div key={d.date} className="flex items-center gap-3 px-3 py-2">
                        <span className="w-12 text-[13px] font-medium text-scout-text">
                          {dayName(d.date, i)}
                        </span>
                        {weatherIcon(d.code, 18)}
                        <span className="flex-1 truncate text-[12px] text-scout-muted">
                          {weatherText(d.code)}
                        </span>
                        {d.precip > 0 && (
                          <span className="flex items-center gap-1 text-[11px] text-scout-accent">
                            <Droplets size={11} /> {d.precip}%
                          </span>
                        )}
                        <span className="w-10 text-right text-[13px] font-medium text-scout-text">
                          {d.hi}°
                        </span>
                        <span className="w-8 text-right text-[13px] text-scout-faint">{d.lo}°</span>
                      </div>
                    ))}
                  </div>

                  {/* Radar map (lives here, at a useful size) */}
                  <div className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-scout-faint">
                    Radar
                  </div>
                  <RadarMap className="mt-2 h-[340px]" />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Stat({
  icon,
  label,
  value
}: {
  icon: JSX.Element
  label: string
  value: string
}): JSX.Element {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-scout-border bg-scout-bg px-3 py-2">
      <span className="text-scout-faint">{icon}</span>
      <div className="min-w-0">
        <div className="text-[11px] text-scout-faint">{label}</div>
        <div className="text-[13px] font-medium text-scout-text">{value}</div>
      </div>
    </div>
  )
}
