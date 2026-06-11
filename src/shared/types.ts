// Shared types used across main, preload, and renderer processes.

/** Persistent browsing session (cookies/cache/history kept on disk). */
export const MAIN_PARTITION = 'persist:scout'
/** Private/incognito session: in-memory only, wiped when Scout quits. */
export const PRIVATE_PARTITION = 'scout-private'
/** Both browsing sessions, for applying protections everywhere. */
export const BROWSING_PARTITIONS = [MAIN_PARTITION, PRIVATE_PARTITION]

export interface Tab {
  id: string
  url: string
  title: string
  favicon?: string
  /** Whether the webview for this tab is currently mounted (live) or frozen. */
  frozen: boolean
  /** Pinned tabs sort to the top of a workspace and are compact. */
  pinned?: boolean
  /** Private/incognito tab: in-memory session, not saved to history or disk. */
  private?: boolean
}

export interface Workspace {
  id: string
  name: string
  /** Emoji or lucide icon name shown in the sidebar. */
  icon: string
  color: string
  tabs: Tab[]
  activeTabId: string | null
}

export interface Note {
  id: string
  /** URL this note is associated with, if any (context-aware notes). */
  url: string | null
  title: string
  body: string
  createdAt: number
  updatedAt: number
}

// Built-in categories assigned by the auto-tagger. Users can also reassign
// items to these or to their own custom category names (hence `category` below
// is a free string, with these as the defaults/suggestions).
export type LibraryCategory =
  | 'Social'
  | 'Shopping'
  | 'Entertainment'
  | 'News'
  | 'Email'
  | 'Work'
  | 'Travel'
  | 'Finance'
  | 'Other'

export interface LibraryItem {
  id: string
  url: string
  title: string
  description: string
  favicon?: string
  /** Data-URL of the captured page thumbnail. */
  thumbnail?: string
  /** Built-in or user-defined category name. */
  category: string
  tags: string[]
  createdAt: number
}

export interface HistoryEntry {
  id: string
  url: string
  title: string
  favicon?: string
  visitedAt: number
}

export type SearchEngine = 'google' | 'duckduckgo' | 'bing'

export interface Settings {
  searchEngine: SearchEngine
  homepage: string
  /** Launch Scout automatically when the user signs in to Windows. */
  openAtLogin?: boolean
  /** Open the Hub fullscreen on launch. */
  startFullscreen?: boolean
  /** City used for the Hub weather widget (Open-Meteo geocoding). */
  weatherCity?: string
  /** Minutes of inactivity before an unused app panel is unloaded (0 = never). */
  appSuspendMinutes?: number
  /** Dashboard widget keys the user has hidden (calendar/clock/weather/tasks/games). */
  hiddenWidgets?: string[]
}

/** An installed Steam game surfaced on the Hub game wall. */
export interface SteamGame {
  appId: string
  name: string
  /** file:// path to local capsule art, or a CDN URL fallback. */
  art: string
}

/** A pinned, always-alive web app shown in the Hub's app rail. */
export interface AppPanel {
  id: string
  label: string
  url: string
  /** Optional brand colour for the rail icon. */
  color?: string
}

/** A to-do item on the Hub's task-list widget (independent of notes). */
export interface TaskItem {
  id: string
  text: string
  done: boolean
  createdAt: number
}

/** A calendar event, normalised from the Google Calendar API. */
export interface GCalEvent {
  id: string
  /** Which calendar it belongs to (needed for edit/delete; 'primary' etc.). */
  calendarId: string
  summary: string
  /** ISO datetime (timed) or YYYY-MM-DD (all-day). */
  start: string
  end: string
  allDay: boolean
  location?: string
  htmlLink?: string
  /** The owning calendar's colour, for the event accent. */
  color?: string
  /** Whether this calendar allows writes (owner/writer). */
  editable?: boolean
}

/** Simplified event payload the renderer sends for create/update. */
export interface GCalEventInput {
  summary: string
  start: string
  end: string
  allDay: boolean
  location?: string
}

