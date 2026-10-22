import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { easing } from 'maath'
import * as THREE from 'three'
import { Coma } from './comet/Coma'
import { IonTail } from './comet/IonTail'
import { Jets } from './comet/Jets'
import { Nucleus } from './comet/Nucleus'
import { emotionCss, energyGlow } from '../lib/color'
import { emotionColor } from '../lib/emotionColor'
import { certaintyNote, describeAxis, describeDepth, describeEmotion } from '../lib/describe'
import { createLook, headingFrom, springStep, type CometLook } from '../lib/comet'
import type { CometState } from '../lib/schema'
import { AXES, domainColor } from '../lib/spec'
import { meanUncertainty, toWorld } from '../lib/tail'

const NO_INTERESTS: Record<string, number> = {}

// Voyages between answers: a spring that takes about three seconds to settle,
// with a cruising-speed limit so long jumps don't streak across the sky.
const VOYAGE_SMOOTH_TIME = 0.9
const VOYAGE_MAX_SPEED = 14
// When a replay or scrub moves the comet somewhere new, it glides there this fast.
const CATCH_UP_SMOOTH_TIME = 0.18
// A pinned position that moves further than this in one frame is a jump to glide over.
const PIN_JUMP = 1

interface Props {
  state: CometState | null
  /** Observations so far, oldest first; drives the heading. */
  history: CometState[]
  isLoading: boolean
  demo: boolean
  /** Exact position to hold (replays and scrubbing); otherwise the comet voyages to its state. */
  position?: THREE.Vector3
  /** Hide the hover tooltip (e.g. while a memory card is open). */
  hideTooltip?: boolean
  /** Show exact numbers in the tooltip (chart mode) instead of plain language. */
  exact?: boolean
}

export interface CometHandle {
  group: THREE.Group | null
  look: CometLook
}

