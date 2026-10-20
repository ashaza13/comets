import { useMemo } from 'react'
import { Billboard, Line, Stars, Text } from '@react-three/drei'
import fontUrl from '@fontsource/space-mono/files/space-mono-latin-400-normal.woff?url'
import { AXES, type Vec3Tuple } from '../lib/spec'

const EXTENT = 2.8
const RING_RADIUS = 3

const UNIT: Record<'x' | 'y' | 'z', Vec3Tuple> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }

function scaled(v: Vec3Tuple, k: number): Vec3Tuple {
  return [v[0] * k, v[1] * k, v[2] * k]
}

function AxisLine({ axis }: { axis: (typeof AXES)[number] }) {
  const dir = UNIT[axis.key]
  const labelProps = {
    font: fontUrl,
    fontSize: 0.13,
    color: axis.color,
    anchorX: 'center' as const,
    anchorY: 'middle' as const,
    fillOpacity: 0.55,
    letterSpacing: 0.05,
  }
  return (
    <group>
      <Line points={[scaled(dir, -EXTENT), scaled(dir, EXTENT)]} color={axis.color} lineWidth={0.8} transparent opacity={0.18} />
      <Billboard position={scaled(dir, -(EXTENT + 0.4))}>
        <Text {...labelProps}>{axis.negative}</Text>
      </Billboard>
      <Billboard position={scaled(dir, EXTENT + 0.4)}>
        <Text {...labelProps}>{axis.positive}</Text>
      </Billboard>
    </group>
  )
}

// Star-chart graticule: three great circles, one per plane.
function Rings() {
  const circle = useMemo(
    () =>
      Array.from({ length: 129 }, (_, i) => {
        const a = (i / 128) * Math.PI * 2
        return [Math.cos(a) * RING_RADIUS, Math.sin(a) * RING_RADIUS, 0] as Vec3Tuple
      }),
    [],
  )
  return (
    <group>
      <Line points={circle} color="#3a3a6a" lineWidth={0.6} transparent opacity={0.35} />
      <Line points={circle} color="#3a3a6a" lineWidth={0.6} transparent opacity={0.35} rotation={[Math.PI / 2, 0, 0]} />
      <Line points={circle} color="#3a3a6a" lineWidth={0.6} transparent opacity={0.35} rotation={[0, Math.PI / 2, 0]} />
    </group>
  )
}

export function Sky() {
  return (
    <>
      <Stars radius={60} depth={40} count={2500} factor={3} saturation={0} fade speed={0.4} />
      <Rings />
      {AXES.map((a) => (
        <AxisLine key={a.key} axis={a} />
      ))}
    </>
  )
}
