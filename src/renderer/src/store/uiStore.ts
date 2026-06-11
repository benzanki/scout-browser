import { create } from 'zustand'
import type { DownloadItem, UpdateInfo } from '../../../shared/types'

// Ephemeral UI state (never persisted): overlays/panels, inspect mode, the
// download tray, and a nonce used to pull focus into the omnibox on demand.
interface UiStore {
  // The Hub is Scout's permanent shell. `hubView` selects what fills the content
  // area: the home dashboard, the browser, or one of the app panels (by id).
  hubView: 'home' | 'browser' | string
  setHubView: (v: 'home' | 'browser' | string) => void
  // Per-app-panel "busy" flag (playing audio or capturing mic/cam) → never suspended.
  panelBusy: Record<string, boolean>
  setPanelBusy: (id: string, busy: boolean) => void

  paletteOpen: boolean
  openPalette: () => void
  closePalette: () => void
  togglePalette: () => void

  rightOpen: boolean
  leftCollapsed: boolean
  toggleRight: () => void
  setRightOpen: (v: boolean) => void
  toggleLeft: () => void

  // The right sidebar shows either the scratchpad or the Visual Canvas library.
  rightPanel: 'notes' | 'library'
  setRightPanel: (p: 'notes' | 'library') => void
  openLibrary: () => void
  closeLibrary: () => void

  // Split view: id of the tab shown in the right pane (left pane = active tab).
  splitTabId: string | null
  setSplitTab: (id: string | null) => void

  // Id of the tab currently being dragged from the sidebar (drives the center
  // drop zones for choosing split panes).
  draggingTabId: string | null
  setDraggingTab: (id: string | null) => void

  settingsOpen: boolean
  openSettings: () => void
  closeSettings: () => void

  historyOpen: boolean
  openHistory: () => void
  closeHistory: () => void

  briefingOpen: boolean
  openBriefing: () => void
  closeBriefing: () => void

  findOpen: boolean
  openFind: () => void
  closeFind: () => void

  // Bumping this nonce tells the TopBar to focus + select the address bar.
  omniboxFocus: number
  focusOmnibox: () => void

  inspectMode: boolean
  setInspectMode: (v: boolean) => void
  toggleInspect: () => void

  updateInfo: UpdateInfo | null
  setUpdateInfo: (info: UpdateInfo | null) => void

  // Download tray.
  downloads: DownloadItem[]
  downloadsOpen: boolean
  toggleDownloads: () => void
  setDownloadsOpen: (v: boolean) => void
  upsertDownload: (item: DownloadItem) => void
  clearDownloads: () => void
}

export const useUiStore = create<UiStore>((set) => ({
  // Scout boots into the Hub home.
  hubView: 'home',
  setHubView: (v) => set({ hubView: v }),
  panelBusy: {},
  setPanelBusy: (id, busy) =>
    set((s) => (s.panelBusy[id] === busy ? s : { panelBusy: { ...s.panelBusy, [id]: busy } })),

  paletteOpen: false,
  openPalette: () => set({ paletteOpen: true }),
  closePalette: () => set({ paletteOpen: false }),
  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),

  rightOpen: true,
  leftCollapsed: false,
  toggleRight: () => set((s) => ({ rightOpen: !s.rightOpen })),
  setRightOpen: (v) => set({ rightOpen: v }),
  toggleLeft: () => set((s) => ({ leftCollapsed: !s.leftCollapsed })),

  rightPanel: 'notes',
  setRightPanel: (p) => set({ rightPanel: p }),
  openLibrary: () => set({ rightPanel: 'library', rightOpen: true }),
  closeLibrary: () => set({ rightPanel: 'notes' }),

  splitTabId: null,
  setSplitTab: (id) => set({ splitTabId: id }),

  draggingTabId: null,
  setDraggingTab: (id) => set({ draggingTabId: id }),

  settingsOpen: false,
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),

  historyOpen: false,
  openHistory: () => set({ historyOpen: true }),
  closeHistory: () => set({ historyOpen: false }),

  briefingOpen: false,
  openBriefing: () => set({ briefingOpen: true }),
  closeBriefing: () => set({ briefingOpen: false }),

  findOpen: false,
  openFind: () => set({ findOpen: true }),
  closeFind: () => set({ findOpen: false }),

  omniboxFocus: 0,
  focusOmnibox: () => set((s) => ({ omniboxFocus: s.omniboxFocus + 1 })),

  inspectMode: false,
  setInspectMode: (v) => set({ inspectMode: v }),
  toggleInspect: () => set((s) => ({ inspectMode: !s.inspectMode })),

  updateInfo: null,
  setUpdateInfo: (info) => set({ updateInfo: info }),

  downloads: [],
  downloadsOpen: false,
  toggleDownloads: () => set((s) => ({ downloadsOpen: !s.downloadsOpen })),
  setDownloadsOpen: (v) => set({ downloadsOpen: v }),
  upsertDownload: (item) =>
    set((s) => {
      const idx = s.downloads.findIndex((d) => d.id === item.id)
      const downloads = [...s.downloads]
      if (idx === -1) downloads.unshift(item)
      else downloads[idx] = item
      return { downloads: downloads.slice(0, 30), downloadsOpen: true }
    }),
  clearDownloads: () =>
    set((s) => ({ downloads: s.downloads.filter((d) => d.state === 'progressing') }))
}))
