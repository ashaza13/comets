import { useMemo, useRef, type RefObject } from 'react'
import { Billboard } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import ringFragment from '../shaders/flareRing.frag'
import billboardVertex from '../shaders/billboard.vert'
import burstVertex from '../shaders/flareBurst.vert'
import particleFragment from '../shaders/particle.frag'
import type { CometLook } from '../lib/comet'
import { mulberry32 } from '../lib/sky'
import { useReducedMotion } from '../hooks/useReducedMotion'

const DURATION = 1.6
// Plane size; the ring itself reaches about 72% of the way to the edge.
const RING_SIZE = 4.4
const PARTICLES = 260

interface Props {
  /** Number of answers so far; the flare fires each time it increases. */
  count: number
  head: RefObject<THREE.Group | null>
  look: RefObject<CometLook | null>
}

/** A shockwave ring and particle burst where the comet was when an answer landed. */
export function Flare({ count, head, look }: Props) {
  const group = useRef<THREE.Group>(null)
  const ring = useRef<THREE.ShaderMaterial>(null)
  const burst = useRef<THREE.ShaderMaterial>(null)
  const pixelRatio = useThree((s) => s.viewport.dpr)
  const reducedMotion = useReducedMotion()
  // Seen count starts at the mounted value so reloading a saved journey doesn't flare.
  const state = useRef({ seen: count, startedAt: -Infinity })

  const particles = useMemo(() => {
    const rand = mulberry32(29)
    const dirs = new Float32Array(PARTICLES * 3)
    const speeds = new Float32Array(PARTICLES)
    for (let i = 0; i < PARTICLES; i++) {
      const z = rand() * 2 - 1
      const phi = rand() * Math.PI * 2
      const r = Math.sqrt(1 - z * z)
      dirs.set([r * Math.cos(phi), z, r * Math.sin(phi)], i * 3)
      speeds[i] = 0.6 + rand() * 1.2
    }
    return { dirs, speeds, positions: new Float32Array(PARTICLES * 3) }
  }, [])
  const ringUniforms = useMemo(() => ({ uColor: { value: new THREE.Color() }, uProgress: { value: 0 } }), [])
  const burstUniforms = useMemo(
    () => ({ uColor: { value: new THREE.Color() }, uProgress: { value: 0 }, uPixelRatio: { value: 1 } }),
    [],
  )

  useFrame(({ clock }) => {
    const g = group.current
    if (!g || !ring.current || !burst.current) return
    const now = clock.getElapsedTime()
    const s = state.current
    if (count > s.seen && head.current && !reducedMotion) {
      g.position.copy(head.current.position)
      s.startedAt = now
      const color = look.current?.color
      if (color) {
        ring.current.uniforms.uColor.value.copy(color).multiplyScalar(1.5)
        burst.current.uniforms.uColor.value.copy(color).multiplyScalar(1.8)
      }
    }
    s.seen = count
    const progress = (now - s.startedAt) / DURATION
    g.visible = progress >= 0 && progress < 1
    if (!g.visible) return
    ring.current.uniforms.uProgress.value = progress
    burst.current.uniforms.uProgress.value = progress
    burst.current.uniforms.uPixelRatio.value = pixelRatio
  })

  const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }

  return (
    <group ref={group} visible={false}>
      <Billboard>
        <mesh scale={RING_SIZE}>
          <planeGeometry args={[1, 1]} />
          <shaderMaterial ref={ring} vertexShader={billboardVertex} fragmentShader={ringFragment} uniforms={ringUniforms} {...additive} />
        </mesh>
      </Billboard>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particles.positions, 3]} />
          <bufferAttribute attach="attributes-aDir" args={[particles.dirs, 3]} />
          <bufferAttribute attach="attributes-aSpeed" args={[particles.speeds, 1]} />
        </bufferGeometry>
        <shaderMaterial ref={burst} vertexShader={burstVertex} fragmentShader={particleFragment} uniforms={burstUniforms} {...additive} />
      </points>
    </group>
  )
}
