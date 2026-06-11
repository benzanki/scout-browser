import { Component, type ReactNode } from 'react'
import type { AppState } from '../../../shared/types'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

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

// Catches render-time crashes so the whole window never goes blank. Offers a
// reload and a last-resort "reset Scout data" (clears the persisted JSON).
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error): void {
    // eslint-disable-next-line no-console
    console.error('Scout render error:', error)
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex h-full w-full items-center justify-center bg-scout-bg p-8 text-scout-text">
        <div className="flex max-w-lg flex-col items-center text-center">
          <h1 className="text-xl font-semibold">Scout hit a snag</h1>
          <p className="mt-2 text-sm text-scout-muted">
            Something went wrong while rendering. Reloading usually fixes it.
          </p>
          <pre className="mt-4 max-h-40 w-full overflow-auto rounded-lg border border-scout-border bg-scout-surface p-3 text-left text-[11px] text-scout-amber">
            {error.message}
          </pre>
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => location.reload()}
              className="rounded-lg border border-scout-border bg-scout-surface px-4 py-2 text-sm hover:border-scout-accent hover:bg-scout-surface-2"
            >
              Reload
            </button>
            <button
              onClick={async () => {
                try {
                  await window.scout?.saveState(EMPTY_STATE)
                } catch {
                  /* ignore */
                }
                location.reload()
              }}
              className="rounded-lg border border-scout-border px-4 py-2 text-sm text-scout-pink hover:bg-scout-surface-2"
            >
              Reset Scout data
            </button>
          </div>
        </div>
      </div>
    )
  }
}
