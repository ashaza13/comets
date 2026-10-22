import { useMemo, useRef, type RefObject } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { easing } from 'maath'
import * as THREE from 'three'
import type { Warp } from '../lib/warp'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { clearCentre, freeAreaCentre } from '../lib/framing'

/**
 * - demo: no answers yet; the camera keeps the wandering comet centred.
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
const FOLLOW: Record<CameraMode, number> = { demo: 0.6, journey: 0.6, replay: 0.12, map: 0.8 }
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
  /** Hyperspace jumps widen the view sharply. */
  warp?: Warp
}

// Overlays that cover part of the canvas; the comet is framed in the space they leave.
const OVERLAYS = ['.journey', '.result']
const FOCUS_CHECK_SECONDS = 0.25
// While answering, the comet's glow keeps at least this far (px) from a panel.
const COMET_CLEARANCE = 56

const FLY_IN_SCALE = 5
const FLY_IN_SECONDS = 6
const BASE_FOV = 50
// Extra field of view at full speed, for a sense of acceleration.
const WARP_FOV = 14
// Extra field of view at full hyperspace: the lurch of the jump.
const JUMP_FOV = 26

export function CameraRig({ mode, head, flyIn = false, mapFrame, warp }: Props) {
  const controls = useRef<Controls>(null)
  // endedAt is null until the frame loop stamps it with the clock's time.
  const interaction = useRef<{ active: boolean; endedAt: number | null }>({ active: false, endedAt: -Infinity })
  const framing = useRef<{ mode: CameraMode | null; until: number; radius: number }>({ mode: null, until: 0, radius: 0 })
  const reducedMotion = useReducedMotion()
  const tmp = useMemo(() => ({ goal: new THREE.Vector3(), before: new THREE.Vector3(), offset: new THREE.Vector3() }), [])
  const motion = useRef({ last: new THREE.Vector3(), speed: 0, started: false })
  const focus = useRef({ x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5, checkedAt: -Infinity })

  useFrame(({ camera, clock, gl, size }, delta) => {
    const c = controls.current
    if (!c) return
    const now = clock.getElapsedTime()
    if (interaction.current.endedAt === null) interaction.current.endedAt = now
    const { active, endedAt } = interaction.current

    // A new mode re-frames the shot. On first mount, either keep the initial
    // view or, for a fly-in, start far out and glide to the mode's distance.
    // A returning visitor who lands straight on the map glides out to frame it too.
    const radius = mapFrame?.radius ?? 0
    if (framing.current.mode !== mode) {
      const first = framing.current.mode === null
      if (first && flyIn && !reducedMotion) camera.position.multiplyScalar(FLY_IN_SCALE)
      const until = first ? (flyIn ? now + FLY_IN_SECONDS : mode === 'map' ? now + FRAMING_SECONDS : 0) : now + FRAMING_SECONDS
      framing.current = { mode, until, radius }
    } else if (mode === 'map' && Math.abs(radius - framing.current.radius) > framing.current.radius * 0.05 + 0.5) {
      // The map grew or shrank (e.g. a friend joined far away): re-frame it,
      // unless the user is in the middle of moving the camera.
      framing.current.radius = radius
      if (!active) framing.current.until = now + FRAMING_SECONDS
    }

    // Follow: move the orbit target to the comet and carry the camera along by
    // the same amount, so the user's chosen angle and zoom are kept.
    const { goal, before, offset } = tmp
    if (head.current) goal.copy(head.current.position)
    else goal.copy(ORIGIN)
    before.copy(c.target)
    // In hyperspace the camera locks onto the comet, keeping it at the tunnel's heart.
    const follow = THREE.MathUtils.lerp(FOLLOW[mode], 0.08, mode === 'journey' ? (warp?.level ?? 0) : 0)
    easing.damp3(c.target, goal, follow, delta)
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
    const moving = (mode === 'journey' || mode === 'replay') && !reducedMotion
    const fov = moving ? BASE_FOV + WARP_FOV * THREE.MathUtils.smoothstep(m.speed, 0.5, 8) + JUMP_FOV * (warp?.level ?? 0) : BASE_FOV
    if (Math.abs(perspective.fov - fov) > 0.01) {
      easing.damp(perspective, 'fov', fov, 0.5, delta)
      perspective.updateProjectionMatrix()
    }

    // Shift the view so the comet sits in the space the panels leave free,
    // rather than behind them. Checked a few times a second, eased between.
    const f = focus.current
    if (now - f.checkedAt > FOCUS_CHECK_SECONDS) {
      f.checkedAt = now
      const overlays = OVERLAYS.flatMap((s) => [...document.querySelectorAll(s)].map((el) => el.getBoundingClientRect()))
      const canvas = gl.domElement.getBoundingClientRect()
      // Answering: the comet stays mid-screen, nudged only clear of the panel.
      // The map: centred in the space beside or below the result card.
      const centre =
        mode === 'journey' || mode === 'demo' ? clearCentre(canvas, overlays, COMET_CLEARANCE) : freeAreaCentre(canvas, overlays)
      f.targetX = centre.x
      f.targetY = centre.y
    }
    easing.damp(f, 'x', f.targetX, 0.5, delta)
    easing.damp(f, 'y', f.targetY, 0.5, delta)
    const offsetX = (0.5 - f.x) * size.width
    const offsetY = (0.5 - f.y) * size.height
    if (Math.abs(offsetX) > 0.5 || Math.abs(offsetY) > 0.5) {
      perspective.setViewOffset(size.width, size.height, offsetX, offsetY, size.width, size.height)
    } else if (perspective.view?.enabled) {
      perspective.clearViewOffset()
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
