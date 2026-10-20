import { useMemo, useRef, type RefObject } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { easing } from 'maath'
import * as THREE from 'three'
import { useReducedMotion } from '../hooks/useReducedMotion'

/**
 * - demo: no answers yet; the camera holds still while the comet wanders.
 * - journey: answering questions; the camera travels with the comet.
 * - map: every question answered; the camera centres on the whole space.
 */
export type CameraMode = 'demo' | 'journey' | 'map'

const DISTANCE: Record<CameraMode, number> = { demo: 8.4, journey: 6.2, map: 9.5 }
// How long the camera eases towards a mode's framing distance after the mode changes.
const FRAMING_SECONDS = 3
const IDLE_RESUME_SECONDS = 4
const ORIGIN = new THREE.Vector3()

type Controls = React.ComponentRef<typeof OrbitControls>

interface Props {
  mode: CameraMode
  head: RefObject<THREE.Group | null>
}

export function CameraRig({ mode, head }: Props) {
  const controls = useRef<Controls>(null)
  // endedAt is null until the frame loop stamps it with the clock's time.
  const interaction = useRef<{ active: boolean; endedAt: number | null }>({ active: false, endedAt: -Infinity })
  const framing = useRef<{ mode: CameraMode | null; until: number }>({ mode: null, until: 0 })
  const reducedMotion = useReducedMotion()
  const tmp = useMemo(() => ({ goal: new THREE.Vector3(), before: new THREE.Vector3(), offset: new THREE.Vector3() }), [])

  useFrame(({ camera, clock }, delta) => {
    const c = controls.current
    if (!c) return
    const now = clock.getElapsedTime()
    if (interaction.current.endedAt === null) interaction.current.endedAt = now
    const { active, endedAt } = interaction.current

    // A new mode re-frames the shot, except on first mount (keep the initial view).
    if (framing.current.mode !== mode) {
      framing.current = { mode, until: framing.current.mode === null ? 0 : now + FRAMING_SECONDS }
    }

    // Follow: move the orbit target to the comet and carry the camera along by
    // the same amount, so the user's chosen angle and zoom are kept.
    const { goal, before, offset } = tmp
    if (mode === 'journey' && head.current) goal.copy(head.current.position)
    else goal.copy(ORIGIN)
    before.copy(c.target)
    easing.damp3(c.target, goal, mode === 'journey' ? 0.6 : 1.4, delta)
    camera.position.add(offset.subVectors(c.target, before))

    // Ease to the mode's framing distance, unless the user takes over.
    if (now < framing.current.until && !active && !reducedMotion) {
      offset.subVectors(camera.position, c.target)
      const length = { v: offset.length() }
      easing.damp(length, 'v', DISTANCE[mode], 1.2, delta)
      camera.position.copy(c.target).addScaledVector(offset.normalize(), length.v)
    }

    const idle = !active && now - endedAt > IDLE_RESUME_SECONDS
    const spin = reducedMotion || !idle ? 0 : mode === 'demo' ? 0.5 : 0.2
    easing.damp(c, 'autoRotateSpeed', spin, 1.5, delta)
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.06}
      minDistance={3}
      maxDistance={14}
      autoRotate
      autoRotateSpeed={0}
      onStart={() => {
        interaction.current.active = true
        framing.current.until = 0
      }}
      onEnd={() => {
        interaction.current = { active: false, endedAt: null }
      }}
    />
  )
}