export interface GCalStatus {
  /** OAuth credentials (client id/secret) have been saved. */
  hasCredentials: boolean
  /** Successfully connected (have a refresh token). */
  connected: boolean
  email?: string
  error?: string
}

export interface SystemStats {
  /** 0–100 overall CPU usage. */
  cpu: number
  memUsed: number
  memTotal: number
  memPercent: number
}

/** A user-editable quick-link tile on the new-tab dashboard. */
export interface Shortcut {
  id: string
  label: string
  url: string
}

export interface AppState {
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  notes: Note[]
  library: LibraryItem[]
  history: HistoryEntry[]
  settings: Settings
  shortcuts: Shortcut[]
  appPanels: AppPanel[]
  tasks: TaskItem[]
}

/** A command routed from the main process (shortcuts / context menu) to the UI. */
export interface AppCommand {
  cmd: string
  args?: Record<string, unknown>
}

export type DownloadState =
  | 'progressing'
  | 'completed'
  | 'cancelled'
  | 'interrupted'
  | 'paused'

export interface DownloadItem {
  id: string
  filename: string
  url: string
  state: DownloadState
  receivedBytes: number
  totalBytes: number
  savePath: string
  startedAt: number
}

export type PermissionDecision = 'allow' | 'block'

/** A pending permission request, sent to the renderer for an in-app prompt. */
export interface PermissionRequest {
  id: number
  host: string
  permission: string
  mediaTypes?: string[]
}

export interface PermissionEntry {
  permission: string
  decision: PermissionDecision
}

export interface UpdateInfo {
  currentElectron: string
  latestElectron: string
  chromium: string
  behind: boolean
}

/** Scout app self-update status (electron-updater → GitHub releases). */
export interface AppUpdateStatus {
  state: 'checking' | 'available' | 'downloading' | 'downloaded' | 'none' | 'error'
  version?: string
  percent?: number
  message?: string
}

/** Channel names for IPC, kept in one place to avoid typos. */
export const IPC = {
  STATE_LOAD: 'state:load',
  STATE_SAVE: 'state:save',
  CAPTURE_THUMBNAIL: 'capture:thumbnail',
  PIP_OPEN: 'pip:open',
  PIP_CLOSE: 'pip:close',
  SCRAPE_RESULT: 'scrape:result',
  APP_COMMAND: 'app:command',
  DOWNLOAD_UPDATE: 'app:download',
  DOWNLOAD_SHOW: 'download:show',
  DOWNLOAD_OPEN: 'download:open',
  PERMISSION_REQUEST: 'permission:request',
  PERMISSION_RESPOND: 'permission:respond',
  PERMISSION_LIST: 'permission:list',
  PERMISSION_SET: 'permission:set',
  UPDATE_CHECK: 'update:check',
  UPDATE_INFO: 'update:info',
  APP_UPDATE: 'appupdate:status',
  APP_UPDATE_INSTALL: 'appupdate:install',
  BLOCKLIST_ALLOW: 'blocklist:allow',
  BLOCKLIST_REVOKE: 'blocklist:revoke',
  BLOCKLIST_ALLOWED: 'blocklist:allowed',
  EXPORT_SAVE: 'export:save',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  // Hub: launchers, startup, and system stats.
  STEAM_LIST: 'steam:list',
  STEAM_LAUNCH: 'steam:launch',
  LAUNCH_EXTERNAL: 'launch:external',
  LAUNCH_DISCORD: 'launch:discord',
  STARTUP_GET: 'startup:get',
  STARTUP_SET: 'startup:set',
  SYSTEM_STATS: 'system:stats',
  // Google Calendar (native, via the Calendar API + OAuth).
  GCAL_SET_CREDS: 'gcal:setCreds',
  GCAL_CONNECT: 'gcal:connect',
  GCAL_DISCONNECT: 'gcal:disconnect',
  GCAL_STATUS: 'gcal:status',
  GCAL_LIST: 'gcal:list',
  GCAL_CREATE: 'gcal:create',
  GCAL_UPDATE: 'gcal:update',
  GCAL_DELETE: 'gcal:delete'
} as const
