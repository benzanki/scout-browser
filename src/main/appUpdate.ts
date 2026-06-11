import { app, ipcMain, type BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'
import { IPC, type AppUpdateStatus } from '../shared/types'

const { autoUpdater } = electronUpdater

// Self-update Scout from its GitHub releases (publish config in
// electron-builder.yml). Downloads in the background and prompts to restart.
export function registerAppUpdates(getWindow: () => BrowserWindow | null): void {
  // Only meaningful in a packaged build; in dev there's no update metadata.
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  const send = (status: AppUpdateStatus): void =>
    getWindow()?.webContents.send(IPC.APP_UPDATE, status)

  autoUpdater.on('checking-for-update', () => send({ state: 'checking' }))
  autoUpdater.on('update-available', (info) =>
    send({ state: 'downloading', version: info.version, percent: 0 })
  )
  autoUpdater.on('update-not-available', () => send({ state: 'none' }))
  autoUpdater.on('download-progress', (p) =>
    send({ state: 'downloading', percent: Math.round(p.percent) })
  )
  autoUpdater.on('update-downloaded', (info) =>
    send({ state: 'downloaded', version: info.version })
  )
  autoUpdater.on('error', (err) =>
    // Offline / no release / misconfig — non-fatal, just report.
    send({ state: 'error', message: String(err?.message ?? err) })
  )

  // Renderer asks to restart into the new version. isSilent=true installs in the
  // background (no installer dialog); isForceRunAfter=true relaunches Scout.
  ipcMain.on(IPC.APP_UPDATE_INSTALL, () => {
    try {
      autoUpdater.quitAndInstall(true, true)
    } catch {
      /* ignore */
    }
  })

  const check = (): void => {
    autoUpdater.checkForUpdates().catch(() => {
      /* swallow (offline / not configured) */
    })
  }
  // Shortly after launch, then every 6 hours.
  setTimeout(check, 8000)
  setInterval(check, 6 * 60 * 60 * 1000)
}
