import { useMemo, useRef, type ComponentRef } from 'react'
import { Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { easing } from 'maath'
import * as THREE from 'three'
import { AXES, GRID_COLOR, type Vec3Tuple } from '../lib/spec'
import { createGlowTexture, createRingTexture } from '../lib/textures'

type Line2 = ComponentRef<typeof Line>

interface Props {
  /** Where the journey ended (world space). */
  position: THREE.Vector3
  shown: boolean
}

/**
 * A breathing ring around the comet's final place, and dashed drop lines from
 * it to each axis with a star at each foot, so you can see where you landed
 * and read off every dimension.
 */
export function FinalMarker({ position, shown }: Props) {
  const glow = useMemo(() => createGlowTexture(64), [])
  const ringTexture = useMemo(() => createRingTexture(128), [])
  const ring = useRef<THREE.Sprite>(null)
  const ringMaterial = useRef<THREE.SpriteMaterial>(null)
  const group = useRef<THREE.Group>(null)
  const lines = useRef<(Line2 | null)[]>([])
  const feet = useRef<(THREE.SpriteMaterial | null)[]>([])
  const fade = useRef({ v: 0 })

  const drops = useMemo(
    () =>
      AXES.map((axis) => {
        const foot = new THREE.Vector3()
        foot[axis.key] = position[axis.key]
        return { axis, foot: foot.toArray() as Vec3Tuple }
      }),
    [position],
  )

  useFrame(({ clock }, delta) => {
    easing.damp(fade.current, 'v', shown ? 1 : 0, 0.8, delta)
    const v = fade.current.v
    // A slow breathing ring marks where the journey ended.
    const breath = 0.5 + 0.5 * Math.sin(clock.getElapsedTime() * 1.6)
    if (ring.current) ring.current.scale.setScalar(0.085 + 0.012 * breath)
    if (ringMaterial.current) ringMaterial.current.opacity = v * (0.55 + 0.35 * breath)
    if (group.current) group.current.visible = v > 0.01
    for (const line of lines.current) if (line) line.material.opacity = 0.55 * v
    for (const foot of feet.current) if (foot) foot.opacity = 0.7 * v
  })

  return (
    <group ref={group} visible={false}>
      <sprite ref={ring} position={position} scale={0.09}>
        <spriteMaterial
          ref={ringMaterial}
          map={ringTexture}
          color={GRID_COLOR}
          sizeAttenuation={false}
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </sprite>
      {drops.map(({ axis, foot }, i) => (
        <group key={axis.key}>
          <Line
            ref={(l) => {
              lines.current[i] = l
            }}
            points={[position.toArray() as Vec3Tuple, foot]}
            color={GRID_COLOR}
            lineWidth={1.2}
            dashed
            dashSize={0.6}
            gapSize={0.45}
            transparent
            opacity={0}
            depthWrite={false}
          />
          <sprite position={foot} scale={0.016}>
            <spriteMaterial
              ref={(m) => {
                feet.current[i] = m
              }}
              map={glow}
              color={GRID_COLOR}
              sizeAttenuation={false}
              transparent
              opacity={0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </sprite>
        </group>
      ))}
    </group>
  )
}
