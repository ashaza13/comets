import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { AdaptiveDpr, OrbitControls } from '@react-three/drei'
import { Bloom, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { easing } from 'maath'
import * as THREE from 'three'
import { Comet, type CometHandle } from './Comet'
import { Constellations } from './Constellations'
import { Dust } from './Dust'
import { Nebula } from './Nebula'
import { Starfield } from './Starfield'
import { Tail } from './Tail'
import { emotionColor } from '../lib/color'
import type { CometState } from '../lib/schema'
import { useReducedMotion } from '../hooks/useReducedMotion'

const NEUTRAL_TINT = new THREE.Color(0.35, 0.3, 0.6)
const IDLE_RESUME_SECONDS = 4

interface Props {
  state: CometState | null
  history: CometState[]
  isLoading: boolean
  demo: boolean
  chartMode: boolean
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

type Controls = React.ComponentRef<typeof OrbitControls>

// Slow orbit that eases out while the user drags and back in after they let go.
function IdleOrbit({ demo }: { demo: boolean }) {
  const controls = useRef<Controls>(null)
  // endedAt is null until the frame loop stamps it with the clock's time.
  const interaction = useRef<{ active: boolean; endedAt: number | null }>({ active: false, endedAt: -Infinity })
  const reducedMotion = useReducedMotion()

  useFrame(({ clock }, delta) => {
    const c = controls.current
    if (!c) return
    const now = clock.getElapsedTime()
    if (interaction.current.endedAt === null) interaction.current.endedAt = now
    const { active, endedAt } = interaction.current
    const idle = !active && now - endedAt > IDLE_RESUME_SECONDS
    const target = reducedMotion || !idle ? 0 : demo ? 0.5 : 0.2
    easing.damp(c, 'autoRotateSpeed', target, 1.5, delta)
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
      }}
      onEnd={() => {
        interaction.current = { active: false, endedAt: null }
      }}
    />
  )
}

export function Scene({ state, history, isLoading, demo, chartMode }: Props) {
  const comet = useRef<CometHandle>(null)
  // Stable refs into the comet handle for the tail, which reads them every frame.
  const head = useMemo(() => ({ get current() { return comet.current?.group ?? null } }), [])
  const look = useMemo(() => ({ get current() { return comet.current?.look ?? null } }), [])
  const tint = useMemo(() => moodTint(history, state), [history, state])

  return (
    <Canvas camera={{ position: [4.6, 2.4, 6.4], fov: 50 }} gl={{ antialias: true }} style={{ background: '#04040a' }}>
      <AdaptiveDpr pixelated={false} />
      <Nebula tint={tint} />
      <Starfield />
      <Dust />
      <Constellations chartMode={chartMode} />
      <Tail history={history} head={head} look={look} />
      <Comet ref={comet} state={state} history={history} isLoading={isLoading} demo={demo} />

      <IdleOrbit demo={demo} />

      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={1.1} luminanceThreshold={0.2} luminanceSmoothing={0.3} />
        <Vignette offset={0.3} darkness={0.75} />
        <Noise opacity={0.025} />
        <ToneMapping mode={ToneMappingMode.AGX} />
      </EffectComposer>
    </Canvas>
  )
}
