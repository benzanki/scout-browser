import { create } from 'zustand'
import type {
  AppState,
  Note,
  LibraryItem,
  Tab,
  Workspace,
  HistoryEntry,
  Settings,
  Shortcut,
  AppPanel,
  TaskItem
} from '../../../shared/types'
import { HOME_URL, NEWTAB_URL, normalizeInput, hostnameOf } from '../lib/url'
import {
  wvBack,
  wvForward,
  wvReload,
  wvStop,
  wvNavigate
} from '../lib/webviewRegistry'

export const uid = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

/** Ephemeral, per-tab navigation status — derived from webview events, never persisted. */
interface NavStatus {
  canGoBack: boolean
  canGoForward: boolean
  loading: boolean
  audible?: boolean
  muted?: boolean
}

/** A recently closed tab, retained so Ctrl+Shift+T can restore it. */
interface ClosedTab {
  workspaceId: string
  index: number
  tab: Tab
}

const DEFAULT_SETTINGS: Settings = {
  searchEngine: 'google',
  homepage: HOME_URL
}

const defaultShortcuts = (): Shortcut[] => [
  { id: uid(), label: 'GitHub', url: 'https://github.com' },
  { id: uid(), label: 'MDN', url: 'https://developer.mozilla.org' },
  { id: uid(), label: 'arXiv', url: 'https://arxiv.org' },
  { id: uid(), label: 'YouTube', url: 'https://youtube.com' }
]

// Always-alive web apps pinned in the Hub's left rail.
const defaultAppPanels = (): AppPanel[] => [
  { id: uid(), label: 'Discord', url: 'https://discord.com/app', color: '#5865f2' },
  { id: uid(), label: 'Spotify', url: 'https://open.spotify.com', color: '#1db954' },
  { id: uid(), label: 'Gmail', url: 'https://mail.google.com', color: '#ea4335' },
  { id: uid(), label: 'Messenger', url: 'https://www.messenger.com', color: '#0084ff' }
]

interface AppStore {
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  notes: Note[]
  library: LibraryItem[]
  history: HistoryEntry[]
  settings: Settings
  shortcuts: Shortcut[]
  appPanels: AppPanel[]
  tasks: TaskItem[]
  navStatus: Record<string, NavStatus>
  activeNoteId: string | null
  closedTabs: ClosedTab[]
  hydrated: boolean

  // ----- lifecycle -----
  hydrate: (state: AppState) => void
  seedDefault: () => void
  serialize: () => AppState

  // ----- workspaces -----
  setActiveWorkspace: (id: string) => void
  addWorkspace: (name: string, icon: string, color: string) => string
  renameWorkspace: (id: string, name: string) => void
  deleteWorkspace: (id: string) => void

  // ----- library (Feature 1: Visual Canvas) -----
  addLibraryItem: (item: LibraryItem) => void
  removeLibraryItem: (id: string) => void
  setItemCategory: (id: string, category: string) => void
  seedDemoLibrary: () => void

  // ----- tabs -----
  addTab: (workspaceId?: string, url?: string, isPrivate?: boolean) => string
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  updateTabMeta: (tabId: string, meta: Partial<Pick<Tab, 'url' | 'title' | 'favicon'>>) => void
  reopenClosedTab: () => void
  reorderTabs: (workspaceId: string, fromIndex: number, toIndex: number) => void
  moveTab: (tabId: string, toWorkspaceId: string) => void
  togglePin: (tabId: string) => void
  cycleTab: (dir: 1 | -1) => void

  // ----- history & settings -----
  addHistory: (entry: { url: string; title?: string; favicon?: string }) => void
  removeHistory: (ids: string[]) => void
  clearHistory: () => void
  updateSettings: (patch: Partial<Settings>) => void

  // ----- dashboard shortcuts -----
  addShortcut: (label: string, url: string) => void
  updateShortcut: (id: string, label: string, url: string) => void
  removeShortcut: (id: string) => void

  // ----- Hub app panels -----
  addAppPanel: (label: string, url: string) => void
  removeAppPanel: (id: string) => void
  reorderAppPanels: (from: number, to: number) => void

  // ----- Hub task list -----
  addTask: (text: string) => void
  toggleTask: (id: string) => void
  removeTask: (id: string) => void
  clearCompletedTasks: () => void

  // ----- navigation (acts on active workspace's active tab) -----
  navigate: (input: string) => void
  goBack: () => void
  goForward: () => void
  reload: () => void
  stop: () => void
  goHome: () => void
  setNavStatus: (tabId: string, status: Partial<NavStatus>) => void

