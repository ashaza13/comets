import { Canvas } from '@react-three/fiber'
import { OrbitControls, Text, Line } from '@react-three/drei'
import * as THREE from 'three'
import { PersonalityMesh } from './PersonalityMesh'
import type { SessionState } from '../lib/types'

const FONT = 'https://cdn.jsdelivr.net/npm/@fontsource/space-mono/files/space-mono-latin-400-normal.woff'

function Axis({
  direction,
  label,
  color,
  extent = 2.8,
}: {
  direction: [number, number, number]
  label: string
  color: string
  extent?: number
}) {
  const start    = direction.map((v) => v * -extent) as [number, number, number]
  const end      = direction.map((v) => v * extent)  as [number, number, number]
  const labelPos = direction.map((v) => v * (extent + 0.35)) as [number, number, number]

  return (
    <group>
      <Line points={[start, end]} color={color} lineWidth={0.8} transparent opacity={0.2} />
      <Text
        position={labelPos}
        font={FONT}
        fontSize={0.15}
        color={color}
        anchorX="center"
        anchorY="middle"
        fillOpacity={0.55}
        letterSpacing={0.05}
      >
        {label}
      </Text>
    </group>
  )
}

// Vectorscope graticule — wireframe sphere shells at 1, 2, 3 unit radii
function Graticule() {
  return (
    <group>
      {([
        // [1.0, 0.20] as const,
        // [2.0, 0.12] as const,
        [3.0, 0.06] as const,
      ]).map(([r, opacity]) => (
        <mesh key={r}>
          <sphereGeometry args={[r, 40, 20]} />
          <meshBasicMaterial color="#2a2a50" wireframe transparent opacity={opacity} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

interface Props {
  state: SessionState | null
  isLoading: boolean
}

export function Scene({ state, isLoading }: Props) {
  return (
    <Canvas
      camera={{ position: [0, 0, 7], fov: 50 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      style={{ background: '#09090f' }}
    >
      <ambientLight intensity={0.08} />

      <Graticule />

      <Axis direction={[1, 0, 0]} label="extrovert →"   color="#ff6b6b" />
      <Axis direction={[0, 1, 0]} label="abstract →"    color="#6bff9e" />
      <Axis direction={[0, 0, 1]} label="← analytical"  color="#6bb5ff" />

      <PersonalityMesh state={state} isLoading={isLoading} />

      <OrbitControls
        enablePan={false}
        minDistance={3}
        maxDistance={14}
        autoRotate={!state || state.message_count === 0}
        autoRotateSpeed={0.4}
      />
    </Canvas>
  )
}
