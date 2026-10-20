import { useMemo, useRef, type RefObject } from 'react'
import { extend, useFrame, type ThreeElement } from '@react-three/fiber'
import { MeshLineGeometry, MeshLineMaterial } from 'meshline'
import * as THREE from 'three'
import { tailControlPoints, tailTexture } from '../lib/tail'
import type { CometState } from '../lib/schema'

extend({ MeshLineGeometry, MeshLineMaterial })

declare module '@react-three/fiber' {
  interface ThreeElements {
    meshLineGeometry: ThreeElement<typeof MeshLineGeometry>
    meshLineMaterial: ThreeElement<typeof MeshLineMaterial>
  }
}

const SAMPLES = 160
const DEMO_LENGTH = 70
const WIDTH = 0.22

// Thin at the oldest end, full width at the head.
const taper = (p: number) => Math.pow(p, 1.6)

interface Props {
  /** One state per observation, oldest first. Empty in demo and debug mode. */
  history: CometState[]
  head: RefObject<THREE.Group | null>
  /** Current comet colour, used for the motion trail when there is no history. */
  headColor: RefObject<THREE.Color>
}

export function Tail({ history, head, headColor }: Props) {
  const recent = history.length === 0
  const geometry = useRef<MeshLineGeometry>(null)
  const material = useRef<MeshLineMaterial>(null)
  const sampled = useRef<THREE.Vector3[]>([])
  // Stable constructor args: a new object here would rebuild the material every render.
  const materialArgs = useMemo(() => [{ resolution: new THREE.Vector2(1, 1), lineWidth: WIDTH }] as const, [])

  // Per-observation emotion colours along the ribbon's length.
  const colors = useMemo(
    () => (recent ? new Uint8Array([255, 255, 255, 0, 255, 255, 255, 255]) : tailTexture(history)),
    [history, recent],
  )

  useFrame(({ size }) => {
    const headPos = head.current?.position
    if (!headPos || !geometry.current || !material.current) return
    // MeshLineMaterial copies the resolution it is constructed with, so keep its own copy current.
    material.current.resolution.set(size.width, size.height)

    let points: THREE.Vector3[]
    if (recent) {
      // No observations to draw: show the recent motion path behind the head.
      const trail = sampled.current
      if (trail.length === 0 || trail[trail.length - 1].distanceTo(headPos) > 0.004) {
        trail.push(headPos.clone())
        if (trail.length > DEMO_LENGTH) trail.shift()
      }
      points = trail.length > 1 ? trail : [headPos.clone(), headPos.clone()]
      material.current.color.copy(headColor.current)
    } else {
      sampled.current = []
      points = new THREE.CatmullRomCurve3(tailControlPoints(history, headPos), false, 'centripetal').getPoints(SAMPLES)
      material.current.color.set('white')
    }
    geometry.current.setPoints(points, taper)
  })

  return (
    <mesh frustumCulled={false}>
      <meshLineGeometry ref={geometry} />
      <meshLineMaterial
        ref={material}
        args={materialArgs}
        sizeAttenuation={1}
        useMap={1}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      >
        {/* Declared as a child so R3F owns its lifecycle; keyed so a new history gets a new texture. */}
        <dataTexture
          key={colors.length + ':' + history.length}
          attach="map"
          args={[colors, colors.length / 4, 1, THREE.RGBAFormat]}
          colorSpace={THREE.SRGBColorSpace}
          magFilter={THREE.LinearFilter}
          minFilter={THREE.LinearFilter}
          needsUpdate
        />
      </meshLineMaterial>
    </mesh>
  )
}
