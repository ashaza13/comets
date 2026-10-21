import { useMemo, useRef, type RefObject } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { easing } from 'maath'
import * as THREE from 'three'
import { useReducedMotion } from '../hooks/useReducedMotion'

/**
 * - demo: no answers yet; the camera holds still while the comet wanders.
 * - journey: answering questions; the camera travels with the comet.
 * - replay: the journey is replaying; the camera rides along close behind.
 * - map: every question answered; the camera orbits the comet's final place,
 *   pulled back far enough to show the whole journey.
 */
export type CameraMode = 'demo' | 'journey' | 'replay' | 'map'

// Framing distance per mode; the map's comes from the journey's size.
const DISTANCE: Record<Exclude<CameraMode, 'map'>, number> = { demo: 8.4, journey: 6.5, replay: 9 }
const ZOOM_LIMIT: Record<CameraMode, number> = { demo: 14, journey: 14, replay: 30, map: 160 }
// How closely the orbit target trails the comet (smoothing time, seconds). Replays
// travel faster than live voyages, so the camera keeps up more tightly.
const FOLLOW: Record<CameraMode, number> = { demo: 1.4, journey: 0.6, replay: 0.12, map: 0.8 }
const MAP_MIN_DISTANCE = 16
// How long the camera eases towards a mode's framing distance after the mode changes.
const FRAMING_SECONDS = 3
const IDLE_RESUME_SECONDS = 4
const ORIGIN = new THREE.Vector3()

type Controls = React.ComponentRef<typeof OrbitControls>

function framingDistance(mode: CameraMode, frame: THREE.Sphere | undefined): number {
  if (mode !== 'map') return DISTANCE[mode]
  // Fit the journey's bounding sphere in view, with some margin.
  const halfFov = THREE.MathUtils.degToRad(BASE_FOV / 2)
  const fit = ((frame?.radius ?? 0) / Math.sin(halfFov)) * 1.25
  return Math.min(Math.max(fit, MAP_MIN_DISTANCE), ZOOM_LIMIT.map - 10)
}

interface Props {
  mode: CameraMode
  head: RefObject<THREE.Group | null>
  /** Start far out in space and glide in. */
  flyIn?: boolean
  /** Bounding sphere of the journey, framed in map mode. */
  mapFrame?: THREE.Sphere
}

const FLY_IN_SCALE = 5
const FLY_IN_SECONDS = 6
const BASE_FOV = 50
// Extra field of view at full speed, for a sense of acceleration.
const WARP_FOV = 14

export function CameraRig({ mode, head, flyIn = false, mapFrame }: Props) {
  const controls = useRef<Controls>(null)
  // endedAt is null until the frame loop stamps it with the clock's time.
  const interaction = useRef<{ active: boolean; endedAt: number | null }>({ active: false, endedAt: -Infinity })
  const framing = useRef<{ mode: CameraMode | null; until: number }>({ mode: null, until: 0 })
  const reducedMotion = useReducedMotion()
  const tmp = useMemo(() => ({ goal: new THREE.Vector3(), before: new THREE.Vector3(), offset: new THREE.Vector3() }), [])
  const motion = useRef({ last: new THREE.Vector3(), speed: 0, started: false })

  useFrame(({ camera, clock }, delta) => {
    const c = controls.current
    if (!c) return
    const now = clock.getElapsedTime()
    if (interaction.current.endedAt === null) interaction.current.endedAt = now
    const { active, endedAt } = interaction.current

    // A new mode re-frames the shot. On first mount, either keep the initial
    // view or, for a fly-in, start far out and glide to the mode's distance.
    if (framing.current.mode !== mode) {
      const first = framing.current.mode === null
      if (first && flyIn && !reducedMotion) camera.position.multiplyScalar(FLY_IN_SCALE)
      framing.current = { mode, until: first ? (flyIn ? now + FLY_IN_SECONDS : 0) : now + FRAMING_SECONDS }
    }

    // Follow: move the orbit target to the comet and carry the camera along by
    // the same amount, so the user's chosen angle and zoom are kept.
    const { goal, before, offset } = tmp
    if (mode !== 'demo' && head.current) goal.copy(head.current.position)
    else goal.copy(ORIGIN)
    before.copy(c.target)
    easing.damp3(c.target, goal, FOLLOW[mode], delta)
    camera.position.add(offset.subVectors(c.target, before))

    // Ease to the mode's framing distance, unless the user takes over.
    if (now < framing.current.until && !active && !reducedMotion) {
      offset.subVectors(camera.position, c.target)
      const length = { v: offset.length() }
      easing.damp(length, 'v', framingDistance(mode, mapFrame), 1.2, delta)
      camera.position.copy(c.target).addScaledVector(offset.normalize(), length.v)
    }

    // Zoom limit for the mode, but never below the current distance, so mode
    // changes and the fly-in glide in rather than snapping.
    c.maxDistance = Math.max(ZOOM_LIMIT[mode], camera.position.distanceTo(c.target) + 0.01)

    // Widen the view slightly while the comet is travelling fast.
    const m = motion.current
    if (head.current && delta > 0) {
      if (!m.started) {
        m.last.copy(head.current.position)
        m.started = true
      }
      const speed = head.current.position.distanceTo(m.last) / delta
      m.last.copy(head.current.position)
      easing.damp(m, 'speed', speed, 0.4, delta)
    }
    const perspective = camera as THREE.PerspectiveCamera
    const fov = (mode === 'journey' || mode === 'replay') && !reducedMotion ? BASE_FOV + WARP_FOV * THREE.MathUtils.smoothstep(m.speed, 0.5, 8) : BASE_FOV
    if (Math.abs(perspective.fov - fov) > 0.01) {
      easing.damp(perspective, 'fov', fov, 0.5, delta)
      perspective.updateProjectionMatrix()
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
      maxDistance={ZOOM_LIMIT.demo}
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
