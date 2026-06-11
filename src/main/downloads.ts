import { session, app, dialog, type BrowserWindow } from 'electron'
import { join } from 'path'
import { IPC, BROWSING_PARTITIONS, type DownloadItem, type DownloadState } from '../shared/types'

let counter = 0

// File types that can execute code / harm the machine — warn before keeping.
const DANGEROUS =
  /\.(exe|msi|msix|bat|cmd|com|scr|pif|ps1|psm1|vbs|vbe|js|jse|jar|reg|msc|dll|cpl|hta|wsf|wsh|lnk|inf|gadget|apk|app|dmg|pkg|deb|rpm|sh|run|bin)$/i

// Handle downloads for the shared browsing session: save to the OS Downloads
// folder, but warn (Chrome-style) before keeping executables/scripts.
export function registerDownloads(getWindow: () => BrowserWindow | null): void {
  const onWillDownload = (_e: Electron.Event, item: Electron.DownloadItem): void => {
    const id = `dl_${Date.now()}_${counter++}`
    const startedAt = Date.now()
    const filename = item.getFilename()
    const savePath = join(app.getPath('downloads'), filename)
    item.setSavePath(savePath)

    const send = (state: DownloadState): void => {
      const payload: DownloadItem = {
        id,
        filename,
        url: item.getURL(),
        state,
        receivedBytes: item.getReceivedBytes(),
        totalBytes: item.getTotalBytes(),
        savePath,
        startedAt
      }
      getWindow()?.webContents.send(IPC.DOWNLOAD_UPDATE, payload)
    }

    // Dangerous file types: pause and ask before keeping.
    if (DANGEROUS.test(filename)) {
      item.pause()
      const win = getWindow()
      const opts = {
        type: 'warning' as const,
        buttons: ['Keep file', 'Discard'],
        defaultId: 1,
        cancelId: 1,
        noLink: true,
        title: 'This file could be dangerous',
        message: `“${filename}” is an executable or script.`,
        detail:
          'Files like this can install software or run code on your computer. Only keep it if you trust the source.'
      }
      const prompt = win ? dialog.showMessageBox(win, opts) : dialog.showMessageBox(opts)
      prompt
        .then(({ response }) => {
          if (response === 0) item.resume()
          else item.cancel()
        })
        .catch(() => item.cancel())
    }

    send('progressing')
    item.on('updated', () => {
      send(item.isPaused() ? 'paused' : 'progressing')
    })
    item.once('done', (_e2, state) => {
      send(state as DownloadState)
    })
  }

  // Both the persistent and private sessions save downloads the same way.
  for (const part of BROWSING_PARTITIONS) {
    session.fromPartition(part).on('will-download', onWillDownload)
  }
}
