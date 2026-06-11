import { useAppStore } from '../store/appStore'
import { useUiStore } from '../store/uiStore'
import { getWebview } from './webviewRegistry'
import { hostnameOf } from './url'
import { isElectron } from './env'

// Send the current page text selection into the active scratchpad note as a
// Markdown blockquote with a source link. Used by both the context menu (passes
// the text) and the Ctrl+Shift+S shortcut (queries the live selection).
export async function saveSelectionToNote(
  text?: string,
  sourceUrl?: string
): Promise<boolean> {
  const s = useAppStore.getState()
  const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId)
  const tab = ws?.tabs.find((t) => t.id === ws.activeTabId)
  const url = sourceUrl ?? tab?.url ?? null

  let sel = (text ?? '').trim()
  if (!sel && isElectron && tab) {
    const wv = getWebview(tab.id)
    if (wv) {
      try {
        sel = String(
          await wv.executeJavaScript('window.getSelection().toString()')
        ).trim()
      } catch {
        /* page may block eval */
      }
    }
  }
  if (!sel) return false

  const host = url ? hostnameOf(url) : null
  const quoted = sel.replace(/\n+/g, '\n> ')
  const block = `> ${quoted}` + (url ? `\n>\n> — [${host}](${url})` : '')

  s.appendToActiveNote(block)
  useUiStore.getState().setRightOpen(true)
  return true
}
