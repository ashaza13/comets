import { useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr, OrbitControls } from '@react-three/drei'
import { Bloom, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { Comet, type CometHandle } from './Comet'
import { Sky } from './Sky'
import { Tail } from './Tail'
import type { CometState } from '../lib/schema'

interface Props {
  state: CometState | null
  history: CometState[]
  isLoading: boolean
  demo: boolean
}

export function Scene({ state, history, isLoading, demo }: Props) {
  const comet = useRef<CometHandle>(null)
  // Stable refs into the comet handle for the tail, which reads them every frame.
  const head = useMemo(() => ({ get current() { return comet.current?.group ?? null } }), [])
  const headColor = useMemo(() => ({ get current() { return comet.current?.color ?? new THREE.Color() } }), [])

  return (
    <Canvas camera={{ position: [4.6, 2.4, 6.4], fov: 50 }} gl={{ antialias: true }} style={{ background: '#07070d' }}>
      <AdaptiveDpr pixelated={false} />
      <Sky />
      <Tail history={history} head={head} headColor={headColor} />
      <Comet ref={comet} state={state} isLoading={isLoading} demo={demo} />

      <OrbitControls enablePan={false} minDistance={3} maxDistance={14} autoRotate={demo} autoRotateSpeed={0.6} />

      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={1.1} luminanceThreshold={0.2} luminanceSmoothing={0.3} />
        <Vignette offset={0.3} darkness={0.75} />
        <Noise opacity={0.025} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </Canvas>
  )
}
