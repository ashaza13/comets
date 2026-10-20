import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { easing } from 'maath'
import * as THREE from 'three'
import fragmentShader from '../../shaders/particle.frag'
import vertexShader from '../../shaders/jets.vert'
import type { CometLook } from '../../lib/comet'
import { mulberry32 } from '../../lib/sky'
import { DOMAINS } from '../../lib/spec'
import { useReducedMotion } from '../../hooks/useReducedMotion'

const PER_DOMAIN = 220

/** Particle jets, one per interest domain; length and brightness follow depth. */
export function Jets({ look, interests }: { look: CometLook; interests: Record<string, number> }) {
  const material = useRef<THREE.ShaderMaterial>(null)
  const depths = useRef<Record<string, number>>({})
  const pixelRatio = useThree((s) => s.viewport.dpr)
  const reducedMotion = useReducedMotion()

  const { domain, seed, positions } = useMemo(() => {
    const rand = mulberry32(5)
    const count = DOMAINS.length * PER_DOMAIN
    const domain = new Float32Array(count)
    const seed = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      domain[i] = Math.floor(i / PER_DOMAIN)
      seed.set([rand(), rand(), rand()], i * 3)
    }
    // Positions are computed in the shader; the attribute only sets the draw count.
    return { domain, seed, positions: new Float32Array(count * 3) }
  }, [])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSpread: { value: 1 },
      uPixelRatio: { value: 1 },
      uDir: { value: DOMAINS.map((d) => new THREE.Vector3(...d.direction).normalize()) },
      // Boosted past 1 so the jets catch the bloom.
      uColor: { value: DOMAINS.map((d) => new THREE.Color(d.color).multiplyScalar(1.8)) },
      uDepth: { value: DOMAINS.map(() => 0) },
    }),
    [],
  )
  const defines = useMemo(() => ({ DOMAIN_COUNT: DOMAINS.length }), [])

  useFrame(({ clock }, delta) => {
    const m = material.current
    if (!m) return
    // Ease each jet towards its depth so jets grow and shrink smoothly.
    DOMAINS.forEach((d, i) => {
      easing.damp(depths.current, d.id, interests[d.id] ?? 0, 0.8, delta)
      m.uniforms.uDepth.value[i] = depths.current[d.id] ?? 0
    })
    m.uniforms.uTime.value = clock.getElapsedTime() * (reducedMotion ? 0.15 : 1)
    m.uniforms.uSpread.value = look.spread
    m.uniforms.uPixelRatio.value = pixelRatio
  })

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aDomain" args={[domain, 1]} />
        <bufferAttribute attach="attributes-aSeed" args={[seed, 3]} />
      </bufferGeometry>
      <shaderMaterial
        ref={material}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        defines={defines}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  )
}
