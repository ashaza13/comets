import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import fragmentShader from '../shaders/dust.frag'
import vertexShader from '../shaders/dust.vert'
import { mulberry32 } from '../lib/sky'
import { useReducedMotion } from '../hooks/useReducedMotion'

interface LayerProps {
  count: number
  extent: [number, number, number]
  size: number
  color: string
  opacity: number
  seed: number
}

function DustLayer({ count, extent, size, color, opacity, seed }: LayerProps) {
  const material = useRef<THREE.ShaderMaterial>(null)
  const pixelRatio = useThree((s) => s.viewport.dpr)
  const reducedMotion = useReducedMotion()

  const { positions, sizes, phases } = useMemo(() => {
    const rand = mulberry32(seed)
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const phases = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      positions.set([(rand() - 0.5) * extent[0], (rand() - 0.5) * extent[1], (rand() - 0.5) * extent[2]], i * 3)
      sizes[i] = size * (0.5 + rand())
      phases[i] = rand()
    }
    return { positions, sizes, phases }
  }, [count, extent, size, seed])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDrift: { value: 1 },
      uPixelRatio: { value: 1 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
    }),
    [color, opacity],
  )

  useFrame(({ clock }) => {
    const m = material.current
    if (!m) return
    m.uniforms.uTime.value = clock.getElapsedTime()
    m.uniforms.uDrift.value = reducedMotion ? 0 : 1
    m.uniforms.uPixelRatio.value = pixelRatio
  })

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={material}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

const COOL: [number, number, number] = [12, 8, 12]
const WARM: [number, number, number] = [10, 7, 10]

/** Drifting motes around the comet: they make camera motion and depth readable. */
export function Dust() {
  return (
    <>
      <DustLayer count={420} extent={COOL} size={1.6} color="#a9b8ff" opacity={0.5} seed={11} />
      <DustLayer count={90} extent={WARM} size={2.4} color="#ffcf9e" opacity={0.4} seed={23} />
    </>
  )
}
