import { useMemo, useRef } from 'react'
import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import fragmentShader from '../../shaders/coma.frag'
import vertexShader from '../../shaders/billboard.vert'
import type { CometLook } from '../../lib/comet'
import { useReducedMotion } from '../../hooks/useReducedMotion'

const BASE_SIZE = 1.5

/**
 * The gas cloud around the nucleus. Colour = emotion, brightness and size =
 * energy, churn = uncertainty, elongation = movement.
 */
export function Coma({ look }: { look: CometLook }) {
  const mesh = useRef<THREE.Mesh>(null)
  const material = useRef<THREE.ShaderMaterial>(null)
  const reducedMotion = useReducedMotion()
  const trail = useMemo(() => new THREE.Vector3(), [])
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color() },
      uEnergy: { value: 1 },
      uSpread: { value: 1 },
      uTime: { value: 0 },
      uPulse: { value: 1 },
      uTrail: { value: new THREE.Vector2(0, -1) },
      uStretch: { value: 0 },
    }),
    [],
  )

  useFrame(({ camera, clock }) => {
    const m = material.current
    if (!m || !mesh.current) return
    const u = m.uniforms
    u.uColor.value.copy(look.color)
    u.uEnergy.value = look.energy
    u.uSpread.value = look.spread
    u.uPulse.value = look.pulse
    u.uTime.value = reducedMotion ? 0 : clock.getElapsedTime()

    // Trailing direction (opposite the heading) as seen in the camera's plane.
    trail.copy(look.heading).negate().transformDirection(camera.matrixWorldInverse)
    const planar = Math.hypot(trail.x, trail.y)
    if (planar > 1e-3) u.uTrail.value.set(trail.x / planar, trail.y / planar)
    const speed = look.velocity.length()
    u.uStretch.value = planar * (0.35 + Math.min(speed * 2.5, 1.2))

    mesh.current.scale.setScalar(BASE_SIZE * (0.75 + 0.35 * look.energy) * (1 + 0.5 * look.spread))
  })

  return (
    <Billboard>
      <mesh ref={mesh}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          ref={material}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          // The glow is gas around and in front of the nucleus, so nothing should cut it off.
          depthTest={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </Billboard>
  )
}
