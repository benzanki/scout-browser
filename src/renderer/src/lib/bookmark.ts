import { useAppStore, uid } from '../store/appStore'
import { getWebview } from './webviewRegistry'
import { categorize } from './categorize'
import { isElectron } from './env'

// Capture a clean metadata snapshot of the active page and file it into the
// Visual Canvas (Feature 1): title, favicon, meta description, an Electron page
// thumbnail, and an auto-assigned smart category.
export async function bookmarkActivePage(): Promise<string | null> {
  const s = useAppStore.getState()
  const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId)
  const tab = ws?.tabs.find((t) => t.id === ws.activeTabId)
  if (!tab) return null

  let description = ''
  let thumbnail: string | undefined
  const wv = getWebview(tab.id)

  if (isElectron && wv) {
    try {
      description = (await wv.executeJavaScript(
        `(() => {
          const d = document.querySelector('meta[name="description"]')?.content
            || document.querySelector('meta[property="og:description"]')?.content || '';
          return d.replace(/\\s+/g, ' ').trim().slice(0, 220);
        })()`
      )) as string
    } catch {
      /* page may block eval; description stays empty */
    }
    try {
      thumbnail = (await window.scout.captureThumbnail(wv.getWebContentsId())) ?? undefined
    } catch {
      /* capture is best-effort */
    }
  }

  const { category, tags } = categorize(tab.url, tab.title, description)
  s.addLibraryItem({
    id: uid(),
    url: tab.url,
    title: tab.title || tab.url,
    description,
    favicon: tab.favicon,
    thumbnail,
    category,
    tags,
    createdAt: Date.now()
  })
  return category
}