export const Comet = forwardRef<CometHandle, Props>(function Comet({ state, history, isLoading, demo, position, hideTooltip = false, exact = false }, ref) {
  const [hovered, setHovered] = useState(false)
  const group = useRef<THREE.Group>(null)
  const look = useRef(createLook())

  const targetColor = useMemo(() => new THREE.Color(), [])
  const targetPos = useMemo(() => new THREE.Vector3(), [])
  const previous = useMemo(() => new THREE.Vector3(), [])
  const targetHeading = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  // Spring velocity, and whether the comet is pinned to (or gliding onto) a replay position.
  const motion = useRef({ velocity: new THREE.Vector3(), pinned: false, catching: false, lastPin: new THREE.Vector3() })
  const historyHeading = useMemo(() => headingFrom(history), [history])

  useImperativeHandle(ref, () => ({
    get group() {
      return group.current
    },
    look: look.current,
  }))

  useFrame(({ clock }, delta) => {
    const g = group.current
    if (!g) return
    const l = look.current
    const t = clock.getElapsedTime()
    previous.copy(g.position)
    const m = motion.current
    let sprung = false

    if (demo || !state) {
      targetPos.set(Math.cos(t * 0.28) * 1.6, Math.sin(t * 0.17) * 1.0, Math.sin(t * 0.41) * 1.3)
      targetColor.setHSL((t * 0.055) % 1, 0.75, 0.65)
      easing.damp3(g.position, targetPos, 1.2, delta)
      easing.damp(l, 'energy', 1, 0.5, delta)
      easing.damp(l, 'spread', 0.6, 0.5, delta)
    } else {
      toWorld(state.personality, targetPos)
      emotionColor(state.emotion, targetColor)
      if (position) {
        // Replays and scrubbing: sit exactly on the journey curve, gliding
        // onto it first when the replay starts or the playhead jumps.
        if (!m.pinned || position.distanceTo(m.lastPin) > PIN_JUMP) m.catching = true
        m.pinned = true
        m.lastPin.copy(position)
        if (m.catching) {
          springStep(g.position, m.velocity, position, CATCH_UP_SMOOTH_TIME, delta)
          sprung = true
          if (g.position.distanceTo(position) < 0.02) m.catching = false
        } else {
          g.position.copy(position)
        }
      } else {
        // Each answer redirects the voyage. The velocity carries over, so a
        // quick run of answers curves the comet onwards rather than stopping
        // it dead and restarting at each one.
        m.pinned = false
        m.catching = false
        springStep(g.position, m.velocity, targetPos, VOYAGE_SMOOTH_TIME, delta, VOYAGE_MAX_SPEED)
        sprung = true
      }
      easing.damp(l, 'energy', energyGlow(state.emotion.lightness), 0.6, delta)
      easing.damp(l, 'spread', meanUncertainty(state.uncertainty), 0.6, delta)
    }
    easing.dampC(l.color, targetColor, 0.5, delta)

    if (delta > 0) l.velocity.subVectors(g.position, previous).divideScalar(delta)
    // Keep the spring's velocity in step with motion it didn't drive, so the
    // hand-over from demo wandering or a replay is seamless.
    if (!sprung) m.velocity.copy(l.velocity)
    // Heading: the last move between observations, or the live motion in demo mode.
    // While replaying, the heading follows the curve's direction instead.
    if (historyHeading && !demo && !position) targetHeading.copy(historyHeading)
    else if (l.velocity.lengthSq() > 1e-4) targetHeading.copy(l.velocity).normalize()
    easing.damp3(l.heading, targetHeading, 0.4, delta)
    if (l.heading.lengthSq() > 1e-8) l.heading.normalize()

    l.pulse = isLoading ? 0.75 + 0.25 * Math.sin(t * 5) : 1
  })

  const interests = demo || !state ? NO_INTERESTS : state.interests
  const topInterests = Object.entries(interests)
    .filter(([, d]) => d > 0.05)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  return (
    <group ref={group} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
      {/* Invisible hit area so hover is easy to trigger; small enough not to cover nearby memory stars */}
      <mesh visible={false}>
        <sphereGeometry args={[0.3, 8, 4]} />
      </mesh>

      <IonTail look={look.current} />
      <Jets look={look.current} interests={interests} />
      <Coma look={look.current} />
      <Nucleus look={look.current} />

      {hovered && !hideTooltip && state && !demo && (
        <Html position={[0.6, 0.6, 0]} zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
          <div className="nucleus-tooltip">
            <div className="nt-section">
              <div className="nt-label">position</div>
              {AXES.map((a) => {
                const v = state.personality[a.key]
                return (
                  <div key={a.key} className="nt-row">
                    {exact ? (
                      <>
                        <span className="axis-reading">{v >= 0 ? a.positive : a.negative}</span>
                        <span>
                          {Math.abs(v).toFixed(2)}
                          <span className="dim"> ±{Math.sqrt(state.uncertainty[a.key]).toFixed(2)}</span>
                        </span>
                      </>
                    ) : (
                      <span className="axis-reading">{certaintyNote(state.uncertainty[a.key]) === 'no read yet' ? '—' : describeAxis(a, v)}</span>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="nt-divider" />

            <div className="nt-section">
              <div className="nt-label">feeling</div>
              <div className="nt-row">
                <div className="nt-swatch" style={{ background: emotionCss(state.emotion) }} />
                <span style={{ color: emotionCss(state.emotion) }}>
                  {exact
                    ? `${state.emotion.hue.toFixed(0)}° · ${(state.emotion.saturation * 100).toFixed(0)}% · energy ${(state.emotion.lightness * 100).toFixed(0)}%`
                    : describeEmotion(state.emotion)}
                </span>
              </div>
            </div>

            {topInterests.length > 0 && (
              <>
                <div className="nt-divider" />
                <div className="nt-section">
                  <div className="nt-label">loves</div>
                  {topInterests.map(([domain, depth]) => (
                    <div key={domain} className="nt-row">
                      <span style={{ color: domainColor(domain), minWidth: 80 }}>{domain}</span>
                      <div className="nt-bar">
                        <div className="nt-bar-fill" style={{ width: `${depth * 100}%`, background: domainColor(domain) }} />
                      </div>
                      <span className="dim">{exact ? depth.toFixed(2) : describeDepth(depth)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Html>
      )}
    </group>
  )
})
