import { useEffect, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { easing } from 'maath'
import * as THREE from 'three'
import { triggerJump, updateWarp, type Warp } from '../lib/warp'
import { useReducedMotion } from '../hooks/useReducedMotion'

interface Props {
  warp: Warp
  /** Control points on the journey so far; a jump fires each time it grows. */
  legs: number
  /** Jumps only happen while answering (not in replays or on the map). */
  active: boolean
  head: RefObject<THREE.Group | null>
}

// While the comet is still flying fast after the jump, keep some warp on.
const CRUISE_WARP = 0.55

/** Fires a hyperspace jump whenever an answer sends the comet somewhere new. */
export function WarpDrive({ warp, legs, active, head }: Props) {
  const reducedMotion = useReducedMotion()
  // Seen count starts at the mounted value so reloading a saved journey doesn't jump.
  const seen = useRef(legs)
  const motion = useRef({ last: new THREE.Vector3(), speed: 0, started: false })

  useFrame(({ clock }, delta) => {
    const now = clock.getElapsedTime()
    if (legs > seen.current && active) triggerJump(warp, now)
    seen.current = legs

    const m = motion.current
    if (head.current && delta > 0) {
      if (!m.started) {
        m.last.copy(head.current.position)
        m.started = true
      }
      easing.damp(m, 'speed', head.current.position.distanceTo(m.last) / delta, 0.3, delta)
      m.last.copy(head.current.position)
    }
    const cruising = active ? CRUISE_WARP * THREE.MathUtils.smoothstep(m.speed, 2, 9) : 0
    updateWarp(warp, now, delta, cruising, reducedMotion)
  })

  return null
}

/** The jump's flash: a full-screen glow over the canvas, following the warp. */
export function WarpFlash({ warp }: { warp: Warp }) {
  const el = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let frame = 0
    const tick = () => {
      if (el.current) el.current.style.opacity = String(warp.flash * 0.55)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [warp])
  return <div ref={el} className="warp-flash" aria-hidden />
}
