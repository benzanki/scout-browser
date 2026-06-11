import LeftSidebar from './LeftSidebar'
import TopBar from './TopBar'
import CenterPane from './CenterPane'
import RightSidebar from './RightSidebar'
import InspectBanner from './InspectBanner'
import FindBar from './FindBar'
import ProgressBar from './ProgressBar'
import { useUiStore } from '../store/uiStore'

// The browser surface — one of the Hub's views. Kept mounted so tabs stay alive
// while you're on the Hub home or an app panel.
export default function BrowserView(): JSX.Element {
  const leftCollapsed = useUiStore((s) => s.leftCollapsed)
  const toggleLeft = useUiStore((s) => s.toggleLeft)
  const rightOpen = useUiStore((s) => s.rightOpen)
  const toggleRight = useUiStore((s) => s.toggleRight)
  const setRightOpen = useUiStore((s) => s.setRightOpen)

  return (
    <div className="flex h-full w-full overflow-hidden text-scout-text">
      <LeftSidebar collapsed={leftCollapsed} onToggle={toggleLeft} />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <TopBar
          rightOpen={rightOpen}
          onToggleRight={toggleRight}
          leftCollapsed={leftCollapsed}
          onToggleLeft={toggleLeft}
        />
        <ProgressBar />
        <CenterPane />
        <InspectBanner />
        <FindBar />
      </div>

      {rightOpen && <RightSidebar onClose={() => setRightOpen(false)} />}
    </div>
  )
}
