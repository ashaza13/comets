import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Text, Environment, Line } from '@react-three/drei'
import * as THREE from 'three'
import { PersonalityMesh } from './PersonalityMesh'
import type { SessionState } from '../lib/types'

// Axis line from -extent to +extent with a label at the positive end
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
  const start = direction.map((v) => v * -extent) as [number, number, number]
  const end   = direction.map((v) => v * extent)  as [number, number, number]
  const labelPos = direction.map((v) => v * (extent + 0.3)) as [number, number, number]

  return (
    <group>
      <Line points={[start, end]} color={color} lineWidth={1} transparent opacity={0.25} />
      <Text
        position={labelPos}
        fontSize={0.18}
        color={color}
        anchorX="center"
        anchorY="middle"
        fillOpacity={0.5}
      >
        {label}
      </Text>
    </group>
  )
}

// Slowly rotating star field for depth
function StarField() {
  const points = useRef<THREE.Points>(null!)
  const geo = useRef<THREE.BufferGeometry>(null!)

  const positions = new Float32Array(1200)
  for (let i = 0; i < 1200; i += 3) {
    positions[i] = (Math.random() - 0.5) * 40
    positions[i + 1] = (Math.random() - 0.5) * 40
    positions[i + 2] = (Math.random() - 0.5) * 40
  }

  useFrame((_, delta) => {
    if (points.current) points.current.rotation.y += delta * 0.01
  })

  return (
    <points ref={points}>
      <bufferGeometry ref={geo}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#8888cc" size={0.04} transparent opacity={0.5} sizeAttenuation />
    </points>
  )
}

// Faint grid plane at y = -2.5
function GridPlane() {
  return (
    <gridHelper
      args={[12, 20, '#1e1e3e', '#1e1e3e']}
      position={[0, -2.8, 0]}
      rotation={[0, 0, 0]}
    />
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
      shadows
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      style={{ background: '#09090f' }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
      <directionalLight position={[-4, -2, -4]} intensity={0.3} color="#6060ff" />
      <pointLight position={[0, 0, 0]} intensity={0.5} color="#ffffff" distance={8} />

      <Environment preset="night" />

      <StarField />
      <GridPlane />

      {/* Personality axes */}
      <Axis direction={[1, 0, 0]} label="extrovert →" color="#ff6b6b" />
      <Axis direction={[0, 1, 0]} label="abstract →" color="#6bff9e" />
      <Axis direction={[0, 0, 1]} label="← analytical" color="#6bb5ff" />

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
