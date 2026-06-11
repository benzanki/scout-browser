import { useActiveWorkspace } from '../store/appStore'
import WebviewStack from './WebviewStack'
import NewTabPage from './NewTabPage'

export default function CenterPane(): JSX.Element {
  const workspace = useActiveWorkspace()
  if (!workspace || workspace.tabs.length === 0) {
    return (
      <main className="relative min-h-0 flex-1">
        <NewTabPage />
      </main>
    )
  }
  return <WebviewStack workspace={workspace} />
}
