import { contextBridge, ipcRenderer } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import {
  IPC,
  type AppState,
  type AppCommand,
  type DownloadItem,
  type PermissionRequest,
  type PermissionEntry,
  type PermissionDecision,
  type UpdateInfo,
  type SteamGame,
  type SystemStats,
  type GCalEvent,
  type GCalEventInput,
  type GCalStatus,
  type AppUpdateStatus
} from '../shared/types'

// Absolute file:// URL of the webview preload, computed here (preload has node
// access) so the renderer can hand it to each <webview preload=…> attribute.
const webviewPreloadPath = pathToFileURL(join(__dirname, 'webview.cjs')).toString()

// Typed, minimal surface exposed to the renderer.
const api = {
  loadState: (): Promise<AppState> => ipcRenderer.invoke(IPC.STATE_LOAD),
  saveState: (state: AppState): Promise<boolean> =>
    ipcRenderer.invoke(IPC.STATE_SAVE, state),

  // Feature 1: capture a thumbnail of a webview's page by its webContents id.
  captureThumbnail: (webContentsId: number): Promise<string | null> =>
    ipcRenderer.invoke(IPC.CAPTURE_THUMBNAIL, webContentsId),

  // Feature 4: pop a URL into a frameless always-on-top mini window.
  openPip: (url: string): Promise<boolean> => ipcRenderer.invoke(IPC.PIP_OPEN, url),

  // Commands routed from the main process (keyboard shortcuts + context menu).
  onCommand: (cb: (payload: AppCommand) => void): (() => void) => {
    const handler = (_e: unknown, payload: AppCommand): void => cb(payload)
    ipcRenderer.on(IPC.APP_COMMAND, handler)
    return () => ipcRenderer.removeListener(IPC.APP_COMMAND, handler)
  },

  // Download progress stream + actions.
  onDownload: (cb: (item: DownloadItem) => void): (() => void) => {
    const handler = (_e: unknown, item: DownloadItem): void => cb(item)
    ipcRenderer.on(IPC.DOWNLOAD_UPDATE, handler)
    return () => ipcRenderer.removeListener(IPC.DOWNLOAD_UPDATE, handler)
  },
  showDownload: (path: string): void => ipcRenderer.send(IPC.DOWNLOAD_SHOW, path),
  openDownload: (path: string): Promise<string> =>
    ipcRenderer.invoke(IPC.DOWNLOAD_OPEN, path),

  // Permission prompts + per-site permission management.
  onPermissionRequest: (cb: (req: PermissionRequest) => void): (() => void) => {
    const handler = (_e: unknown, req: PermissionRequest): void => cb(req)
    ipcRenderer.on(IPC.PERMISSION_REQUEST, handler)
    return () => ipcRenderer.removeListener(IPC.PERMISSION_REQUEST, handler)
  },
  respondPermission: (payload: { id: number; decision: PermissionDecision }): void =>
    ipcRenderer.send(IPC.PERMISSION_RESPOND, payload),
  listPermissions: (origin: string): Promise<PermissionEntry[]> =>
    ipcRenderer.invoke(IPC.PERMISSION_LIST, origin),
  setPermission: (payload: {
    origin: string
    permission: string
    decision: PermissionDecision | 'ask'
  }): void => ipcRenderer.send(IPC.PERMISSION_SET, payload),

  // Blocklist allowlist (per-site "continue anyway" + management).
  allowSite: (host: string): void => ipcRenderer.send(IPC.BLOCKLIST_ALLOW, host),
  revokeSite: (host: string): void => ipcRenderer.send(IPC.BLOCKLIST_REVOKE, host),
  listAllowedSites: (): Promise<string[]> => ipcRenderer.invoke(IPC.BLOCKLIST_ALLOWED),

  // Save an exported research briefing to a file (returns the path, or null).
  saveExport: (payload: { name: string; content: string }): Promise<string | null> =>
    ipcRenderer.invoke(IPC.EXPORT_SAVE, payload),

  // Scout app self-update (GitHub releases).
  onAppUpdate: (cb: (status: AppUpdateStatus) => void): (() => void) => {
    const handler = (_e: unknown, status: AppUpdateStatus): void => cb(status)
    ipcRenderer.on(IPC.APP_UPDATE, handler)
    return () => ipcRenderer.removeListener(IPC.APP_UPDATE, handler)
  },
  installUpdate: (): void => ipcRenderer.send(IPC.APP_UPDATE_INSTALL),

  // Browser-engine update check.
  checkUpdate: (): Promise<UpdateInfo> => ipcRenderer.invoke(IPC.UPDATE_CHECK),
  onUpdateInfo: (cb: (info: UpdateInfo) => void): (() => void) => {
    const handler = (_e: unknown, info: UpdateInfo): void => cb(info)
    ipcRenderer.on(IPC.UPDATE_INFO, handler)
    return () => ipcRenderer.removeListener(IPC.UPDATE_INFO, handler)
  },

  webviewPreloadPath,

  // Window controls (used by the custom title bar region).
  minimize: () => ipcRenderer.send(IPC.WINDOW_MINIMIZE),
  maximize: () => ipcRenderer.send(IPC.WINDOW_MAXIMIZE),
  close: () => ipcRenderer.send(IPC.WINDOW_CLOSE),

  // Hub: game wall, launchers, startup, and system stats.
  listSteamGames: (): Promise<SteamGame[]> => ipcRenderer.invoke(IPC.STEAM_LIST),
  launchSteamGame: (appId: string): void => ipcRenderer.send(IPC.STEAM_LAUNCH, appId),
  launchExternal: (target: string): void => ipcRenderer.send(IPC.LAUNCH_EXTERNAL, target),
  launchDiscord: (): Promise<boolean> => ipcRenderer.invoke(IPC.LAUNCH_DISCORD),
  getStartup: (): Promise<boolean> => ipcRenderer.invoke(IPC.STARTUP_GET),
  setStartup: (enabled: boolean): void => ipcRenderer.send(IPC.STARTUP_SET, enabled),
  getSystemStats: (): Promise<SystemStats> => ipcRenderer.invoke(IPC.SYSTEM_STATS),

  // Google Calendar (native sync).
  gcalSetCreds: (clientId: string, clientSecret: string): void =>
    ipcRenderer.send(IPC.GCAL_SET_CREDS, { clientId, clientSecret }),
  gcalConnect: (): Promise<GCalStatus> => ipcRenderer.invoke(IPC.GCAL_CONNECT),
  gcalDisconnect: (): Promise<GCalStatus> => ipcRenderer.invoke(IPC.GCAL_DISCONNECT),
  gcalStatus: (): Promise<GCalStatus> => ipcRenderer.invoke(IPC.GCAL_STATUS),
  gcalList: (timeMin: string, timeMax: string): Promise<GCalEvent[]> =>
    ipcRenderer.invoke(IPC.GCAL_LIST, { timeMin, timeMax }),
  gcalCreate: (ev: GCalEventInput): Promise<GCalEvent | null> =>
    ipcRenderer.invoke(IPC.GCAL_CREATE, ev),
  gcalUpdate: (id: string, calendarId: string, ev: GCalEventInput): Promise<GCalEvent | null> =>
    ipcRenderer.invoke(IPC.GCAL_UPDATE, { id, calendarId, ev }),
  gcalDelete: (id: string, calendarId: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.GCAL_DELETE, { id, calendarId })
}

export type ScoutApi = typeof api

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('scout', api)
} else {
  // @ts-ignore - augmenting window
  window.scout = api
}
