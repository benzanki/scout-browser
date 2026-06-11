import { app, BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync } from 'fs'

export interface WindowState {
  width: number
  height: number
  x?: number
  y?: number
  maximized?: boolean
}

const FILE = join(app.getPath('userData'), 'window-state.json')
const DEFAULTS: WindowState = { width: 1440, height: 900 }
const MIN_W = 940
const MIN_H = 600

/** Clamp a saved size to the minimums and drop off-screen positions. */
function sanitize(s: WindowState): WindowState {
  const width = Math.max(MIN_W, Math.round(s.width))
  const height = Math.max(MIN_H, Math.round(s.height))
  let { x, y } = s
  if (typeof x === 'number' && typeof y === 'number') {
    // Keep the window only if its top-left still lands on a connected display
    // (guards against unplugging a monitor between sessions).
    const onScreen = screen.getAllDisplays().some((d) => {
      const a = d.workArea
      return x! >= a.x - 8 && y! >= a.y - 8 && x! < a.x + a.width - 80 && y! < a.y + a.height - 40
    })
    if (!onScreen) {
      x = undefined
      y = undefined
    }
  }
  return { width, height, x, y, maximized: s.maximized }
}

/** Read the last-used window bounds, falling back to sensible defaults. */
export function loadWindowState(): WindowState {
  try {
    const raw = JSON.parse(readFileSync(FILE, 'utf-8')) as WindowState
    if (typeof raw.width === 'number' && typeof raw.height === 'number') {
      return sanitize(raw)
    }
  } catch {
    /* first run / no saved state */
  }
  return { ...DEFAULTS }
}

function write(win: BrowserWindow): void {
  try {
    if (win.isDestroyed()) return
    // Normal bounds = the un-maximized size, so we can restore both the size
    // and the maximized flag independently next launch.
    const b = win.getNormalBounds()
    const state: WindowState = {
      width: b.width,
      height: b.height,
      x: b.x,
      y: b.y,
      maximized: win.isMaximized()
    }
    writeFileSync(FILE, JSON.stringify(state))
  } catch {
    /* ignore disk errors */
  }
}

/** Persist size/position/maximized as the user resizes, moves, or closes. */
export function trackWindowState(win: BrowserWindow): void {
  let timer: NodeJS.Timeout | null = null
  const save = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => write(win), 400)
  }
  win.on('resize', save)
  win.on('move', save)
  win.on('maximize', save)
  win.on('unmaximize', save)
  // Flush synchronously on close so the final state isn't lost to the debounce.
  win.on('close', () => {
    if (timer) clearTimeout(timer)
    write(win)
  })
}
