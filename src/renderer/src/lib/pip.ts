import { useAppStore } from '../store/appStore'
import { getWebview } from './webviewRegistry'
import { isElectron } from './env'

// Feature 4: pop the current context out. Prefer native video Picture-in-Picture
// when the page has a video; otherwise float the whole page in a frameless,
// always-on-top mini window.
export async function triggerPip(): Promise<'video' | 'window' | null> {
  const s = useAppStore.getState()
  const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId)
  const tab = ws?.tabs.find((t) => t.id === ws.activeTabId)
  if (!tab) return null

  const wv = getWebview(tab.id)
  if (!isElectron || !wv) return null

  try {
    const usedVideo = (await wv.executeJavaScript(
      `(async () => {
        const v = [...document.querySelectorAll('video')].find((x) => !x.paused)
          || document.querySelector('video');
        if (v) { try { await v.requestPictureInPicture(); return true; } catch (e) { return false; } }
        return false;
      })()`,
      true // userGesture — required for the PiP request
    )) as boolean
    if (usedVideo) return 'video'
  } catch {
    /* fall through to window PiP */
  }

  await window.scout.openPip(tab.url)
  return 'window'
}
