import { app, session, ipcMain, type BrowserWindow } from 'electron'
import { promises as fs } from 'fs'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  IPC,
  BROWSING_PARTITIONS,
  type PermissionDecision,
  type PermissionEntry
} from '../shared/types'

// Sites that ask for camera/mic/location get an in-app prompt (rendered by the
// renderer), and the choice is remembered per-site so polling pages don't spam.
// Decisions are persisted and can be changed later from the address-bar menu.
const AUTO_GRANT = new Set([
  'fullscreen',
  'pointerLock',
  'clipboard-sanitized-write',
  'clipboard-read',
  'idle-detection',
  // Lets apps (Discord/Spotify) pick an output device / use setSinkId.
  'speaker-selection'
])
const PROMPT = new Set(['media', 'geolocation', 'notifications'])

// `${origin}|${permission}` -> 'allow' | 'block'
const decisions = new Map<string, PermissionDecision>()
const FILE = (): string => join(app.getPath('userData'), 'permissions.json')

const keyOf = (origin: string, permission: string): string => `${origin}|${permission}`

function load(): void {
  try {
    const obj = JSON.parse(readFileSync(FILE(), 'utf-8')) as Record<string, PermissionDecision>
    for (const [k, v] of Object.entries(obj)) decisions.set(k, v)
  } catch {
    /* none yet */
  }
}

function save(): void {
  try {
    writeFileSync(FILE(), JSON.stringify(Object.fromEntries(decisions)), 'utf-8')
  } catch {
    /* best effort */
  }
}

function originOf(url: string | undefined, fallback: string): string {
  try {
    return new URL(url || fallback).origin
  } catch {
    return fallback || 'unknown'
  }
}

interface Pending {
  key: string
  callbacks: ((granted: boolean) => void)[]
}

export function registerPermissions(getWindow: () => BrowserWindow | null): void {
  load()

  let nextId = 1
  const pending = new Map<number, Pending>()
  const pendingByKey = new Map<string, number>()

  const checkHandler: Parameters<
    Electron.Session['setPermissionCheckHandler']
  >[0] = (_wc, permission, requestingOrigin) => {
    if (AUTO_GRANT.has(permission)) return true
    return decisions.get(keyOf(requestingOrigin, permission)) === 'allow'
  }

  const requestHandler: Parameters<Electron.Session['setPermissionRequestHandler']>[0] = (
    wc,
    permission,
    callback,
    details
  ) => {
    if (AUTO_GRANT.has(permission)) return callback(true)
    if (!PROMPT.has(permission)) return callback(false)

    const origin = originOf((details as { requestingUrl?: string }).requestingUrl, wc.getURL())
    const key = keyOf(origin, permission)

    const remembered = decisions.get(key)
    if (remembered) return callback(remembered === 'allow')

    // Coalesce concurrent requests for the same site+permission into one prompt.
    const existingId = pendingByKey.get(key)
    if (existingId !== undefined) {
      pending.get(existingId)?.callbacks.push((g) => callback(g))
      return
    }

    const win = getWindow()
    if (!win) return callback(false)

    const id = nextId++
    pending.set(id, { key, callbacks: [(g) => callback(g)] })
    pendingByKey.set(key, id)

    let host = origin
    try {
      host = new URL(origin).hostname
    } catch {
      /* keep origin */
    }
    win.webContents.send(IPC.PERMISSION_REQUEST, {
      id,
      host,
      permission,
      mediaTypes: (details as { mediaTypes?: string[] }).mediaTypes
    })
  }

  // Apply the same prompts/decisions to BOTH the persistent and private sessions.
  for (const part of BROWSING_PARTITIONS) {
    const ses = session.fromPartition(part)
    ses.setPermissionCheckHandler(checkHandler)
    ses.setPermissionRequestHandler(requestHandler)
  }

  // Renderer's prompt result.
  ipcMain.on(
    IPC.PERMISSION_RESPOND,
    (_e, payload: { id: number; decision: PermissionDecision }) => {
      const p = pending.get(payload.id)
      if (!p) return
      decisions.set(p.key, payload.decision)
      save()
      pending.delete(payload.id)
      pendingByKey.delete(p.key)
      const granted = payload.decision === 'allow'
      p.callbacks.forEach((cb) => cb(granted))
    }
  )

  // List the current decisions for an origin (for the site-permissions menu).
  ipcMain.handle(IPC.PERMISSION_LIST, (_e, origin: string): PermissionEntry[] => {
    const out: PermissionEntry[] = []
    for (const perm of PROMPT) {
      const d = decisions.get(keyOf(origin, perm))
      if (d) out.push({ permission: perm, decision: d })
    }
    return out
  })

  // Change / clear a decision from the menu ('ask' clears it).
  ipcMain.on(
    IPC.PERMISSION_SET,
    (_e, payload: { origin: string; permission: string; decision: PermissionDecision | 'ask' }) => {
      const key = keyOf(payload.origin, payload.permission)
      if (payload.decision === 'ask') decisions.delete(key)
      else decisions.set(key, payload.decision)
      save()
    }
  )
}

// Exposed for potential future use (e.g. a full settings page).
export async function clearAllPermissions(): Promise<void> {
  decisions.clear()
  try {
    await fs.unlink(FILE())
  } catch {
    /* ignore */
  }
}
