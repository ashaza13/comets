import { Leva } from 'leva'
import { DebugControls } from './DebugControls'

// Loaded only with ?debug so leva stays out of the main bundle.
export default function DebugPanel() {
  return (
    <>
      <Leva collapsed={false} />
      <DebugControls />
    </>
  )
}
