import { useEffect, useState } from 'react'
import { Radar, MapPin } from 'lucide-react'
import { useAppStore } from '../store/appStore'

interface Coords {
  lat: number
  lon: number
  place: string
}

function windyUrl(lat: number, lon: number): string {
  const p = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    detailLat: String(lat),
    detailLon: String(lon),
    zoom: '7',
    level: 'surface',
    overlay: 'radar',
    product: 'radar',
    menu: '',
    message: '',
    marker: 'true',
    calendar: 'now',
    pressure: '',
    type: 'map',
    location: 'coordinates',
    detail: '',
    metricWind: 'mph',
    metricTemp: '°C',
    radarRange: '-1'
  })
  return `https://embed.windy.com/embed2.html?${p.toString()}`
}

// Always-on precipitation radar for the chosen city, embedded from Windy (free,
// no API key). Geocodes settings.weatherCity to coordinates.
export default function RadarMap({ className = '' }: { className?: string }): JSX.Element {
  const city = useAppStore((s) => s.settings.weatherCity) ?? 'London'
  const [coords, setCoords] = useState<Coords | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setError(false)
    setCoords(null)
    const run = async (): Promise<void> => {
      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
            city
          )}&count=1`
        )
        const geo = await res.json()
        const loc = geo?.results?.[0]
        if (!loc) throw new Error('no location')
        if (!cancelled) setCoords({ lat: loc.latitude, lon: loc.longitude, place: loc.name })
      } catch {
        if (!cancelled) setError(true)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [city])

  return (
    <div
      className={`glass-card flex min-h-[200px] flex-col overflow-hidden rounded-2xl ${className}`}
    >
      <div className="flex shrink-0 items-center gap-2 px-4 py-2.5">
        <Radar size={14} className="text-scout-accent" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-scout-faint">
          Radar
        </span>
        {coords && (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-scout-faint">
            <MapPin size={11} /> {coords.place}
          </span>
        )}
      </div>
      <div className="relative min-h-0 flex-1">
        {coords ? (
          <iframe
            title="Weather radar"
            src={windyUrl(coords.lat, coords.lon)}
            className="absolute inset-0 h-full w-full"
            frameBorder="0"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-scout-faint">
            {error ? 'Couldn’t load the radar map.' : 'Loading radar…'}
          </div>
        )}
      </div>
    </div>
  )
}
