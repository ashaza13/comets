import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr } from '@react-three/drei'
import { Bloom, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { CameraRig, type CameraMode } from './CameraRig'
import { Comet, type CometHandle } from './Comet'
import { Constellations } from './Constellations'
import { FinalMarker } from './FinalMarker'
import { FriendStars } from './FriendStars'
import { Flare } from './Flare'
import { MemoryStars } from './MemoryStars'
import { Nebula } from './Nebula'
import { ResultCard } from './ResultCard'
import { SpaceDust } from './SpaceDust'
import { Starfield } from './Starfield'
import { Tail } from './Tail'
import { Timeline } from './Timeline'
import { useConstellation } from '../groupStore'
import { emotionColor } from '../lib/emotionColor'
import { journeyBounds, toWorld } from '../lib/tail'
import { createNanGuardPass } from '../lib/nanGuard'
import { easeReplay, historyAt, journeyPath, playheadToT, tToPlayhead } from '../lib/playback'
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

// Replay speed in world units per second along the journey curve, within limits.
const REPLAY_UNITS_PER_SECOND = 9
const REPLAY_MIN_SECONDS = 4
const REPLAY_MAX_SECONDS = 10

export function Scene({ entries, debugState, isLoading, chartMode, revealed, showControls, flyIn }: Props) {
  const comet = useRef<CometHandle>(null)
  // Stable refs into the comet handle for parts that read it every frame.
  const head = useMemo(() => ({ get current() { return comet.current?.group ?? null } }), [])
  const look = useMemo(() => ({ get current() { return comet.current?.look ?? null } }), [])
  const nanGuard = useMemo(() => createNanGuardPass(), [])

  const fullHistory = useMemo(() => entries.map((e) => e.state), [entries])
  const total = entries.length
  // Friends from a constellation you joined, or are invited to, appear on the map.
  const members = useConstellation((s) => s.members)
  const selfId = useConstellation((s) => s.membership?.memberId ?? null)
  const friends = useMemo(() => members.filter((m) => m.id !== selfId), [members, selfId])
  // Seeded by each answer's id, so the journey's detours are the same on every replay.
  const path = useMemo(() => journeyPath(fullHistory, entries.map((e) => e.id)), [fullHistory, entries])
  const mapFrame = useMemo(
    () => journeyBounds(fullHistory, friends.map((f) => f.personality), path?.points),
    [fullHistory, friends, path],
  )
  // How far along the path the comet is: written by the comet, read by the tail.
  const progress = useMemo(() => ({ t: 0 }), [])
  const finalState = fullHistory.at(-1)
  const finalPosition = useMemo(() => (finalState ? toWorld(finalState.personality) : null), [finalState])

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

  // Replays travel the journey curve at a steady speed (by arc length), so the
  // comet doesn't speed up or slow down as it passes each answer.
  useEffect(() => {
    if (!replay) return
    if (!path) {
      // Nothing to travel along: end the replay straight away.
      const id = requestAnimationFrame(() => {
        setPlayhead(null)
        setReplay(null)
      })
      return () => cancelAnimationFrame(id)
    }
    const { curve } = path
    const duration = Math.min(Math.max(curve.getLength() / REPLAY_UNITS_PER_SECOND, REPLAY_MIN_SECONDS), REPLAY_MAX_SECONDS)
    let frame = 0
    let startedAt: number | null = null
    const tick = (now: number) => {
      startedAt ??= now
      const progress = (now - startedAt) / 1000 / duration
      if (progress >= 1) {
        setPlayhead(null)
        setReplay(null)
        return
      }
      setPlayhead(tToPlayhead(path, curve.getUtoTmapping(easeReplay(progress), 0)))
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [replay, path])

  const history = useMemo(() => (debugState ? [] : historyAt(fullHistory, playhead)), [debugState, fullHistory, playhead])
  const replaying = playhead !== null
  // While replaying or scrubbing, the comet sits exactly on the journey curve.
  const replayT = replaying && path ? playheadToT(path, playhead) : null
  const state = debugState ?? history.at(-1) ?? (replaying ? INITIAL_STATE : null)
  const demo = state === null
  // The axes appear once the reveal replay has finished; later scrubbing keeps them.
  const mapShown = revealed && !replay?.reveal
  // ?debug tunes the comet up close, so it follows the comet even though the map is shown.
  // Replays ride along with the comet; afterwards the camera pulls back to show the map.
  const cameraMode: CameraMode = debugState ? 'journey' : replay ? 'replay' : revealed ? 'map' : demo ? 'demo' : 'journey'
  const tint = useMemo(() => moodTint(history, state), [history, state])

  // The result is marked once the map is shown and the comet is back at its final place.
  const showResult = mapShown && !debugState && total > 0

  const startReplay = () => {
    setReplay({ from: 0, reveal: false })
    setPlayhead(0)
  }

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
        <Tail history={history} head={head} look={look} path={debugState ? null : path} progress={progress} />
        <FriendStars friends={friends} visible={mapShown && !debugState} />
        <MemoryStars entries={memories} total={total} interactive={mapShown} onHoverChange={setMemoryOpen} />
        <Comet
          ref={comet}
          state={state}
          history={history}
          isLoading={isLoading}
          demo={demo}
          path={debugState ? null : path}
          replayT={replayT}
          progress={progress}
          hideTooltip={memoryOpen && mapShown}
          exact={chartMode && mapShown}
        />
        <Flare count={total} head={head} look={look} />
        {finalPosition && <FinalMarker position={finalPosition} shown={showResult && playhead === null} />}

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
          onPlay={startReplay}
        />
      )}

      {showControls && showResult && !replay && finalState && (
        <ResultCard state={finalState} exact={chartMode} onReplay={startReplay} />
      )}
    </>
  )
}
