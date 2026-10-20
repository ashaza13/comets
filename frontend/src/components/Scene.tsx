import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr } from '@react-three/drei'
import { Bloom, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { CameraRig, type CameraMode } from './CameraRig'
import { Comet, type CometHandle } from './Comet'
import { Constellations } from './Constellations'
import { Flare } from './Flare'
import { MemoryStars } from './MemoryStars'
import { Nebula } from './Nebula'
import { SpaceDust } from './SpaceDust'
import { Starfield } from './Starfield'
import { Tail } from './Tail'
import { Timeline } from './Timeline'
import { emotionColor } from '../lib/color'
import { journeyBounds } from '../lib/tail'
import { createNanGuardPass } from '../lib/nanGuard'
import { historyAt } from '../lib/playback'
import { INITIAL_STATE, type CometState, type Entry } from '../lib/schema'

const NEUTRAL_TINT = new THREE.Color(0.35, 0.3, 0.6)

// The nebula is tinted by the average of every mood observed so far.
function moodTint(history: CometState[], state: CometState | null): THREE.Color {
  const moods = history.length > 0 ? history : state ? [state] : []
  if (moods.length === 0) return NEUTRAL_TINT.clone()
  const sum = new THREE.Color(0, 0, 0)
  const c = new THREE.Color()
  for (const s of moods) sum.add(emotionColor(s.emotion, c))
  return sum.multiplyScalar(1 / moods.length)
}

interface Props {
  entries: Entry[]
  /** Manual state from the ?debug panel; replaces the journey when set. */
  debugState: CometState | null
  isLoading: boolean
  chartMode: boolean
  /** Every question has been answered, so the map can be shown. */
  revealed: boolean
  /** Show the timeline scrubber (hidden behind the intro overlay). */
  showControls: boolean
  /** Start far out in space and glide in (first visit). */
  flyIn: boolean
}

// Answers per second while replaying the journey.
const REPLAY_SPEED = 1.2

export function Scene({ entries, debugState, isLoading, chartMode, revealed, showControls, flyIn }: Props) {
  const comet = useRef<CometHandle>(null)
  // Stable refs into the comet handle for parts that read it every frame.
  const head = useMemo(() => ({ get current() { return comet.current?.group ?? null } }), [])
  const look = useMemo(() => ({ get current() { return comet.current?.look ?? null } }), [])
  const nanGuard = useMemo(() => createNanGuardPass(), [])

  const fullHistory = useMemo(() => entries.map((e) => e.state), [entries])
  const total = entries.length
  const mapFrame = useMemo(() => journeyBounds(fullHistory), [fullHistory])

  // Playhead over the journey: null is live; a number replays up to that point.
  const [playhead, setPlayhead] = useState<number | null>(null)
  const [memoryOpen, setMemoryOpen] = useState(false)
  // A new object restarts the replay; its clock starts on the first animation frame.
  // `reveal` marks the replay that plays when the map is first revealed.
  const [replay, setReplay] = useState<{ from: number; reveal: boolean } | null>(null)

  // When the map is first revealed, replay the whole journey (adjusting state
  // during render, React's recommended alternative to an effect here).
  const [wasRevealed, setWasRevealed] = useState(revealed)
  if (revealed !== wasRevealed) {
    setWasRevealed(revealed)
    if (revealed && total > 0) {
      setReplay({ from: 0, reveal: true })
      setPlayhead(0)
    }
  }

  useEffect(() => {
    if (!replay) return
    let frame = 0
    let startedAt: number | null = null
    const tick = (now: number) => {
      startedAt ??= now
      const next = replay.from + ((now - startedAt) / 1000) * REPLAY_SPEED
      if (next >= total) {
        setPlayhead(null)
        setReplay(null)
        return
      }
      setPlayhead(next)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [replay, total])

  const history = useMemo(() => (debugState ? [] : historyAt(fullHistory, playhead)), [debugState, fullHistory, playhead])
  const replaying = playhead !== null
  const state = debugState ?? history.at(-1) ?? (replaying ? INITIAL_STATE : null)
  const demo = state === null
  // The axes appear once the reveal replay has finished; later scrubbing keeps them.
  const mapShown = revealed && !replay?.reveal
  // ?debug tunes the comet up close, so it follows the comet even though the map is shown.
  const cameraMode: CameraMode = debugState ? 'journey' : revealed ? 'map' : demo ? 'demo' : 'journey'
  const tint = useMemo(() => moodTint(history, state), [history, state])

  // Memory stars for answers already passed; the live comet itself marks the latest.
  const passed = playhead === null ? Math.max(total - 1, 0) : Math.floor(playhead)
  const memories = useMemo(() => (debugState ? [] : entries.slice(0, passed)), [debugState, entries, passed])

  return (
    <>
      <Canvas camera={{ position: [4.6, 2.4, 6.4], fov: 50, far: 2000 }} gl={{ antialias: true }} style={{ background: '#04040a' }}>
        <AdaptiveDpr pixelated={false} />
        <Nebula tint={tint} />
        <Starfield />
        <SpaceDust />
        <Constellations chartMode={chartMode} revealed={mapShown} />
        <Tail history={history} head={head} look={look} />
        <MemoryStars entries={memories} total={total} interactive={mapShown} onHoverChange={setMemoryOpen} />
        <Comet
          ref={comet}
          state={state}
          history={history}
          isLoading={isLoading}
          demo={demo}
          glide={replaying ? 0.3 : 1.4}
          hideTooltip={memoryOpen && mapShown}
        />
        <Flare count={total} head={head} look={look} />

        <CameraRig mode={cameraMode} head={head} flyIn={flyIn} mapFrame={mapFrame} />

        <EffectComposer multisampling={4}>
          {/* Must run before bloom, which would otherwise smear one bad pixel over the frame. */}
          <primitive object={nanGuard} />
          <Bloom mipmapBlur intensity={1.1} luminanceThreshold={0.2} luminanceSmoothing={0.3} />
          <Vignette offset={0.3} darkness={0.75} />
          <Noise opacity={0.025} />
          <ToneMapping mode={ToneMappingMode.AGX} />
        </EffectComposer>
      </Canvas>

      {showControls && revealed && total > 0 && !debugState && (
        <Timeline
          total={total}
          playhead={playhead}
          playing={replay !== null}
          onScrub={(value) => {
            setReplay(null)
            setPlayhead(value >= total ? null : value)
          }}
          onPlay={() => {
            setReplay({ from: 0, reveal: false })
            setPlayhead(0)
          }}
        />
      )}
    </>
  )
}
