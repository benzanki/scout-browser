import { ipcMain, type BrowserWindow } from 'electron'
import { IPC, type UpdateInfo } from '../shared/types'

// Scout can't silently self-update (that needs a packaged app + a publish
// pipeline), but it can check the latest Electron release and flag when the
// bundled browser engine — and therefore its security patches — is behind.

function semverGt(a: string, b: string): boolean {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d !== 0) return d > 0
  }
  return false
}

async function fetchLatestElectron(): Promise<string | null> {
  try {
    const res = await fetch('https://registry.npmjs.org/electron/latest', {
      signal: AbortSignal.timeout(15000)
    })
    if (!res.ok) return null
    const json = (await res.json()) as { version?: string }
    return json.version ?? null
  } catch {
    return null
  }
}

async function compute(): Promise<UpdateInfo> {
  const currentElectron = process.versions.electron
  const chromium = process.versions.chrome
  const latest = await fetchLatestElectron()
  return {
    currentElectron,
    latestElectron: latest ?? currentElectron,
    chromium,
    behind: latest ? semverGt(latest, currentElectron) : false
  }
}

export function registerUpdates(getWindow: () => BrowserWindow | null): void {
  // On-demand check (Settings "Check for updates").
  ipcMain.handle(IPC.UPDATE_CHECK, () => compute())

  // Startup check → push a notification to the UI if we're behind.
  setTimeout(() => {
    void compute().then((info) => {
      if (info.behind) getWindow()?.webContents.send(IPC.UPDATE_INFO, info)
    })
  }, 4000)
}
