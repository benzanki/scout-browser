import { app, shell, safeStorage } from 'electron'
import { createServer } from 'http'
import { randomBytes, createHash } from 'crypto'
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import type { GCalEvent, GCalEventInput, GCalStatus } from '../shared/types'

const FILE = (): string => join(app.getPath('userData'), 'google-auth.json')
const SCOPE = 'openid email https://www.googleapis.com/auth/calendar'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

interface Auth {
  clientId?: string
  clientSecret?: string
  refreshToken?: string
  accessToken?: string
  expiry?: number
  email?: string
}

// ----- persistence (encrypted at rest when the OS supports it) -----
function loadAuth(): Auth {
  try {
    const raw = readFileSync(FILE())
    const json = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(raw)
      : raw.toString('utf-8')
    return JSON.parse(json) as Auth
  } catch {
    return {}
  }
}

function saveAuth(auth: Auth): void {
  const json = JSON.stringify(auth)
  const data = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(json)
    : Buffer.from(json, 'utf-8')
  writeFileSync(FILE(), data)
}

// Loaded lazily, NOT at import time: `safeStorage` (used by loadAuth) only works
// after the app is ready, and main imports this module before that — loading
// eagerly here would fail to decrypt and wipe saved creds on every launch.
let auth: Auth = {}
let loaded = false
function ensureLoaded(): void {
  if (!loaded) {
    auth = loadAuth()
    loaded = true
  }
}

const base64url = (b: Buffer): string =>
  b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

// ----- public API -----
export function setCredentials(clientId: string, clientSecret: string): void {
  ensureLoaded()
  auth = { ...auth, clientId: clientId.trim(), clientSecret: clientSecret.trim() }
  saveAuth(auth)
}

export function getStatus(): GCalStatus {
  ensureLoaded()
  return {
    hasCredentials: !!(auth.clientId && auth.clientSecret),
    connected: !!auth.refreshToken,
    email: auth.email
  }
}

export function disconnect(): GCalStatus {
  ensureLoaded()
  const { clientId, clientSecret } = auth
  auth = { clientId, clientSecret }
  try {
    if (existsSync(FILE())) unlinkSync(FILE())
  } catch {
    /* ignore */
  }
  saveAuth(auth)
  return getStatus()
}

/** Run the OAuth loopback flow: opens the system browser, catches the redirect. */
export function connect(): Promise<GCalStatus> {
  ensureLoaded()
  return new Promise((resolve) => {
    if (!auth.clientId || !auth.clientSecret) {
      resolve({ ...getStatus(), error: 'Add your Google API Client ID and Secret first.' })
      return
    }
    const verifier = base64url(randomBytes(32))
    const challenge = base64url(createHash('sha256').update(verifier).digest())
    const state = base64url(randomBytes(16))

    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1')
        if (!url.searchParams.has('code') && !url.searchParams.has('error')) {
          res.writeHead(404).end()
          return
        }
        const html = (msg: string): void => {
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(
            `<!doctype html><html><body style="font-family:system-ui;background:#0b0f17;color:#e6edf3;display:flex;height:100vh;align-items:center;justify-content:center;margin:0"><div style="text-align:center"><h2>Scout</h2><p>${msg}</p><p style="opacity:.6">You can close this tab.</p></div></body></html>`
          )
        }
        const err = url.searchParams.get('error')
        const returnedState = url.searchParams.get('state')
        if (err || returnedState !== state) {
          html('Connection cancelled.')
          server.close()
          resolve({ ...getStatus(), error: err || 'State mismatch' })
          return
        }
        const code = url.searchParams.get('code') as string
        const redirectUri = `http://127.0.0.1:${(server.address() as { port: number }).port}`
        const tokenRes = await fetch(TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: auth.clientId!,
            client_secret: auth.clientSecret!,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
            code_verifier: verifier
          })
        })
        const tok = (await tokenRes.json()) as {
          access_token?: string
          refresh_token?: string
          expires_in?: number
          error_description?: string
        }
        if (!tok.access_token) {
          html('Sign-in failed.')
          server.close()
          resolve({ ...getStatus(), error: tok.error_description || 'Token exchange failed' })
          return
        }
        auth.accessToken = tok.access_token
        auth.expiry = Date.now() + (tok.expires_in ?? 3600) * 1000
        if (tok.refresh_token) auth.refreshToken = tok.refresh_token
        // Fetch the account email for display.
        try {
          const who = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tok.access_token}` }
          })
          const info = (await who.json()) as { email?: string }
          if (info.email) auth.email = info.email
        } catch {
          /* non-fatal */
        }
        saveAuth(auth)
        html('Connected to Google Calendar.')
        server.close()
        resolve(getStatus())
      } catch (e) {
        res.writeHead(500).end()
        server.close()
        resolve({ ...getStatus(), error: String(e) })
      }
    })

    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port
      const authUrl =
        'https://accounts.google.com/o/oauth2/v2/auth?' +
        new URLSearchParams({
          client_id: auth.clientId!,
          redirect_uri: `http://127.0.0.1:${port}`,
          response_type: 'code',
          scope: SCOPE,
          access_type: 'offline',
          prompt: 'consent',
          state,
          code_challenge: challenge,
          code_challenge_method: 'S256'
        }).toString()
      void shell.openExternal(authUrl)
    })

    // Give up after 5 minutes.
    setTimeout(() => {
      try {
        server.close()
      } catch {
        /* already closed */
      }
      resolve({ ...getStatus(), error: 'Timed out' })
    }, 300_000)
  })
}

