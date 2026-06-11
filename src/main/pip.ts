import { BrowserWindow, type Rectangle } from 'electron'

// Present as plain Chrome so UA-sniffing sites (Google) don't serve a blank page.
const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

const pipWindows = new Set<BrowserWindow>()

// A tiny draggable strip + close button injected into the PiP page, since a
// frameless window showing an external site has no chrome of its own to move it.
const DRAG_BAR = `
(() => {
  if (window.__scoutPip) return;
  window.__scoutPip = true;
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;top:0;left:0;right:0;height:26px;z-index:2147483647;' +
    'display:flex;align-items:center;justify-content:flex-end;gap:6px;padding:0 8px;' +
    'background:rgba(11,14,20,.82);backdrop-filter:blur(6px);' +
    'font:600 11px system-ui,sans-serif;color:#8b94a7;-webkit-app-region:drag;';
  const label = document.createElement('span');
  label.textContent = 'Scout PiP';
  label.style.cssText = 'margin-right:auto;opacity:.8;';
  const close = document.createElement('button');
  close.textContent = '✕';
  close.style.cssText = '-webkit-app-region:no-drag;cursor:pointer;border:0;background:transparent;' +
    'color:#8b94a7;font-size:13px;line-height:1;padding:4px 6px;border-radius:4px;';
  close.onmouseenter = () => { close.style.background = '#e0445533'; close.style.color = '#fff'; };
  close.onmouseleave = () => { close.style.background = 'transparent'; close.style.color = '#8b94a7'; };
  close.onclick = () => window.close();
  bar.appendChild(label); bar.appendChild(close);
  document.documentElement.appendChild(bar);
  document.body && (document.body.style.paddingTop = '26px');
})();
`

export function openPipWindow(url: string, workArea: Rectangle): void {
  const w = 440
  const h = 280
  const win = new BrowserWindow({
    width: w,
    height: h,
    x: workArea.x + workArea.width - w - 24,
    y: workArea.y + workArea.height - h - 24,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    backgroundColor: '#0b0e14',
    webPreferences: {
      partition: 'persist:scout'
    }
  })

  // Float above full-screen apps too.
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  win.loadURL(url, { userAgent: CHROME_UA })
  win.webContents.on('did-finish-load', () => {
    win.webContents.executeJavaScript(DRAG_BAR).catch(() => void 0)
  })

  win.on('closed', () => pipWindows.delete(win))
  pipWindows.add(win)
}
