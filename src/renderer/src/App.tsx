import { useEffect, useRef } from 'react'
import CommandPalette from './components/CommandPalette'
import HistoryView from './components/HistoryView'
import SettingsModal from './components/SettingsModal'
import BriefingModal from './components/BriefingModal'
import PermissionPrompt from './components/PermissionPrompt'
import AppUpdateToast from './components/AppUpdateToast'
import Hub from './components/Hub'
import { useAppStore } from './store/appStore'
import { useUiStore } from './store/uiStore'
import { useAppCommands } from './hooks/useAppCommands'
import { isElectron } from './lib/env'

export default function App(): JSX.Element {
  const hydrated = useAppStore((s) => s.hydrated)
  const bootstrapped = useRef(false)

  // Wire main-process commands (shortcuts + context menu) and downloads.
  useAppCommands()

  // Listen for the browser-engine update notification.
  useEffect(() => {
    if (!isElectron) return
    return window.scout.onUpdateInfo((info) => useUiStore.getState().setUpdateInfo(info))
  }, [])

  // Load persisted state once, then keep it saved (debounced) on every change.
  useEffect(() => {
    if (bootstrapped.current) return
    bootstrapped.current = true

    const store = useAppStore.getState()

    const boot = async (): Promise<void> => {
      try {
        if (isElectron) {
          const saved = await window.scout.loadState()
          if (saved?.workspaces?.length) store.hydrate(saved)
          else store.seedDefault()
        } else {
          store.seedDefault()
          // Populate the Visual Canvas with demo cards for the browser preview.
          store.seedDemoLibrary()
        }
      } catch (err) {
        // Never get stuck on the blank loader if state fails to load.
        console.error('Scout boot failed, seeding defaults:', err)
        store.seedDefault()
      }
    }

    void boot().then(() => {
      if (!isElectron) return
      let timer: ReturnType<typeof setTimeout> | null = null
      useAppStore.subscribe((state) => {
        if (!state.hydrated) return
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
          void window.scout.saveState(useAppStore.getState().serialize())
        }, 400)
      })
    })
  }, [])

  if (!hydrated) {
    return <div className="flex h-full w-full items-center justify-center bg-scout-bg" />
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-scout-bg text-scout-text">
      {/* The Hub is Scout's permanent shell: an app rail plus a content area that
          shows the home dashboard, the browser, or an app panel — all mounted. */}
      <Hub />

      {/* Full-app overlays (work from any Hub view — incl. permission prompts that
          an app panel like Discord triggers when it asks for mic/camera). */}
      <PermissionPrompt />
      <AppUpdateToast />
      <HistoryView />
      <SettingsModal />
      <BriefingModal />
      <CommandPalette />
    </div>
  )
}
