import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import fragmentShader from '../../shaders/nucleus.frag'
import vertexShader from '../../shaders/nucleus.vert'
import type { CometLook } from '../../lib/comet'

/** The solid body: an irregular icy rock with a glowing, emotion-coloured rim. */
export function Nucleus({ look }: { look: CometLook }) {
  const material = useRef<THREE.ShaderMaterial>(null)
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color() },
      uEnergy: { value: 1 },
      uPulse: { value: 1 },
      uRoughness: { value: 0.28 },
    }),
    [],
  )

  useFrame(() => {
    const m = material.current
    if (!m) return
    m.uniforms.uColor.value.copy(look.color)
    m.uniforms.uEnergy.value = look.energy
    m.uniforms.uPulse.value = look.pulse
  })

  return (
    <mesh>
      <icosahedronGeometry args={[0.075, 4]} />
      <shaderMaterial ref={material} vertexShader={vertexShader} fragmentShader={fragmentShader} uniforms={uniforms} toneMapped={false} />
    </mesh>
  )
}
