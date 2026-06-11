import { ScanText, X } from 'lucide-react'
import { useUiStore } from '../store/uiStore'

// Floating prompt shown while Inspect & Scrape mode is armed (Feature 3).
// The actual hover-highlight + click-to-extract happens inside the webview.
export default function InspectBanner(): JSX.Element | null {
  const inspectMode = useUiStore((s) => s.inspectMode)
  const setInspectMode = useUiStore((s) => s.setInspectMode)
  if (!inspectMode) return null

  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-scout-accent/40 bg-scout-surface/95 px-4 py-2 shadow-lg shadow-black/40 backdrop-blur">
        <ScanText size={16} className="animate-pulse text-scout-accent" />
        <span className="text-[13px] text-scout-text">
          Inspect Mode — hover an element and click to extract it as Markdown
        </span>
        <span className="text-[11px] text-scout-faint">Esc to cancel</span>
        <button
          onClick={() => setInspectMode(false)}
          className="rounded-full p-1 text-scout-muted hover:bg-scout-surface-2 hover:text-scout-text"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
