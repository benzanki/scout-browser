import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import type { AppState } from '../shared/types'

// Simple local-first JSON persistence in the OS userData directory.
// Chosen over native SQLite to keep early iteration dependency-free and
// avoid native-module rebuilds against Electron's Node ABI.

const FILE = () => join(app.getPath('userData'), 'scout-state.json')

const EMPTY_STATE: AppState = {
  workspaces: [],
  activeWorkspaceId: null,
  notes: [],
  library: [],
  history: [],
  settings: { searchEngine: 'google', homepage: 'https://www.google.com' },
  shortcuts: [],
  appPanels: [],
  tasks: []
}

export async function loadState(): Promise<AppState> {
  try {
    const raw = await fs.readFile(FILE(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppState>
    // Merge with defaults so missing keys from older versions don't crash.
    return { ...EMPTY_STATE, ...parsed }
  } catch {
    return EMPTY_STATE
  }
}

let writeQueue: Promise<void> = Promise.resolve()

export async function saveState(state: AppState): Promise<void> {
  // Serialize writes so concurrent saves can't interleave and corrupt the file.
  writeQueue = writeQueue.then(async () => {
    const tmp = FILE() + '.tmp'
    await fs.writeFile(tmp, JSON.stringify(state, null, 2), 'utf-8')
    await fs.rename(tmp, FILE())
  })
  return writeQueue
}
