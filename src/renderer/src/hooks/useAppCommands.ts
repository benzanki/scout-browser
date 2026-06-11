import { useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import { useUiStore } from '../store/uiStore'
import { wvZoom, getWebview, getTabIdByWebContents } from '../lib/webviewRegistry'
import { saveSelectionToNote } from '../lib/saveSelection'
import { bookmarkActivePage } from '../lib/bookmark'
import { isElectron } from '../lib/env'
import type { AppCommand } from '../../../shared/types'

// Bridges commands routed from the main process (keyboard shortcuts +
// right-click context menu) to store/UI actions, and ingests download progress.
export function useAppCommands(): void {
  useEffect(() => {
    if (!isElectron) return

    const handle = ({ cmd, args }: AppCommand): void => {
      const app = useAppStore.getState()
      const ui = useUiStore.getState()
      const ws = app.workspaces.find((w) => w.id === app.activeWorkspaceId)
      const activeTabId = ws?.activeTabId ?? null

      // Commands that act on web content surface the browser view in the Hub.
      const SHOW_BROWSER = new Set([
        'new-tab',
        'new-private-tab',
        'close-tab',
        'focus-omnibox',
        'reload',
        'reopen-tab',
        'next-tab',
        'prev-tab',
        'back',
        'forward',
        'find',
        'search',
        'bookmark',
        'inspect'
      ])
      if (SHOW_BROWSER.has(cmd)) ui.setHubView('browser')

      switch (cmd) {
        case 'new-tab':
          app.addTab()
          ui.focusOmnibox()
          break
        case 'new-private-tab':
          app.addTab(undefined, undefined, true)
          ui.focusOmnibox()
          break
        case 'close-tab':
          if (activeTabId) app.closeTab(activeTabId)
          break
        case 'focus-omnibox':
          ui.focusOmnibox()
          break
        case 'reload':
          app.reload()
          break
        case 'reopen-tab':
          app.reopenClosedTab()
          break
        case 'next-tab':
          app.cycleTab(1)
          break
        case 'prev-tab':
          app.cycleTab(-1)
          break
        case 'back':
          app.goBack()
          break
        case 'forward':
          app.goForward()
          break
        case 'palette':
          ui.togglePalette()
          break
        case 'find':
          ui.openFind()
          break
        case 'print':
          try {
            getWebview(activeTabId)?.print()
          } catch {
            /* no page to print */
          }
          break
        case 'zoom-in':
          wvZoom(activeTabId, 0.5)
          break
        case 'zoom-out':
          wvZoom(activeTabId, -0.5)
          break
        case 'zoom-reset':
          wvZoom(activeTabId, 'reset')
          break
        case 'save-selection':
          void saveSelectionToNote()
          break
        case 'open-tab': {
          if (typeof args?.url !== 'string') break
          const url = args.url
          const explicitPrivate = args.private === true
          const srcWcId = typeof args.sourceWcId === 'number' ? args.sourceWcId : null
          const srcTabId = srcWcId != null ? getTabIdByWebContents(srcWcId) : null
          // A popup from an app panel / calendar (not a browser tab) and no
          // explicit private request → hand off to the default browser.
          if (srcWcId != null && srcTabId == null && !explicitPrivate) {
            window.scout.launchExternal(url)
            break
          }
          // Inherit the private flag from the source browser tab (or force it).
          let isPrivate = explicitPrivate
          if (!isPrivate && srcTabId) {
            isPrivate =
              app.workspaces.flatMap((w) => w.tabs).find((t) => t.id === srcTabId)?.private ?? false
          }
          ui.setHubView('browser')
          app.addTab(undefined, url, isPrivate)
          break
        }
        case 'append-note':
          if (typeof args?.text === 'string')
            void saveSelectionToNote(args.text, args.sourceUrl as string | undefined)
          break
        case 'search':
          if (typeof args?.query === 'string') app.navigate(args.query)
          break
        case 'bookmark':
          void bookmarkActivePage()
          break
        case 'inspect':
          ui.setInspectMode(true)
          break
      }
    }

    const offCommand = window.scout.onCommand(handle)
    const offDownload = window.scout.onDownload((item) =>
      useUiStore.getState().upsertDownload(item)
    )
    return () => {
      offCommand()
      offDownload()
    }
  }, [])
}
