import { useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr } from '@react-three/drei'
import { Bloom, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { CameraRig, type CameraMode } from './CameraRig'
import { Comet, type CometHandle } from './Comet'
import { Constellations } from './Constellations'
import { Dust } from './Dust'
import { Nebula } from './Nebula'
import { Starfield } from './Starfield'
import { Tail } from './Tail'
import { emotionColor } from '../lib/color'
import { createNanGuardPass } from '../lib/nanGuard'
import type { CometState } from '../lib/schema'

const NEUTRAL_TINT = new THREE.Color(0.35, 0.3, 0.6)

interface Props {
  state: CometState | null
  history: CometState[]
  isLoading: boolean
  demo: boolean
  chartMode: boolean
  /** Whether the map (axes and labels) has been revealed. */
  revealed: boolean
}

// The nebula is tinted by the average of every mood observed so far.
function moodTint(history: CometState[], state: CometState | null): THREE.Color {
  const moods = history.length > 0 ? history : state ? [state] : []
  if (moods.length === 0) return NEUTRAL_TINT.clone()
  const sum = new THREE.Color(0, 0, 0)
  const c = new THREE.Color()
  for (const s of moods) sum.add(emotionColor(s.emotion, c))
  return sum.multiplyScalar(1 / moods.length)
}

export function Scene({ state, history, isLoading, demo, chartMode, revealed }: Props) {
  const comet = useRef<CometHandle>(null)
  // Stable refs into the comet handle for the tail, which reads them every frame.
  const head = useMemo(() => ({ get current() { return comet.current?.group ?? null } }), [])
  const look = useMemo(() => ({ get current() { return comet.current?.look ?? null } }), [])
  const tint = useMemo(() => moodTint(history, state), [history, state])
  const nanGuard = useMemo(() => createNanGuardPass(), [])
  const cameraMode: CameraMode = revealed ? 'map' : demo ? 'demo' : 'journey'

  return (
    <Canvas camera={{ position: [4.6, 2.4, 6.4], fov: 50 }} gl={{ antialias: true }} style={{ background: '#04040a' }}>
      <AdaptiveDpr pixelated={false} />
      <Nebula tint={tint} />
      <Starfield />
      <Dust />
      <Constellations chartMode={chartMode} revealed={revealed} />
      <Tail history={history} head={head} look={look} />
      <Comet ref={comet} state={state} history={history} isLoading={isLoading} demo={demo} />

      <CameraRig mode={cameraMode} head={head} />

      <EffectComposer multisampling={4}>
        {/* Must run before bloom, which would otherwise smear one bad pixel over the frame. */}
        <primitive object={nanGuard} />
        <Bloom mipmapBlur intensity={1.1} luminanceThreshold={0.2} luminanceSmoothing={0.3} />
        <Vignette offset={0.3} darkness={0.75} />
        <Noise opacity={0.025} />
        <ToneMapping mode={ToneMappingMode.AGX} />
      </EffectComposer>
    </Canvas>
  )
}
