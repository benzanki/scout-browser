import { useState } from 'react'
import type { Workspace } from '../../../shared/types'
import Webview, { type Region } from './Webview'
import { useUiStore } from '../store/uiStore'
import { useAppStore } from '../store/appStore'
import { SquareArrowRight, Maximize2 } from 'lucide-react'

interface Props {
  workspace: Workspace
}

// Mounts every tab's webview for the active workspace; only the active one is
// visible (or two side-by-side in split view). Keeping them mounted preserves
// page state across tab switches.
export default function WebviewStack({ workspace }: Props): JSX.Element {
  const splitTabId = useUiStore((s) => s.splitTabId)
  const setSplitTab = useUiStore((s) => s.setSplitTab)
  const draggingTabId = useUiStore((s) => s.draggingTabId)
  const setDraggingTab = useUiStore((s) => s.setDraggingTab)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const [hoverSide, setHoverSide] = useState<'left' | 'right' | null>(null)

  const activeId = workspace.activeTabId
  const splitValid =
    !!splitTabId &&
    splitTabId !== activeId &&
    workspace.tabs.some((t) => t.id === splitTabId)

  const regionFor = (tabId: string): Region => {
    if (!splitValid) return tabId === activeId ? 'full' : 'hidden'
    if (tabId === activeId) return 'left'
    if (tabId === splitTabId) return 'right'
    return 'hidden'
  }

  // Drop a dragged tab onto a half to compose the split.
  const dropLeft = (): void => {
    if (draggingTabId) setActiveTab(draggingTabId)
    setDraggingTab(null)
    setHoverSide(null)
  }
  const dropRight = (): void => {
    if (draggingTabId) setSplitTab(draggingTabId)
    setDraggingTab(null)
    setHoverSide(null)
  }

  const zone = (side: 'left' | 'right'): JSX.Element => (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setHoverSide(side)
      }}
      onDragLeave={() => setHoverSide((s) => (s === side ? null : s))}
      onDrop={(e) => {
        e.preventDefault()
        side === 'left' ? dropLeft() : dropRight()
      }}
      className={[
        'flex flex-1 flex-col items-center justify-center gap-2 border-2 border-dashed transition-colors',
        hoverSide === side
          ? 'border-scout-accent bg-scout-accent-soft/40 text-scout-accent'
          : 'border-transparent text-scout-muted'
      ].join(' ')}
    >
      {side === 'left' ? <Maximize2 size={26} /> : <SquareArrowRight size={26} />}
      <span className="text-sm font-medium">
        {side === 'left' ? 'Open here' : 'Open in split →'}
      </span>
    </div>
  )

  return (
    <main className="relative min-h-0 flex-1">
      {workspace.tabs.map((tab) => (
        <Webview
          key={tab.id}
          tab={tab}
          region={regionFor(tab.id)}
          active={tab.id === activeId}
        />
      ))}
      {splitValid && (
        <div className="pointer-events-none absolute bottom-0 left-1/2 top-0 z-10 w-px -translate-x-1/2 bg-scout-border" />
      )}

      {/* Drop zones — only while dragging a tab from the sidebar. */}
      {draggingTabId && (
        <div className="absolute inset-0 z-30 flex bg-scout-bg/70 backdrop-blur-sm">
          {zone('left')}
          {zone('right')}
        </div>
      )}
    </main>
  )
}
