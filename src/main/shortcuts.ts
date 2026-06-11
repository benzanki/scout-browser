import type { Input } from 'electron'

// Map a low-level key event to a Scout command name. Handled in the main process
// via `before-input-event` so shortcuts fire even when keyboard focus is inside
// an embedded <webview> (which the renderer's own listeners can't see).
export function matchShortcut(input: Input): string | null {
  if (input.type !== 'keyDown') return null
  const ctrl = input.control || input.meta
  const k = input.key.toLowerCase()

  if (k === 'f5') return 'reload'
  if (input.alt && k === 'arrowleft') return 'back'
  if (input.alt && k === 'arrowright') return 'forward'
  if (!ctrl) return null

  // Ctrl/Cmd combos
  if (input.shift) {
    if (k === 't') return 'reopen-tab'
    if (k === 'tab') return 'prev-tab'
    if (k === 's') return 'save-selection'
    if (k === 'n') return 'new-private-tab'
    return null
  }
  switch (k) {
    case 't':
      return 'new-tab'
    case 'w':
      return 'close-tab'
    case 'l':
      return 'focus-omnibox'
    case 'r':
      return 'reload'
    case 'tab':
      return 'next-tab'
    case 'f':
      return 'find'
    case 'p':
      return 'print'
    case 'k':
      return 'palette'
    case '=':
    case '+':
      return 'zoom-in'
    case '-':
      return 'zoom-out'
    case '0':
      return 'zoom-reset'
    default:
      return null
  }
}
