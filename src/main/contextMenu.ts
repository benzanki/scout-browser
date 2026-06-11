import {
  Menu,
  clipboard,
  type WebContents,
  type ContextMenuParams,
  type MenuItemConstructorOptions
} from 'electron'
import { IPC, type AppCommand } from '../shared/types'

// Prepend dictionary suggestions + "Add to dictionary" for a misspelled word.
function appendSpelling(
  t: MenuItemConstructorOptions[],
  wc: WebContents,
  params: ContextMenuParams
): void {
  if (!params.misspelledWord) return
  for (const s of params.dictionarySuggestions.slice(0, 5)) {
    t.push({ label: s, click: () => wc.replaceMisspelling(s) })
  }
  if (params.dictionarySuggestions.length === 0) {
    t.push({ label: 'No suggestions', enabled: false })
  }
  t.push(
    {
      label: 'Add to dictionary',
      click: () => wc.session.addWordToSpellCheckerDictionary(params.misspelledWord)
    },
    { type: 'separator' }
  )
}

// Build a native right-click menu for embedded pages. Most items act directly on
// the webview's WebContents; a few route back to the renderer (open tab, save to
// notes, bookmark, inspect) via the app-command channel.
export function showPageContextMenu(
  wc: WebContents,
  params: ContextMenuParams,
  sendToRenderer: (channel: string, payload: AppCommand) => void
): void {
  const send = (cmd: string, args?: Record<string, unknown>): void =>
    sendToRenderer(IPC.APP_COMMAND, { cmd, args })

  const t: MenuItemConstructorOptions[] = []

  // Spelling suggestions first, when right-clicking a misspelled word.
  appendSpelling(t, wc, params)

  t.push(
    { label: 'Back', enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() },
    { label: 'Forward', enabled: wc.navigationHistory.canGoForward(), click: () => wc.navigationHistory.goForward() },
    { label: 'Reload', click: () => wc.reload() }
  )

  if (params.linkURL) {
    t.push(
      { type: 'separator' },
      {
        label: 'Open Link in New Tab',
        click: () => send('open-tab', { url: params.linkURL, sourceWcId: wc.id })
      },
      {
        label: 'Open Link in New Private Tab',
        click: () => send('open-tab', { url: params.linkURL, private: true })
      },
      { label: 'Copy Link Address', click: () => clipboard.writeText(params.linkURL) }
    )
  }

  if (params.mediaType === 'image' && params.srcURL) {
    t.push(
      { type: 'separator' },
      {
        label: 'Open Image in New Tab',
        click: () => send('open-tab', { url: params.srcURL, sourceWcId: wc.id })
      },
      { label: 'Copy Image', click: () => wc.copyImageAt(params.x, params.y) }
    )
  }

  if (params.selectionText && params.selectionText.trim()) {
    const sel = params.selectionText.trim()
    const short = sel.length > 24 ? sel.slice(0, 24) + '…' : sel
    t.push(
      { type: 'separator' },
      { label: 'Copy', role: 'copy' },
      {
        label: 'Save Selection to Notes',
        click: () => send('append-note', { text: sel, sourceUrl: params.pageURL || wc.getURL() })
      },
      { label: `Search for “${short}”`, click: () => send('search', { query: sel }) }
    )
  }

  if (params.isEditable) {
    t.push(
      { type: 'separator' },
      { label: 'Cut', role: 'cut' },
      { label: 'Paste', role: 'paste' },
      { label: 'Select All', role: 'selectAll' }
    )
  }

  t.push(
    { type: 'separator' },
    { label: 'Bookmark Page to Library', click: () => send('bookmark') },
    { label: 'Inspect & Scrape Element', click: () => send('inspect') }
  )

  Menu.buildFromTemplate(t).popup()
}

// Minimal edit menu for editable fields / selections inside Scout's own UI
// (the omnibox, the notes editor) so right-click copy/paste works.
export function showEditContextMenu(wc: WebContents, params: ContextMenuParams): void {
  if (!params.isEditable && !params.selectionText) return
  const t: MenuItemConstructorOptions[] = []
  appendSpelling(t, wc, params)
  if (params.selectionText) t.push({ label: 'Copy', role: 'copy' })
  if (params.isEditable) {
    if (params.selectionText) t.push({ label: 'Cut', role: 'cut' })
    t.push({ label: 'Paste', role: 'paste' }, { type: 'separator' }, {
      label: 'Select All',
      role: 'selectAll'
    })
  }
  if (t.length) Menu.buildFromTemplate(t).popup()
}
