import { useActiveTab, useAppStore } from '../store/appStore'

// Thin indeterminate loading bar shown under the top bar while the active tab
// is loading.
export default function ProgressBar(): JSX.Element | null {
  const activeTab = useActiveTab()
  const loading = useAppStore((s) =>
    activeTab ? s.navStatus[activeTab.id]?.loading : false
  )
  if (!loading) return null
  return (
    <div className="pointer-events-none absolute left-0 right-0 top-12 z-20 h-0.5 overflow-hidden bg-scout-accent-soft">
      <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-scout-accent via-scout-purple to-scout-teal animate-[scoutload_1.1s_linear_infinite] shadow-[0_0_10px_rgba(123,140,255,0.6)]" />
    </div>
  )
}
