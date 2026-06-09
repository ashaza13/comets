import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SessionState } from '../lib/types'
import { DOMAIN_DIRECTIONS } from '../lib/domains'

const RADIUS = 1
const SEGMENTS = 64

function deformGeometry(
  geometry: THREE.SphereGeometry,
  originalPositions: Float32Array,
  interests: Record<string, number>,
): void {
  const posAttr = geometry.attributes.position as THREE.BufferAttribute
  const count = posAttr.count

  for (let i = 0; i < count; i++) {
    const ox = originalPositions[i * 3]
    const oy = originalPositions[i * 3 + 1]
    const oz = originalPositions[i * 3 + 2]

    const len = Math.sqrt(ox * ox + oy * oy + oz * oz)
    if (len === 0) continue
    const nx = ox / len
    const ny = oy / len
    const nz = oz / len

    let displacement = 0
    for (const [domain, depth] of Object.entries(interests)) {
      const dir = DOMAIN_DIRECTIONS[domain]
      if (!dir || depth <= 0) continue
      const dot = nx * dir[0] + ny * dir[1] + nz * dir[2]
      if (dot > 0) {
        // pow(4) gives sharp crystalline spikes; scale keeps total reasonable
        displacement += Math.pow(dot, 4) * depth * 0.4
      }
    }

    const scale = 1 + displacement
    posAttr.setXYZ(i, ox * scale, oy * scale, oz * scale)
  }

  posAttr.needsUpdate = true
  geometry.computeVertexNormals()
}

interface Props {
  state: SessionState | null
  isLoading: boolean
}

export function PersonalityMesh({ state, isLoading }: Props) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const matRef = useRef<THREE.MeshPhysicalMaterial>(null!)

  const targetPos = useRef(new THREE.Vector3(0, 0, 0))
  const currentHSL = useRef({ h: 200 / 360, s: 0.3, l: 0.5 })
  const targetHSL = useRef({ h: 200 / 360, s: 0.3, l: 0.5 })
  const pulsePhase = useRef(0)

  const geometry = useMemo(
    () => new THREE.SphereGeometry(RADIUS, SEGMENTS, SEGMENTS),
    [],
  )

  const originalPositions = useMemo(
    () => new Float32Array(geometry.attributes.position.array),
    [geometry],
  )

  useEffect(() => {
    if (!state) return

    targetPos.current.set(
      state.personality.x * 1.8,
      state.personality.y * 1.8,
      state.personality.z * 1.8,
    )

    targetHSL.current = {
      h: state.emotion.hue / 360,
      s: state.emotion.saturation,
      l: state.emotion.lightness,
    }

    deformGeometry(geometry, originalPositions, state.interests)
  }, [state, geometry, originalPositions])

  useFrame((_, delta) => {
    if (!meshRef.current || !matRef.current) return

    // Frame-rate-independent lerp: reaches ~99% in ~1s at t=0.02
    const t = 1 - Math.pow(0.02, delta)

    meshRef.current.position.lerp(targetPos.current, t)
    meshRef.current.rotation.y += delta * 0.12

    // Lerp HSL — hue wraps so we take the shortest path
    const cur = currentHSL.current
    const tgt = targetHSL.current
    const hueDiff = ((tgt.h - cur.h + 0.5) % 1) - 0.5
    cur.h = ((cur.h + hueDiff * t) + 1) % 1
    cur.s += (tgt.s - cur.s) * t
    cur.l += (tgt.l - cur.l) * t

    matRef.current.color.setHSL(cur.h, cur.s, cur.l)
    matRef.current.emissive.setHSL(cur.h, cur.s * 0.6, cur.l * 0.2)

    // Gentle pulse while loading
    if (isLoading) {
      pulsePhase.current += delta * 3
      const pulse = 0.05 * Math.sin(pulsePhase.current)
      matRef.current.emissiveIntensity = 0.4 + pulse
    } else {
      pulsePhase.current = 0
      matRef.current.emissiveIntensity = 0.2
    }
  })

  return (
    <mesh ref={meshRef} geometry={geometry} castShadow>
      <meshPhysicalMaterial
        ref={matRef}
        metalness={0.25}
        roughness={0.35}
        clearcoat={0.6}
        clearcoatRoughness={0.15}
        reflectivity={0.8}
      />
    </mesh>
  )
}
