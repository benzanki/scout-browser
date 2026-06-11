import { useEffect, useRef, useState } from 'react'
import {
  PanelLeftClose,
  PanelLeftOpen,
  Layers,
  Plus,
  Compass,
  Globe,
  VenetianMask,
  Snowflake,
  MoreHorizontal,
  Pencil,
  Trash2,
  History,
  Settings,
  FileText,
  Pin,
  Volume2,
  VolumeX,
  X
} from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { useUiStore } from '../store/uiStore'
import { dotClass, WORKSPACE_COLORS } from '../lib/icons'
import { wvSetMuted } from '../lib/webviewRegistry'
import type { Workspace } from '../../../shared/types'
import logoBanner from '../assets/logo-banner.png'

interface Props {
  collapsed: boolean
  onToggle: () => void
}

function TabRow({
  tab,
  active,
  audible,
  muted,
  onActivate,
  onClose,
  onTogglePin,
  onToggleMute
}: {
  tab: Workspace['tabs'][number]
  active: boolean
  audible?: boolean
  muted?: boolean
  onActivate: () => void
  onClose: () => void
  onTogglePin: () => void
  onToggleMute: () => void
}): JSX.Element {
  const pinned = !!tab.pinned
  return (
    <div
      onClick={onActivate}
      title={tab.title || 'New Tab'}
      className={[
        'group/tab flex cursor-default items-center gap-2 rounded-md py-1.5 pl-2 pr-1.5 text-[13px]',
        active
          ? 'bg-scout-surface-2 text-scout-text'
          : 'text-scout-muted hover:bg-scout-surface-2/60 hover:text-scout-text'
      ].join(' ')}
    >
      {tab.private ? (
        <VenetianMask size={14} className="shrink-0 text-scout-purple" />
      ) : tab.favicon ? (
        <img
          src={tab.favicon}
          className="h-3.5 w-3.5 shrink-0 rounded-sm"
          onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
        />
      ) : (
        <Globe size={14} className="shrink-0 text-scout-faint" />
      )}
      <span className="truncate">{tab.title || 'New Tab'}</span>

      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        {/* Audio: shown whenever the tab is playing/muted */}
        {(audible || muted) && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleMute()
            }}
            className="rounded p-0.5 text-scout-faint hover:text-scout-text"
            title={muted ? 'Unmute tab' : 'Mute tab'}
          >
            {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>
        )}
        {/* Pin: always shown for pinned tabs, on hover otherwise */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onTogglePin()
          }}
          className={[
            'rounded p-0.5 hover:bg-scout-border hover:text-scout-text',
            pinned
              ? 'text-scout-accent'
              : 'text-scout-faint opacity-0 group-hover/tab:opacity-100'
          ].join(' ')}
          title={pinned ? 'Unpin tab' : 'Pin tab'}
        >
          {pinned ? <Pin size={12} fill="currentColor" /> : <Pin size={12} />}
        </button>
        {/* Close: hidden for pinned tabs to avoid accidental loss */}
        {!pinned && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            className="rounded p-0.5 text-scout-faint opacity-0 hover:bg-scout-border hover:text-scout-text group-hover/tab:opacity-100"
            title="Close tab"
          >
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

function WorkspaceRow({
  w,
  isActive,
  collapsed,
  onActivate,
  onRename,
  onDelete,
  isDropTarget,
  onTabDragOver,
  onTabDragLeave,
  onTabDrop
}: {
  w: Workspace
  isActive: boolean
  collapsed: boolean
  onActivate: () => void
  onRename: (name: string) => void
  onDelete: () => void
  isDropTarget?: boolean
  onTabDragOver?: () => void
  onTabDragLeave?: () => void
  onTabDrop?: () => void
}): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(w.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renaming) {
      setName(w.name)
      requestAnimationFrame(() => inputRef.current?.select())
    }
  }, [renaming, w.name])

  // Close the menu on any outside click.
  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (): void => setMenuOpen(false)
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  const commitRename = (): void => {
    const v = name.trim()
    if (v && v !== w.name) onRename(v)
    setRenaming(false)
  }

  const handleDelete = (): void => {
    setMenuOpen(false)
    if (
      w.tabs.length > 0 &&
      !window.confirm(`Delete “${w.name}” and its ${w.tabs.length} tab(s)?`)
    )
      return
    onDelete()
  }

  return (
    <div
      onClick={() => !renaming && onActivate()}
      title={collapsed ? w.name : undefined}
      onDragOver={
        onTabDrop
          ? (e) => {
              e.preventDefault()
              onTabDragOver?.()
            }
          : undefined
      }
      onDragLeave={onTabDrop ? () => onTabDragLeave?.() : undefined}
      onDrop={
        onTabDrop
          ? (e) => {
              e.preventDefault()
              onTabDrop()
            }
          : undefined
      }
      className={[
        'group/ws relative flex cursor-default items-center gap-2.5 rounded-lg py-1.5 pl-3 pr-2 text-sm',
        isDropTarget
          ? 'ring-1 ring-scout-accent'
          : isActive
            ? 'bg-scout-surface-2 font-medium text-scout-text'
            : 'text-scout-muted hover:bg-scout-surface-2/60 hover:text-scout-text'
      ].join(' ')}
    >
      {/* Per-workspace color identity: a left accent bar (active) + a dot. */}
      {isActive && !collapsed && (
        <span
          className={[
            'absolute bottom-1.5 left-0 top-1.5 w-[3px] rounded-full',
            dotClass(w.color)
          ].join(' ')}
        />
      )}
      <span
        className={[
          'h-2.5 w-2.5 shrink-0 rounded-full',
          dotClass(w.color),
          isActive ? '' : 'opacity-70'
        ].join(' ')}
      />

      {!collapsed &&
        (renaming ? (
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              else if (e.key === 'Escape') setRenaming(false)
            }}
            onBlur={commitRename}
            className="min-w-0 flex-1 select-text rounded border border-scout-accent bg-scout-bg px-1 py-0 text-sm text-scout-text focus:outline-none"
          />
        ) : (
          <span className="truncate">{w.name}</span>
        ))}

      {!collapsed && !renaming && (
        <div className="ml-auto flex items-center">
          {w.tabs.length > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-scout-faint group-hover/ws:hidden">
              {!isActive && <Snowflake size={12} className="text-scout-accent/70" />}
              {w.tabs.length}
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen((v) => !v)
            }}
            className="hidden rounded p-0.5 text-scout-faint hover:text-scout-text group-hover/ws:block"
            title="Workspace options"
          >
            <MoreHorizontal size={15} />
          </button>
        </div>
      )}

      {menuOpen && (
        <div
          // Stop mousedown too: the outside-click handler listens on mousedown,
          // which fires before click — without this it would close the menu
          // before the Rename/Delete click could register.
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-1 top-9 z-20 w-36 overflow-hidden rounded-lg border border-scout-border bg-scout-surface-2 py-1 shadow-xl shadow-black/40"
        >
          <button
            onClick={() => {
              setMenuOpen(false)
              setRenaming(true)
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-[13px] text-scout-text hover:bg-scout-surface"
          >
            <Pencil size={14} /> Rename
          </button>
          <button
            onClick={handleDelete}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-[13px] text-scout-pink hover:bg-scout-surface"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}
    </div>
  )
}

export default function LeftSidebar({ collapsed, onToggle }: Props): JSX.Element {
  const workspaces = useAppStore((s) => s.workspaces)
  const activeWorkspaceId = useAppStore((s) => s.activeWorkspaceId)
  const setActiveWorkspace = useAppStore((s) => s.setActiveWorkspace)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const addTab = useAppStore((s) => s.addTab)
  const closeTab = useAppStore((s) => s.closeTab)
  const addWorkspace = useAppStore((s) => s.addWorkspace)
  const renameWorkspace = useAppStore((s) => s.renameWorkspace)
  const deleteWorkspace = useAppStore((s) => s.deleteWorkspace)
  const reorderTabs = useAppStore((s) => s.reorderTabs)
  const moveTab = useAppStore((s) => s.moveTab)
  const togglePin = useAppStore((s) => s.togglePin)
  const navStatus = useAppStore((s) => s.navStatus)
  const setNavStatus = useAppStore((s) => s.setNavStatus)
  const openPalette = useUiStore((s) => s.openPalette)
  const openLibrary = useUiStore((s) => s.openLibrary)
  const openHistory = useUiStore((s) => s.openHistory)
  const openSettings = useUiStore((s) => s.openSettings)
  const openBriefing = useUiStore((s) => s.openBriefing)
  const setDraggingTab = useUiStore((s) => s.setDraggingTab)
  const updateBehind = useUiStore((s) => s.updateInfo?.behind ?? false)
  const [drag, setDrag] = useState<{ id: string; index: number } | null>(null)
  const [dropWs, setDropWs] = useState<string | null>(null)

  const createWorkspace = (): void => {
    const n = workspaces.length
    addWorkspace(
      `Workspace ${n + 1}`,
      '',
      WORKSPACE_COLORS[n % WORKSPACE_COLORS.length]
    )
  }

  return (
    <aside
      className={[
        'glass flex h-full flex-col border-r border-scout-border',
        'transition-[width] duration-200 ease-out',
        collapsed ? 'w-[60px]' : 'w-[248px]'
      ].join(' ')}
    >
      {/* Brand / collapse */}
      <div className="app-drag flex h-12 items-center gap-2 px-3">
        {collapsed ? (
          <div className="app-no-drag flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-scout-accent-soft">
            <Compass size={17} className="text-scout-accent" />
          </div>
        ) : (
          <img
            src={logoBanner}
            alt="Scout"
            className="app-no-drag h-10 w-auto select-none"
            draggable={false}
          />
        )}
        <button
          onClick={onToggle}
          className="app-no-drag ml-auto rounded-md p-1.5 text-scout-muted hover:bg-scout-surface-2 hover:text-scout-text"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* Workspaces + nested tabs */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pt-3">
        {!collapsed && (
          <div className="flex items-center justify-between px-2 pb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-scout-faint">
              Workspaces
            </span>
            <button
              onClick={createWorkspace}
              className="rounded p-0.5 text-scout-faint hover:text-scout-text"
              title="New workspace"
            >
              <Plus size={14} />
            </button>
          </div>
        )}

        <nav className="flex flex-col gap-0.5">
          {workspaces.map((w) => {
            const isActive = w.id === activeWorkspaceId
            return (
              <div key={w.id}>
                <WorkspaceRow
                  w={w}
                  isActive={isActive}
                  collapsed={collapsed}
                  onActivate={() => setActiveWorkspace(w.id)}
                  onRename={(name) => renameWorkspace(w.id, name)}
                  onDelete={() => deleteWorkspace(w.id)}
                  isDropTarget={drag !== null && dropWs === w.id && !isActive}
                  onTabDragOver={() => {
                    if (drag) setDropWs(w.id)
                  }}
                  onTabDragLeave={() =>
                    setDropWs((cur) => (cur === w.id ? null : cur))
                  }
                  onTabDrop={() => {
                    if (drag) moveTab(drag.id, w.id)
                    setDrag(null)
                    setDropWs(null)
                  }}
                />

                {/* Tabs of the active workspace */}
                {!collapsed && isActive && (
                  <div className="mb-1 ml-1.5 mt-0.5 flex flex-col gap-px border-l border-scout-border pl-2">
                    {w.tabs
                      .map((t, i) => ({ t, i }))
                      .sort((a, b) => (b.t.pinned ? 1 : 0) - (a.t.pinned ? 1 : 0))
                      .map(({ t, i }) => (
                        <div
                          key={t.id}
                          draggable
                          onDragStart={() => {
                            setDrag({ id: t.id, index: i })
                            setDraggingTab(t.id)
                          }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.stopPropagation()
                            if (drag && drag.index !== i) reorderTabs(w.id, drag.index, i)
                            setDrag(null)
                            setDropWs(null)
                          }}
                          onDragEnd={() => {
                            setDrag(null)
                            setDropWs(null)
                            setDraggingTab(null)
                          }}
                          className={drag?.id === t.id ? 'opacity-40' : ''}
                        >
                          <TabRow
                            tab={t}
                            active={t.id === w.activeTabId}
                            audible={navStatus[t.id]?.audible}
                            muted={navStatus[t.id]?.muted}
                            onActivate={() => setActiveTab(t.id)}
                            onClose={() => closeTab(t.id)}
                            onTogglePin={() => togglePin(t.id)}
                            onToggleMute={() => {
                              const next = !navStatus[t.id]?.muted
                              wvSetMuted(t.id, next)
                              setNavStatus(t.id, { muted: next })
                            }}
                          />
                        </div>
                      ))}
                    <div className="flex items-center">
                      <button
                        onClick={() => addTab(w.id)}
                        className="flex flex-1 items-center gap-2 rounded-md py-1.5 pl-2 text-[13px] text-scout-faint hover:bg-scout-surface-2/60 hover:text-scout-text"
                      >
                        <Plus size={14} />
                        <span>New tab</span>
                      </button>
                      <button
                        onClick={() => addTab(w.id, undefined, true)}
                        title="New private tab (Ctrl+Shift+N)"
                        className="mr-1 rounded-md p-1.5 text-scout-faint hover:bg-scout-surface-2/60 hover:text-scout-purple"
                      >
                        <VenetianMask size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Library */}
        {!collapsed && (
          <div className="mt-5">
            <span className="px-2 text-[11px] font-semibold uppercase tracking-wider text-scout-faint">
              Library
            </span>
            <button
              onClick={openLibrary}
              className="mt-1.5 flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-scout-muted hover:bg-scout-surface-2 hover:text-scout-text"
            >
              <Layers size={17} />
              <span>Visual Canvas</span>
            </button>
            <button
              onClick={openHistory}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-scout-muted hover:bg-scout-surface-2 hover:text-scout-text"
            >
              <History size={17} />
              <span>History</span>
            </button>
            <button
              onClick={openBriefing}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-scout-muted hover:bg-scout-surface-2 hover:text-scout-text"
            >
              <FileText size={17} />
              <span>Briefing</span>
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 p-3">
        {!collapsed ? (
          <>
            <button
              onClick={openPalette}
              className="w-full rounded-lg border border-scout-border bg-scout-surface-2 px-3 py-2 text-left text-[11px] text-scout-faint hover:border-scout-accent hover:text-scout-muted"
            >
              Press <kbd className="rounded bg-scout-bg px-1 text-scout-muted">Ctrl</kbd>{' '}
              <kbd className="rounded bg-scout-bg px-1 text-scout-muted">K</kbd> for the
              command palette
            </button>
            <button
              onClick={openSettings}
              className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-scout-muted hover:bg-scout-surface-2 hover:text-scout-text"
            >
              <Settings size={17} />
              <span>Settings</span>
              {updateBehind && (
                <span
                  className="ml-auto h-2 w-2 rounded-full bg-scout-amber"
                  title="A browser engine update is available"
                />
              )}
            </button>
          </>
        ) : (
          <button
            onClick={openSettings}
            className="relative flex items-center justify-center rounded-lg p-1.5 text-scout-muted hover:bg-scout-surface-2 hover:text-scout-text"
            title={updateBehind ? 'Update available — Settings' : 'Settings'}
          >
            <Settings size={17} />
            {updateBehind && (
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-scout-amber" />
            )}
          </button>
        )}
      </div>
    </aside>
  )
}
