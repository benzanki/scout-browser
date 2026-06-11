import { useUiStore } from '../store/uiStore'
import ScratchpadPanel from './ScratchpadPanel'
import LibraryPanel from './LibraryPanel'

interface Props {
  onClose: () => void
}

// The right sidebar hosts either the markdown scratchpad or the Visual Canvas
// (bookmarks), switchable in place so bookmarks are reachable without leaving
// the current page.
export default function RightSidebar({ onClose }: Props): JSX.Element {
  const rightPanel = useUiStore((s) => s.rightPanel)
  return rightPanel === 'library' ? (
    <LibraryPanel onClose={onClose} />
  ) : (
    <ScratchpadPanel onClose={onClose} />
  )
}
