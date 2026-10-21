import { EditorWindow } from './windows/WordEditorWindow'
import { PetWindow } from './windows/PetWindow'
import { ReviewWindow } from './windows/ReviewWindow'

interface AppProps {
  view: string
}

export function App({ view }: AppProps): React.JSX.Element {
  if (view === 'review') {
    return <ReviewWindow />
  }
  if (view === 'editor') {
    return <EditorWindow />
  }
  return <PetWindow />
}
