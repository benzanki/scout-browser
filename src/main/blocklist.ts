import { app, session, ipcMain } from 'electron'
import { promises as fs } from 'fs'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { IPC, BROWSING_PARTITIONS } from '../shared/types'

// Local "Safe Browsing lite": download public malware/phishing domain lists and
// block top-level navigation to them. No API key, and (unlike Google Safe
// Browsing) the URLs you visit are never sent anywhere — matching is local.
const SOURCES = [
  'https://urlhaus.abuse.ch/downloads/hostfile/', // active malware hosts (abuse.ch)
  'https://phishing.army/download/phishing_army_blocklist.txt' // phishing domains
]
const REFRESH_MS = 12 * 60 * 60 * 1000 // twice a day
const CACHE = (): string => join(app.getPath('userData'), 'blocklist.json')

const blocked = new Set<string>()
// User-trusted domains that bypass the blocklist (false positives, etc.).
const allowed = new Set<string>()
const ALLOW_FILE = (): string => join(app.getPath('userData'), 'blocklist-allow.json')

function loadAllowed(): void {
  try {
    for (const d of JSON.parse(readFileSync(ALLOW_FILE(), 'utf-8')) as string[])
      allowed.add(d)
  } catch {
    /* none yet */
  }
}
function saveAllowed(): void {
  try {
    writeFileSync(ALLOW_FILE(), JSON.stringify([...allowed]), 'utf-8')
  } catch {
    /* best effort */
  }
}

// True if the host (or a parent) is on the user's allowlist.
function isAllowed(hostname: string): boolean {
  if (allowed.size === 0) return false
  let h = hostname.toLowerCase()
  if (allowed.has(h)) return true
  let dot = h.indexOf('.')
  while (dot !== -1) {
    h = h.slice(dot + 1)
    if (allowed.has(h)) return true
    dot = h.indexOf('.')
  }
  return false
}

function add(domain: string): void {
  const d = domain.trim().toLowerCase().replace(/\.$/, '')
  if (d && d.includes('.') && !d.includes(' ')) blocked.add(d)
}

function parse(text: string): void {
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const parts = line.split(/\s+/)
    // hosts format "0.0.0.0 domain" → take the domain; else the whole token.
    add(parts.length > 1 ? parts[1] : parts[0])
  }
}

// A host is blocked if it (or any parent domain) is on a list — unless the user
// has explicitly allowed it.
function isBlocked(hostname: string): boolean {
  if (blocked.size === 0 || isAllowed(hostname)) return false
  let h = hostname.toLowerCase()
  if (blocked.has(h)) return true
  let dot = h.indexOf('.')
  while (dot !== -1) {
    h = h.slice(dot + 1)
    if (blocked.has(h)) return true
    dot = h.indexOf('.')
  }
  return false
}

async function loadCache(): Promise<void> {
  try {
    const raw = await fs.readFile(CACHE(), 'utf-8')
    for (const d of JSON.parse(raw) as string[]) blocked.add(d)
  } catch {
    /* no cache yet */
  }
}

async function saveCache(): Promise<void> {
  try {
    await fs.writeFile(CACHE(), JSON.stringify([...blocked]), 'utf-8')
  } catch {
    /* best effort */
  }
}

async function refresh(): Promise<void> {
  let any = false
  for (const url of SOURCES) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
      if (!res.ok) continue
      parse(await res.text())
      any = true
    } catch {
      /* offline / source down — keep what we have */
    }
  }
  if (any) await saveCache()
}

// Block top-level navigations to flagged domains for the browsing session.
export async function registerBlocklist(): Promise<void> {
  loadAllowed()
  await loadCache() // instant protection from the last cached lists

  // "Continue anyway" on the blocked page → trust this domain from now on.
  const normHost = (host: string): string => host.trim().toLowerCase().replace(/^www\./, '')
  ipcMain.on(IPC.BLOCKLIST_ALLOW, (_e, host: string) => {
    if (host) {
      allowed.add(normHost(host))
      saveAllowed()
    }
  })
  ipcMain.on(IPC.BLOCKLIST_REVOKE, (_e, host: string) => {
    allowed.delete(normHost(host))
    saveAllowed()
  })
  ipcMain.handle(IPC.BLOCKLIST_ALLOWED, () => [...allowed])

  // Gate navigations on BOTH the persistent and private browsing sessions.
  for (const part of BROWSING_PARTITIONS) {
    session.fromPartition(part).webRequest.onBeforeRequest((details, callback) => {
      // Only gate full-page navigations (not every subresource) to keep it light
      // and avoid breaking pages on false positives.
      if (details.resourceType !== 'mainFrame') return callback({})
      try {
        if (isBlocked(new URL(details.url).hostname)) return callback({ cancel: true })
      } catch {
        /* unparseable url */
      }
      callback({})
    })
  }

  void refresh()
  setInterval(() => void refresh(), REFRESH_MS)
}
