import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import fragmentShader from '../shaders/stars.frag'
import vertexShader from '../shaders/stars.vert'
import { generateStars } from '../lib/sky'
import { useReducedMotion } from '../hooks/useReducedMotion'

/**
 * Twinkling stars at a range of depths (so they parallax as the camera moves),
 * coloured by temperature and concentrated along the galactic band.
 */
export function Starfield({ count = 7000 }: { count?: number }) {
  const material = useRef<THREE.ShaderMaterial>(null)
  const pixelRatio = useThree((s) => s.viewport.dpr)
  const reducedMotion = useReducedMotion()

  const stars = useMemo(() => generateStars({ count }), [count])
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uTwinkle: { value: 0.55 },
      uPixelRatio: { value: 1 },
      uBrightness: { value: 1.7 },
    }),
    [],
  )

  useFrame(({ clock }) => {
    const m = material.current
    if (!m) return
    m.uniforms.uTime.value = clock.getElapsedTime()
    m.uniforms.uTwinkle.value = reducedMotion ? 0 : 0.55
    m.uniforms.uPixelRatio.value = pixelRatio
  })

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[stars.positions, 3]} />
        <bufferAttribute attach="attributes-aColor" args={[stars.colors, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[stars.sizes, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[stars.phases, 1]} />
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
