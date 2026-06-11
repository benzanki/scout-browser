import { useEffect, useState } from 'react'
import { Gamepad2, Play, RotateCw } from 'lucide-react'
import { isElectron } from '../lib/env'
import type { SteamGame } from '../../../shared/types'

/** A single game tile with art + CDN fallbacks. */
function GameTile({ game }: { game: SteamGame }): JSX.Element {
  // art → CDN vertical capsule → CDN header → letter placeholder.
  const fallbacks = [
    game.art,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appId}/library_600x900.jpg`,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appId}/header.jpg`
  ].filter(Boolean)
  const [srcIdx, setSrcIdx] = useState(0)
  const failed = srcIdx >= fallbacks.length

  return (
    <button
      onClick={() => window.scout?.launchSteamGame(game.appId)}
      title={`Launch ${game.name}`}
      className="group/game relative aspect-[2/3] overflow-hidden rounded-xl border border-scout-border bg-scout-surface-2 transition-all duration-200 hover:-translate-y-1 hover:scale-[1.02] hover:border-scout-accent hover:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.7),0_0_24px_-6px_rgba(123,140,255,0.35)]"
    >
      {failed ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-2 text-center">
          <Gamepad2 size={22} className="text-scout-faint" />
          <span className="line-clamp-3 text-[11px] text-scout-muted">{game.name}</span>
        </div>
      ) : (
        <img
          src={fallbacks[srcIdx]}
          alt={game.name}
          loading="lazy"
          onError={() => setSrcIdx((i) => i + 1)}
          className="h-full w-full object-cover"
        />
      )}
      {/* hover overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-end gap-2 bg-gradient-to-t from-black/85 via-black/10 to-transparent p-3 opacity-0 transition-opacity group-hover/game:opacity-100">
        <div className="btn-gradient flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-white">
          <Play size={13} /> Play
        </div>
      </div>
    </button>
  )
}

export default function SteamWall(): JSX.Element {
  const [games, setGames] = useState<SteamGame[] | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async (): Promise<void> => {
    if (!isElectron) {
      setGames([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setGames(await window.scout.listSteamGames())
    } catch {
      setGames([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Gamepad2 size={15} className="text-scout-faint" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-scout-faint">
          Games
        </span>
        {games && games.length > 0 && (
          <span className="text-[11px] text-scout-faint">{games.length}</span>
        )}
        <button
          onClick={() => void load()}
          title="Rescan library"
          className="ml-auto rounded-md p-1 text-scout-faint hover:bg-scout-surface-2 hover:text-scout-text"
        >
          <RotateCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="py-6 text-center text-xs text-scout-faint">Scanning Steam library…</div>
      ) : !games || games.length === 0 ? (
        <div className="rounded-xl border border-dashed border-scout-border py-8 text-center">
          <Gamepad2 size={22} className="mx-auto text-scout-faint" />
          <p className="mt-2 text-[13px] text-scout-muted">
            {isElectron ? 'No installed Steam games found' : 'Steam games appear in the desktop app'}
          </p>
          <p className="mt-1 text-[11px] text-scout-faint">
            Make sure Steam is installed and you have games downloaded.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(108px,1fr))] gap-3">
          {games.map((g) => (
            <GameTile key={g.appId} game={g} />
          ))}
        </div>
      )}
    </section>
  )
}
