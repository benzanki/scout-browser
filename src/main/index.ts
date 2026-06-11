import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  webContents,
  session,
  dialog,
  screen
} from 'electron'
import { join } from 'path'
import { writeFile } from 'fs/promises'
import { loadState, saveState } from './store'
import { openPipWindow } from './pip'
import { matchShortcut } from './shortcuts'
import { showPageContextMenu, showEditContextMenu } from './contextMenu'
import { registerDownloads } from './downloads'
import { registerPermissions } from './permissions'
import { registerBlocklist } from './blocklist'
import { registerUpdates } from './updates'
import { registerAppUpdates } from './appUpdate'
import { loadWindowState, trackWindowState } from './windowState'
import { listSteamGames, launchSteamGame } from './steam'
import {
  getOpenAtLogin,
  setOpenAtLogin,
  launchExternal,
  launchDiscord,
  getSystemStats
} from './system'
import * as gcal from './googleCalendar'
import {
  IPC,
  MAIN_PARTITION,
  PRIVATE_PARTITION,
  type AppState,
  type GCalEventInput
} from '../shared/types'
import icon from '../../resources/icon.png?asset'

let mainWindow: BrowserWindow | null = null

// Route browser shortcuts to the renderer. Attached to the main window and to
// each embedded <webview> so shortcuts fire regardless of where focus is.
function attachShortcutRouter(wc: Electron.WebContents): void {
  wc.on('before-input-event', (event, input) => {
    const cmd = matchShortcut(input)
    if (cmd) {
      event.preventDefault()
      mainWindow?.webContents.send(IPC.APP_COMMAND, { cmd })
    }
  })
}