async function getAccessToken(): Promise<string | null> {
  ensureLoaded()
  if (auth.accessToken && auth.expiry && auth.expiry > Date.now() + 60_000) {
    return auth.accessToken
  }
  if (!auth.refreshToken || !auth.clientId || !auth.clientSecret) return null
  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: auth.clientId,
        client_secret: auth.clientSecret,
        refresh_token: auth.refreshToken,
        grant_type: 'refresh_token'
      })
    })
    const tok = (await res.json()) as { access_token?: string; expires_in?: number }
    if (!tok.access_token) return null
    auth.accessToken = tok.access_token
    auth.expiry = Date.now() + (tok.expires_in ?? 3600) * 1000
    saveAuth(auth)
    return tok.access_token
  } catch {
    return null
  }
}

const CAL = 'https://www.googleapis.com/calendar/v3/calendars'
const eventsUrl = (calId: string): string => `${CAL}/${encodeURIComponent(calId)}/events`

interface RawEvent {
  id: string
  summary?: string
  location?: string
  htmlLink?: string
  start: { date?: string; dateTime?: string }
  end: { date?: string; dateTime?: string }
}

function fromGoogle(g: RawEvent, calendarId: string, color?: string, editable?: boolean): GCalEvent {
  const allDay = !!g.start.date
  return {
    id: g.id,
    calendarId,
    summary: g.summary || '(no title)',
    allDay,
    start: g.start.dateTime || g.start.date || '',
    end: g.end.dateTime || g.end.date || '',
    location: g.location,
    htmlLink: g.htmlLink,
    color,
    editable
  }
}

function addDay(ymd: string): string {
  const d = new Date(ymd + 'T00:00:00')
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

function toGoogle(ev: GCalEventInput): Record<string, unknown> {
  if (ev.allDay) {
    const startDate = ev.start.slice(0, 10)
    const endDate = ev.end ? ev.end.slice(0, 10) : startDate
    return {
      summary: ev.summary,
      location: ev.location,
      start: { date: startDate },
      // Google treats all-day end as exclusive.
      end: { date: addDay(endDate) }
    }
  }
  return {
    summary: ev.summary,
    location: ev.location,
    start: { dateTime: ev.start },
    end: { dateTime: ev.end }
  }
}

interface RawCalendar {
  id: string
  summary?: string
  backgroundColor?: string
  selected?: boolean
  primary?: boolean
  accessRole?: string
}

/** Read events from EVERY visible calendar (primary + shared/other), merged. */
export async function listEvents(timeMin: string, timeMax: string): Promise<GCalEvent[]> {
  const token = await getAccessToken()
  if (!token) return []
  const headers = { Authorization: `Bearer ${token}` }

  // 1) Which calendars does the user have / show?
  const listRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers
  })
  if (!listRes.ok) return []
  const cals = ((await listRes.json()) as { items?: RawCalendar[] }).items ?? []
  // Respect the user's visibility choices, but always include primary.
  const visible = cals.filter((c) => c.selected !== false || c.primary)

  // 2) Fetch each calendar's events in parallel and tag with calendar info.
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250'
  })
  const perCal = await Promise.all(
    visible.map(async (c) => {
      try {
        const r = await fetch(`${eventsUrl(c.id)}?${params}`, { headers })
        if (!r.ok) return [] as GCalEvent[]
        const d = (await r.json()) as { items?: RawEvent[] }
        const editable = c.accessRole === 'owner' || c.accessRole === 'writer'
        return (d.items ?? []).map((it) => fromGoogle(it, c.id, c.backgroundColor, editable))
      } catch {
        return [] as GCalEvent[]
      }
    })
  )
  return perCal.flat().sort((a, b) => a.start.localeCompare(b.start))
}

export async function createEvent(ev: GCalEventInput): Promise<GCalEvent | null> {
  const token = await getAccessToken()
  if (!token) return null
  const res = await fetch(eventsUrl('primary'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(toGoogle(ev))
  })
  if (!res.ok) return null
  return fromGoogle((await res.json()) as RawEvent, 'primary', undefined, true)
}

export async function updateEvent(
  calendarId: string,
  id: string,
  ev: GCalEventInput
): Promise<GCalEvent | null> {
  const token = await getAccessToken()
  if (!token) return null
  const res = await fetch(`${eventsUrl(calendarId)}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(toGoogle(ev))
  })
  if (!res.ok) return null
  return fromGoogle((await res.json()) as RawEvent, calendarId, undefined, true)
}

export async function deleteEvent(calendarId: string, id: string): Promise<boolean> {
  const token = await getAccessToken()
  if (!token) return false
  const res = await fetch(`${eventsUrl(calendarId)}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  })
  return res.ok || res.status === 410
}
