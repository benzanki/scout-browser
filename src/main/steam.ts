import { execFile } from 'child_process'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { pathToFileURL } from 'url'
import type { SteamGame } from '../shared/types'

// AppIDs that are tools / redistributables, not games — filtered from the wall.
const JUNK_APPIDS = new Set(['228980', '1070560', '1391110', '1493710'])

/** Locate the Steam install root (registry first, then common paths). */
function findSteamPath(): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      'reg',
      ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'],
      { windowsHide: true },
      (err, stdout) => {
        if (!err && stdout) {
          const m = stdout.match(/SteamPath\s+REG_SZ\s+(.+)/i)
          if (m) {
            const p = m[1].trim().replace(/\//g, '\\')
            if (existsSync(p)) return resolve(p)
          }
        }
        // Fallbacks if the registry lookup fails.
        for (const guess of [
          'C:\\Program Files (x86)\\Steam',
          'C:\\Program Files\\Steam'
        ]) {
          if (existsSync(guess)) return resolve(guess)
        }
        resolve(null)
      }
    )
  })
}

/** Read every Steam library folder from libraryfolders.vdf (covers extra drives). */
function readLibraryFolders(steamPath: string): string[] {
  const libs = new Set<string>([steamPath])
  const vdf = join(steamPath, 'steamapps', 'libraryfolders.vdf')
  try {
    const text = readFileSync(vdf, 'utf-8')
    for (const m of text.matchAll(/"path"\s*"([^"]+)"/g)) {
      libs.add(m[1].replace(/\\\\/g, '\\'))
    }
  } catch {
    /* no extra libraries */
  }
  return [...libs]
}

/** Resolve the best local artwork for a game, falling back to Steam's CDN. */
function artFor(steamPath: string, appId: string): string {
  const cache = join(steamPath, 'appcache', 'librarycache')
  for (const suffix of ['_library_600x900.jpg', '_header.jpg']) {
    const file = join(cache, `${appId}${suffix}`)
    if (existsSync(file)) return pathToFileURL(file).toString()
  }
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`
}

/** Scan all Steam libraries for installed games (appid + name + artwork). */
export async function listSteamGames(): Promise<SteamGame[]> {
  const steamPath = await findSteamPath()
  if (!steamPath) return []

  const games = new Map<string, SteamGame>()
  for (const lib of readLibraryFolders(steamPath)) {
    const appsDir = join(lib, 'steamapps')
    let files: string[]
    try {
      files = readdirSync(appsDir)
    } catch {
      continue
    }
    for (const file of files) {
      if (!file.startsWith('appmanifest_') || !file.endsWith('.acf')) continue
      try {
        const text = readFileSync(join(appsDir, file), 'utf-8')
        const appId = text.match(/"appid"\s*"(\d+)"/i)?.[1]
        const name = text.match(/"name"\s*"([^"]+)"/i)?.[1]
        if (!appId || !name || JUNK_APPIDS.has(appId)) continue
        if (!games.has(appId)) {
          games.set(appId, { appId, name, art: artFor(steamPath, appId) })
        }
      } catch {
        /* skip unreadable manifest */
      }
    }
  }

  return [...games.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** Launch an installed Steam game by its appId. */
export function launchSteamGame(appId: string): void {
  execFile('cmd', ['/c', 'start', '', `steam://rungameid/${appId}`], {
    windowsHide: true
  })
}
