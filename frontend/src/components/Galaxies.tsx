import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { galaxySpecs, paintGalaxy } from '../lib/galaxies'
import type { Warp } from '../lib/warp'

const COUNT = 14
// Beyond the starfield; the group follows the camera, so they never come closer.
const DISTANCE = 900

/**
 * Distant galaxies on the sky. They turn with the sky on every hyperspace jump,
 * so each arrival brings different ones into view.
 */
export function Galaxies({ warp }: { warp: Warp }) {
  const group = useRef<THREE.Group>(null)
  const galaxies = useMemo(() => {
    const look = new THREE.Matrix4()
    const up = new THREE.Vector3(0, 1, 0)
    return galaxySpecs(COUNT, 911).map((spec) => {
      const texture = new THREE.CanvasTexture(paintGalaxy(spec))
      texture.colorSpace = THREE.SRGBColorSpace
      const position = spec.direction.clone().multiplyScalar(DISTANCE)
      // Face the viewer, then spin and tilt the disc so some are seen edge-on.
      const facing = new THREE.Quaternion().setFromRotationMatrix(look.lookAt(position, new THREE.Vector3(), up))
      const spin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), spec.spin)
      const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.acos(spec.tilt))
      const quaternion = facing.multiply(spin).multiply(tilt)
      const width = 2 * DISTANCE * Math.tan(spec.size / 2)
      return { texture, position, quaternion, width }
    })
  }, [])
  useEffect(() => () => galaxies.forEach((g) => g.texture.dispose()), [galaxies])
  const materials = useRef<(THREE.MeshBasicMaterial | null)[]>([])

  useFrame(({ camera }) => {
    const g = group.current
    if (!g) return
    // Infinitely far: centred on the camera, turned with the sky.
    g.position.copy(camera.position)
    g.quaternion.copy(warp.sky)
    for (const m of materials.current) if (m) m.opacity = 0.9 * (1 - 0.75 * warp.level)
  })

  return (
    <group ref={group}>
      {galaxies.map((g, i) => (
        <mesh key={i} position={g.position} quaternion={g.quaternion} renderOrder={-1} frustumCulled={false}>
          <planeGeometry args={[g.width, g.width]} />
          <meshBasicMaterial
            ref={(m) => {
              materials.current[i] = m
            }}
            map={g.texture}
            transparent
            opacity={0.9}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  )
}