  // ----- notes -----
  setActiveNote: (id: string | null) => void
  createNote: (init?: { url?: string | null; title?: string; body?: string }) => string
  updateNoteBody: (id: string, body: string) => void
  deleteNote: (id: string) => void
  /** Append text to the current note (page note for the active URL), creating it if needed. */
  appendToActiveNote: (text: string) => void
}

const findWorkspace = (ws: Workspace[], id: string | null): Workspace | undefined =>
  ws.find((w) => w.id === id)

export const useAppStore = create<AppStore>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
  notes: [],
  library: [],
  history: [],
  settings: DEFAULT_SETTINGS,
  shortcuts: [],
  appPanels: [],
  tasks: [],
  navStatus: {},
  activeNoteId: null,
  closedTabs: [],
  hydrated: false,

  hydrate: (state) =>
    set({
      workspaces: state.workspaces ?? [],
      activeWorkspaceId:
        state.activeWorkspaceId ?? state.workspaces?.[0]?.id ?? null,
      notes: state.notes ?? [],
      library: state.library ?? [],
      history: state.history ?? [],
      settings: { ...DEFAULT_SETTINGS, ...(state.settings ?? {}) },
      // Existing users (saved before shortcuts existed) get the defaults.
      shortcuts: state.shortcuts ?? defaultShortcuts(),
      appPanels: state.appPanels?.length ? state.appPanels : defaultAppPanels(),
      tasks: state.tasks ?? [],
      hydrated: true
    }),

  seedDefault: () => {
    const mk = (name: string, color: string): Workspace => ({
      id: uid(),
      name,
      icon: '',
      color,
      tabs: [],
      activeTabId: null
    })
    const general = mk('General', 'text-scout-accent')
    set({
      workspaces: [general, mk('Work', 'text-scout-green')],
      activeWorkspaceId: general.id,
      settings: DEFAULT_SETTINGS,
      shortcuts: defaultShortcuts(),
      appPanels: defaultAppPanels(),
      tasks: [],
      history: [],
      hydrated: true
    })
  },

  serialize: () => {
    const {
      workspaces,
      activeWorkspaceId,
      notes,
      library,
      history,
      settings,
      shortcuts,
      appPanels,
      tasks
    } = get()
    // Persist tabs without transient fields; navStatus is intentionally dropped.
    return {
      workspaces: workspaces.map((w) => ({
        ...w,
        // Private/incognito tabs are ephemeral — never persisted to disk.
        tabs: w.tabs
          .filter((t) => !t.private)
          .map(({ id, url, title, favicon, frozen, pinned }) => ({
            id,
            url,
            title,
            favicon,
            frozen,
            pinned
          }))
      })),
      activeWorkspaceId,
      notes,
      library,
      history: history.slice(0, 1000),
      settings,
      shortcuts,
      appPanels,
      tasks
    }
  },

  setActiveWorkspace: (id) =>
    // Deep-freeze (Feature 2): only the active workspace's tabs stay "live"
    // (mounted as webviews); all other workspaces are marked frozen so their
    // heavy webview instances are destroyed and RAM reclaimed.
    set((s) => ({
      activeWorkspaceId: id,
      workspaces: s.workspaces.map((w) => ({
        ...w,
        tabs: w.tabs.map((t) => ({ ...t, frozen: w.id !== id }))
      }))
    })),

  addWorkspace: (name, icon, color) => {
    const id = uid()
    set((s) => ({
      workspaces: [
        ...s.workspaces,
        { id, name, icon, color, tabs: [], activeTabId: null }
      ],
      activeWorkspaceId: id
    }))
    return id
  },

  renameWorkspace: (id, name) =>
    set((s) => ({
      workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, name } : w))
    })),

  deleteWorkspace: (id) =>
    set((s) => {
      const workspaces = s.workspaces.filter((w) => w.id !== id)
      let activeWorkspaceId = s.activeWorkspaceId
      if (activeWorkspaceId === id) {
        // Activate a neighbour and thaw it; freeze everything else.
        const next = workspaces[0] ?? null
        activeWorkspaceId = next?.id ?? null
        return {
          activeWorkspaceId,
          workspaces: workspaces.map((w) => ({
            ...w,
            tabs: w.tabs.map((t) => ({ ...t, frozen: w.id !== activeWorkspaceId }))
          }))
        }
      }
      return { workspaces, activeWorkspaceId }
    }),

  addLibraryItem: (item) =>
    set((s) => ({
      // De-dupe by URL: a re-bookmark refreshes the existing card.
      library: [item, ...s.library.filter((l) => l.url !== item.url)]
    })),

  removeLibraryItem: (id) =>
    set((s) => ({ library: s.library.filter((l) => l.id !== id) })),

  setItemCategory: (id, category) =>
    set((s) => ({
      library: s.library.map((l) =>
        l.id === id
          ? { ...l, category, tags: l.tags.map((t) => (t === l.category ? category : t)) }
          : l
      )
    })),

  seedDemoLibrary: () =>
    set({
      history: [
        { id: uid(), url: 'https://github.com', title: 'GitHub', visitedAt: Date.now() - 5 * 60_000 },
        { id: uid(), url: 'https://news.ycombinator.com', title: 'Hacker News', visitedAt: Date.now() - 40 * 60_000 },
        { id: uid(), url: 'https://en.wikipedia.org/wiki/Electron', title: 'Electron — Wikipedia', visitedAt: Date.now() - 90 * 60_000 },
        { id: uid(), url: 'https://www.bbc.com/news', title: 'BBC News', visitedAt: Date.now() - 26 * 60 * 60_000 }
      ],
      tasks: [
        { id: uid(), text: 'Reply to emails', done: false, createdAt: Date.now() - 100 },
        { id: uid(), text: 'Book flights for trip', done: false, createdAt: Date.now() - 200 },
        { id: uid(), text: 'Renew gym membership', done: true, createdAt: Date.now() - 300 }
      ],
      library: [
        {
          id: uid(),
          url: 'https://amazon.com',
          title: 'Amazon · Online Shopping',
          description: 'Shop online for electronics, books, apparel & more.',
          category: 'Shopping',
          tags: ['Shopping', 'amazon.com'],
          createdAt: Date.now() - 1000
        },
        {
          id: uid(),
          url: 'https://youtube.com',
          title: 'YouTube',
          description: 'Enjoy the videos and music you love.',
          category: 'Entertainment',
          tags: ['Entertainment', 'youtube.com'],
          createdAt: Date.now() - 2000
        },
        {
          id: uid(),
          url: 'https://bbc.com/news',
          title: 'BBC News',
          description: 'Breaking news, world news and headlines.',
          category: 'News',
          tags: ['News', 'bbc.com'],
          createdAt: Date.now() - 3000
        },
        {
          id: uid(),
          url: 'https://booking.com',
          title: 'Booking.com',
          description: 'Hotels, flights and travel deals worldwide.',
          category: 'Travel',
          tags: ['Travel', 'booking.com'],
          createdAt: Date.now() - 4000
        }
      ]
    }),

  addTab: (workspaceId, url, isPrivate) => {
    const wsId = workspaceId ?? get().activeWorkspaceId
    if (!wsId) return ''
    const id = uid()
    const newTab: Tab = {
      id,
      // No explicit URL → open the Scout dashboard (new-tab page).
      url: url ?? NEWTAB_URL,
      title: isPrivate ? 'Private Tab' : 'New Tab',
      frozen: false,
      private: isPrivate
    }
    set((s) => ({
      workspaces: s.workspaces.map((w) =>
        w.id === wsId
          ? { ...w, tabs: [...w.tabs, newTab], activeTabId: id }
          : w
      )
    }))
    return id
  },

  closeTab: (tabId) =>
    set((s) => {
      let closed: ClosedTab | null = null
      const workspaces = s.workspaces.map((w) => {
        const idx = w.tabs.findIndex((t) => t.id === tabId)
        if (idx === -1) return w
        closed = { workspaceId: w.id, index: idx, tab: w.tabs[idx] }
        const tabs = w.tabs.filter((t) => t.id !== tabId)
        let activeTabId = w.activeTabId
        if (w.activeTabId === tabId) {
          const next = tabs[idx - 1] ?? tabs[idx] ?? tabs[tabs.length - 1]
          activeTabId = next?.id ?? null
        }
        return { ...w, tabs, activeTabId }
      })
      return {
        workspaces,
        closedTabs: closed ? [closed, ...s.closedTabs].slice(0, 20) : s.closedTabs
      }
    }),

  reopenClosedTab: () =>
    set((s) => {
      const [closed, ...rest] = s.closedTabs
      if (!closed) return {}
      const target = s.workspaces.find((w) => w.id === closed.workspaceId) ?? s.workspaces.find((w) => w.id === s.activeWorkspaceId)
      if (!target) return {}
      const restored: Tab = { ...closed.tab, frozen: false }
      return {
        closedTabs: rest,
        activeWorkspaceId: target.id,
        workspaces: s.workspaces.map((w) => {
          if (w.id !== target.id) return w
          const tabs = [...w.tabs]
          tabs.splice(Math.min(closed.index, tabs.length), 0, restored)
          return { ...w, tabs, activeTabId: restored.id }
        })
      }
    }),

  reorderTabs: (workspaceId, fromIndex, toIndex) =>
    set((s) => ({
      workspaces: s.workspaces.map((w) => {
        if (w.id !== workspaceId) return w
        if (fromIndex === toIndex || fromIndex < 0 || fromIndex >= w.tabs.length) return w
        const tabs = [...w.tabs]
        const [moved] = tabs.splice(fromIndex, 1)
        tabs.splice(Math.max(0, Math.min(toIndex, tabs.length)), 0, moved)
        return { ...w, tabs }
      })
    })),

  moveTab: (tabId, toWorkspaceId) =>
    set((s) => {
      let moved: Tab | undefined
      let fromId: string | undefined
      // Remove the tab from its source workspace.
      const stripped = s.workspaces.map((w) => {
        const idx = w.tabs.findIndex((t) => t.id === tabId)
        if (idx === -1) return w
        fromId = w.id
        moved = w.tabs[idx]
        const tabs = w.tabs.filter((t) => t.id !== tabId)
        let activeTabId = w.activeTabId
        if (activeTabId === tabId) {
          const next = tabs[idx - 1] ?? tabs[idx] ?? tabs[tabs.length - 1]
          activeTabId = next?.id ?? null
        }
        return { ...w, tabs, activeTabId }
      })
      if (!moved || fromId === toWorkspaceId) return {}
      const targetActive = toWorkspaceId === s.activeWorkspaceId
      const placed: Tab = { ...moved, frozen: !targetActive }
      return {
        workspaces: stripped.map((w) =>
          w.id === toWorkspaceId
            ? {
                ...w,
                tabs: [...w.tabs, placed],
                activeTabId: targetActive ? placed.id : w.activeTabId ?? placed.id
              }
            : w
        )
      }
    }),

  togglePin: (tabId) =>
    set((s) => ({
      workspaces: s.workspaces.map((w) => ({
        ...w,
        tabs: w.tabs.map((t) => (t.id === tabId ? { ...t, pinned: !t.pinned } : t))
      }))
    })),

  cycleTab: (dir) => {
    const s = get()
    const ws = findWorkspace(s.workspaces, s.activeWorkspaceId)
    if (!ws || ws.tabs.length === 0) return
    const cur = ws.tabs.findIndex((t) => t.id === ws.activeTabId)
    const next = ws.tabs[(cur + dir + ws.tabs.length) % ws.tabs.length]
    if (next) get().setActiveTab(next.id)
  },

  addHistory: ({ url, title, favicon }) => {
    if (!url || !/^https?:/i.test(url)) return
    set((s) => {
      // Skip if it's the same as the most recent entry.
      if (s.history[0]?.url === url) {
        const [first, ...rest] = s.history
        return { history: [{ ...first, title: title || first.title, favicon: favicon ?? first.favicon, visitedAt: Date.now() }, ...rest] }
      }
      const entry: HistoryEntry = {
        id: uid(),
        url,
        title: title || hostnameOf(url),
        favicon,
        visitedAt: Date.now()
      }
      return { history: [entry, ...s.history].slice(0, 2000) }
    })
  },

  removeHistory: (ids) =>
    set((s) => {
      const drop = new Set(ids)
      return { history: s.history.filter((h) => !drop.has(h.id)) }
    }),

  clearHistory: () => set({ history: [] }),

  updateSettings: (patch) =>
    set((s) => ({ settings: { ...s.settings, ...patch } })),

  addShortcut: (label, url) =>
    set((s) => ({ shortcuts: [...s.shortcuts, { id: uid(), label, url }] })),

  updateShortcut: (id, label, url) =>
    set((s) => ({
      shortcuts: s.shortcuts.map((sc) => (sc.id === id ? { ...sc, label, url } : sc))
    })),

  removeShortcut: (id) =>
    set((s) => ({ shortcuts: s.shortcuts.filter((sc) => sc.id !== id) })),

  addAppPanel: (label, url) =>
    set((s) => ({ appPanels: [...s.appPanels, { id: uid(), label, url }] })),

  removeAppPanel: (id) =>
    set((s) => ({ appPanels: s.appPanels.filter((p) => p.id !== id) })),

  reorderAppPanels: (from, to) =>
    set((s) => {
      if (from === to || from < 0 || from >= s.appPanels.length) return {}
      const arr = [...s.appPanels]
      const [moved] = arr.splice(from, 1)
      arr.splice(Math.max(0, Math.min(to, arr.length)), 0, moved)
      return { appPanels: arr }
    }),

  addTask: (text) =>
    set((s) => ({
      tasks: [...s.tasks, { id: uid(), text, done: false, createdAt: Date.now() }]
    })),

  toggleTask: (id) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    })),

  removeTask: (id) =>
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

  clearCompletedTasks: () =>
    set((s) => ({ tasks: s.tasks.filter((t) => !t.done) })),

  setActiveTab: (tabId) =>
    set((s) => ({
      workspaces: s.workspaces.map((w) =>
        w.tabs.some((t) => t.id === tabId) ? { ...w, activeTabId: tabId } : w
      )
    })),

  updateTabMeta: (tabId, meta) =>
    set((s) => ({
      workspaces: s.workspaces.map((w) => ({
        ...w,
        tabs: w.tabs.map((t) => (t.id === tabId ? { ...t, ...meta } : t))
      }))
    })),

  navigate: (input) => {
    const s = get()
    const url = normalizeInput(input, s.settings.searchEngine)
    if (!url) return
    const ws = findWorkspace(s.workspaces, s.activeWorkspaceId)
    if (!ws) return
    const activeId = ws.activeTabId
    if (!activeId) {
      get().addTab(ws.id, url)
      return
    }
    // Optimistic URL update; the webview's did-navigate event reconciles it.
    get().updateTabMeta(activeId, { url })
    wvNavigate(activeId, url)
  },

  goBack: () => {
    const ws = findWorkspace(get().workspaces, get().activeWorkspaceId)
    wvBack(ws?.activeTabId ?? null)
  },
  goForward: () => {
    const ws = findWorkspace(get().workspaces, get().activeWorkspaceId)
    wvForward(ws?.activeTabId ?? null)
  },
  reload: () => {
    const ws = findWorkspace(get().workspaces, get().activeWorkspaceId)
    wvReload(ws?.activeTabId ?? null)
  },
  stop: () => {
    const ws = findWorkspace(get().workspaces, get().activeWorkspaceId)
    wvStop(ws?.activeTabId ?? null)
  },
  goHome: () => {
    const s = get()
    const home = s.settings.homepage || HOME_URL
    const ws = findWorkspace(s.workspaces, s.activeWorkspaceId)
    if (!ws) return
    if (ws.activeTabId) {
      get().updateTabMeta(ws.activeTabId, { url: home })
      wvNavigate(ws.activeTabId, home)
    } else {
      get().addTab(ws.id, home)
    }
  },

  setNavStatus: (tabId, status) =>
    set((s) => ({
      navStatus: {
        ...s.navStatus,
        [tabId]: { ...s.navStatus[tabId], ...status } as NavStatus
      }
    })),

  setActiveNote: (id) => set({ activeNoteId: id }),

  createNote: (init) => {
    const id = uid()
    const now = Date.now()
    const note: Note = {
      id,
      url: init?.url ?? null,
      title: init?.title ?? 'Untitled note',
      body: init?.body ?? '',
      createdAt: now,
      updatedAt: now
    }
    set((s) => ({ notes: [note, ...s.notes], activeNoteId: id }))
    return id
  },

  updateNoteBody: (id, body) =>
    set((s) => ({
      notes: s.notes.map((n) =>
        n.id === id ? { ...n, body, updatedAt: Date.now() } : n
      )
    })),

  deleteNote: (id) =>
    set((s) => ({
      notes: s.notes.filter((n) => n.id !== id),
      activeNoteId: s.activeNoteId === id ? null : s.activeNoteId
    })),

  appendToActiveNote: (text) => {
    const s = get()
    // Resolve the note currently shown in the scratchpad.
    let note = s.activeNoteId
      ? s.notes.find((n) => n.id === s.activeNoteId)
      : undefined
    if (!note) {
      const ws = findWorkspace(s.workspaces, s.activeWorkspaceId)
      const tab = ws?.tabs.find((t) => t.id === ws.activeTabId)
      const url = tab?.url ?? null
      note = s.notes.find((n) => n.url != null && n.url === url)
      if (!note) {
        const id = get().createNote({ url, title: tab?.title ?? 'Scraped notes' })
        note = get().notes.find((n) => n.id === id)
      }
    }
    if (!note) return
    const sep = note.body.trim().length ? note.body.replace(/\s+$/, '') + '\n\n' : ''
    get().updateNoteBody(note.id, sep + text.trim() + '\n')
  }
}))

// ----- convenience hooks/selectors -----
export const useActiveWorkspace = (): Workspace | undefined =>
  useAppStore((s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId))

export const useActiveTab = (): Tab | undefined =>
  useAppStore((s) => {
    const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId)
    return ws?.tabs.find((t) => t.id === ws.activeTabId)
  })
