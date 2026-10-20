import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import fragmentShader from '../../shaders/ionTail.frag'
import vertexShader from '../../shaders/billboard.vert'
import type { CometLook } from '../../lib/comet'
import { useReducedMotion } from '../../hooks/useReducedMotion'

const WIDTH = 0.42

/**
 * Straight plasma tail pointing back along the heading. It is a strip that
 * stays aligned with the tail direction while turning to face the camera.
 */
export function IonTail({ look }: { look: CometLook }) {
  const mesh = useRef<THREE.Mesh>(null)
  const material = useRef<THREE.ShaderMaterial>(null)
  const reducedMotion = useReducedMotion()
  // Unit strip from y = 0 (nucleus) to y = 1 (tip).
  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1, 1, 24).translate(0, 0.5, 0), [])
  const tmp = useMemo(
    () => ({ dir: new THREE.Vector3(), toCam: new THREE.Vector3(), right: new THREE.Vector3(), normal: new THREE.Vector3(), basis: new THREE.Matrix4(), world: new THREE.Vector3() }),
    [],
  )
  const uniforms = useMemo(() => ({ uColor: { value: new THREE.Color() }, uTime: { value: 0 }, uIntensity: { value: 1 } }), [])

  useFrame(({ camera, clock }) => {
    const m = mesh.current
    const mat = material.current
    if (!m || !mat) return
    const { dir, toCam, right, normal, basis, world } = tmp
    dir.copy(look.heading).negate()
    m.getWorldPosition(world)
    toCam.subVectors(camera.position, world).normalize()
    right.crossVectors(dir, toCam)
    if (right.lengthSq() < 1e-6) return
    right.normalize()
    normal.crossVectors(right, dir)
    basis.makeBasis(right, dir, normal)
    m.quaternion.setFromRotationMatrix(basis)
    m.scale.set(WIDTH, 1.3 + 0.9 * look.energy, 1)

    mat.uniforms.uColor.value.copy(look.color)
    mat.uniforms.uTime.value = reducedMotion ? 0 : clock.getElapsedTime()
    mat.uniforms.uIntensity.value = 0.9 * look.energy * look.pulse
  })

  return (
    <mesh ref={mesh} geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  )
}
