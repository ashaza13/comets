import { useEffect } from 'react'
import { folder, useControls } from 'leva'
import { DOMAINS } from '../lib/spec'
import { useCometStore } from '../store'

const range = (value: number, min: number, max: number) => ({ value, min, max, step: 0.01 })

// Manual controls for every visual channel (open the app with ?debug).
// This is the README's Phase 1 slider prototype, used for tuning the look.
export function DebugControls() {
  const setDebugComet = useCometStore((s) => s.setDebugComet)

  const v = useControls({
    position: folder({ x: range(0, -1, 1), y: range(0, -1, 1), z: range(0, -1, 1) }),
    uncertainty: range(0.5, 0, 1),
    emotion: folder({ hue: { value: 200, min: 0, max: 360, step: 1 }, saturation: range(0.6, 0, 1), energy: range(0.6, 0, 1) }),
    interests: folder(Object.fromEntries(DOMAINS.map((d) => [d.id, range(0, 0, 1)])), { collapsed: true }),
  }) as Record<string, number>

  // leva may hand back a fresh object each render; key the effect on its values.
  const key = JSON.stringify(v)
  useEffect(() => {
    const v = JSON.parse(key) as Record<string, number>
    setDebugComet({
      personality: { x: v.x, y: v.y, z: v.z },
      uncertainty: { x: v.uncertainty, y: v.uncertainty, z: v.uncertainty },
      emotion: { hue: v.hue, saturation: v.saturation, lightness: v.energy },
      interests: Object.fromEntries(DOMAINS.map((d) => [d.id, v[d.id]]).filter(([, depth]) => (depth as number) > 0)),
      message_count: 0,
    })
  }, [key, setDebugComet])

  useEffect(() => () => setDebugComet(null), [setDebugComet])
  return null
}