function createWindow(opts: { fullscreen?: boolean } = {}): void {
  // Restore the size/position the user left the window at last session.
  const winState = loadWindowState()
  mainWindow = new BrowserWindow({
    width: winState.width,
    height: winState.height,
    x: winState.x,
    y: winState.y,
    minWidth: 940,
    minHeight: 600,
    show: false,
    fullscreen: opts.fullscreen ?? false,
    backgroundColor: '#080a0f',
    autoHideMenuBar: true,
    // No native title bar — Scout draws its own window controls + drag region.
    frame: false,
    title: 'Scout',
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      // Required so the renderer can use the <webview> tag for embedded browsing.
      webviewTag: true
    }
  })

  // Re-maximize if that's how the window was left, then start tracking changes.
  if (winState.maximized) mainWindow.maximize()
  trackWindowState(mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // Shortcuts + copy/paste/spelling menu for Scout's own UI (omnibox, notes).
  attachShortcutRouter(mainWindow.webContents)
  const mainWc = mainWindow.webContents
  mainWc.on('context-menu', (_e, params) => showEditContextMenu(mainWc, params))

  // Open target=_blank / window.open links in the user's default browser
  // rather than spawning unmanaged Electron windows.
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // electron-vite injects ELECTRON_RENDERER_URL during dev for HMR.
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle(IPC.STATE_LOAD, async () => {
    return loadState()
  })

  ipcMain.handle(IPC.STATE_SAVE, async (_e, state: AppState) => {
    await saveState(state)
    return true
  })

  // Capture a thumbnail of a webview's visible page (Feature 1: Visual Canvas).
  ipcMain.handle(IPC.CAPTURE_THUMBNAIL, async (_e, wcId: number) => {
    try {
      const wc = webContents.fromId(wcId)
      if (!wc) return null
      const image = await wc.capturePage()
      if (image.isEmpty()) return null
      // Downscale to keep the persisted JSON small.
      return image.resize({ width: 480 }).toDataURL()
    } catch {
      return null
    }
  })

  // Pop the current page into a frameless, always-on-top mini window (Feature 4).
  ipcMain.handle(IPC.PIP_OPEN, (_e, url: string) => {
    const display = screen.getPrimaryDisplay()
    openPipWindow(url, display.workArea)
    return true
  })

  ipcMain.on(IPC.DOWNLOAD_SHOW, (_e, path: string) => shell.showItemInFolder(path))
  ipcMain.handle(IPC.DOWNLOAD_OPEN, (_e, path: string) => shell.openPath(path))

  // Save an exported briefing to a file the user picks.
  ipcMain.handle(
    IPC.EXPORT_SAVE,
    async (_e, payload: { name: string; content: string }): Promise<string | null> => {
      const res = await dialog.showSaveDialog(mainWindow ?? undefined!, {
        defaultPath: payload.name,
        filters: [
          { name: 'Markdown', extensions: ['md'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })
      if (res.canceled || !res.filePath) return null
      await writeFile(res.filePath, payload.content, 'utf-8')
      return res.filePath
    }
  )

  ipcMain.on(IPC.WINDOW_MINIMIZE, () => mainWindow?.minimize())
  ipcMain.on(IPC.WINDOW_MAXIMIZE, () => {
    if (!mainWindow) return
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
  })
  ipcMain.on(IPC.WINDOW_CLOSE, () => mainWindow?.close())

  // ----- Hub: launchers, startup, system stats -----
  ipcMain.handle(IPC.STEAM_LIST, () => listSteamGames())
  ipcMain.on(IPC.STEAM_LAUNCH, (_e, appId: string) => launchSteamGame(appId))
  ipcMain.on(IPC.LAUNCH_EXTERNAL, (_e, target: string) => launchExternal(target))
  ipcMain.handle(IPC.LAUNCH_DISCORD, () => launchDiscord())
  ipcMain.handle(IPC.STARTUP_GET, () => getOpenAtLogin())
  ipcMain.on(IPC.STARTUP_SET, (_e, enabled: boolean) => setOpenAtLogin(enabled))
  ipcMain.handle(IPC.SYSTEM_STATS, () => getSystemStats())

  // ----- Google Calendar -----
  ipcMain.on(IPC.GCAL_SET_CREDS, (_e, p: { clientId: string; clientSecret: string }) =>
    gcal.setCredentials(p.clientId, p.clientSecret)
  )
  ipcMain.handle(IPC.GCAL_CONNECT, () => gcal.connect())
  ipcMain.handle(IPC.GCAL_DISCONNECT, () => gcal.disconnect())
  ipcMain.handle(IPC.GCAL_STATUS, () => gcal.getStatus())
  ipcMain.handle(IPC.GCAL_LIST, (_e, p: { timeMin: string; timeMax: string }) =>
    gcal.listEvents(p.timeMin, p.timeMax)
  )
  ipcMain.handle(IPC.GCAL_CREATE, (_e, ev: GCalEventInput) => gcal.createEvent(ev))
  ipcMain.handle(
    IPC.GCAL_UPDATE,
    (_e, p: { id: string; calendarId: string; ev: GCalEventInput }) =>
      gcal.updateEvent(p.calendarId, p.id, p.ev)
  )
  ipcMain.handle(IPC.GCAL_DELETE, (_e, p: { id: string; calendarId: string }) =>
    gcal.deleteEvent(p.calendarId, p.id)
  )
}

app.whenReady().then(() => {
  registerIpc()
  registerDownloads(() => mainWindow)
  registerPermissions(() => mainWindow)
  void registerBlocklist()
  registerUpdates(() => mainWindow)
  registerAppUpdates(() => mainWindow)

  // Spellcheck for Scout's own fields and embedded pages.
  const setSpell = (s: Electron.Session): void => {
    try {
      s.setSpellCheckerLanguages([app.getLocale() || 'en-US'])
    } catch {
      try {
        s.setSpellCheckerLanguages(['en-US'])
      } catch {
        /* unsupported locale */
      }
    }
  }
  setSpell(session.defaultSession)
  setSpell(session.fromPartition(MAIN_PARTITION))
  setSpell(session.fromPartition(PRIVATE_PARTITION))

  // Route browser shortcuts (works even when focus is inside a <webview>) and
  // attach a native context menu to embedded pages.
  // Embedded <webview> pages: route shortcuts + show the rich page context menu.
  // (The main window is wired in createWindow; PiP windows are left alone.)
  app.on('web-contents-created', (_e, wc) => {
    if (wc.getType() !== 'webview') return
    attachShortcutRouter(wc)
    wc.on('context-menu', (_ev, params) => {
      showPageContextMenu(wc, params, (ch, payload) =>
        mainWindow?.webContents.send(ch, payload)
      )
    })
    // Middle-click / target=_blank / window.open → open inside Scout as a new
    // tab (the renderer decides: browser tab → in-app tab inheriting privacy;
    // app-panel popup → default browser) instead of a detached child window.
    wc.setWindowOpenHandler((details) => {
      mainWindow?.webContents.send(IPC.APP_COMMAND, {
        cmd: 'open-tab',
        args: { url: details.url, sourceWcId: wc.id }
      })
      return { action: 'deny' }
    })
  })

  // Read the user's Hub preferences (sync them with the OS startup setting and
  // decide whether to open fullscreen) before creating the window.
  void loadState().then((state) => {
    const settings = state.settings ?? {}
    if (typeof settings.openAtLogin === 'boolean') setOpenAtLogin(settings.openAtLogin)
    createWindow({ fullscreen: settings.startFullscreen ?? false })
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
