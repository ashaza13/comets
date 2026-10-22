import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import fragmentShader from '../shaders/hyperspace.frag'
import vertexShader from '../shaders/hyperspace.vert'
import { mulberry32 } from '../lib/sky'
import type { Warp } from '../lib/warp'

const STREAKS = 1200
// Tunnel shape (camera-space units): streaks keep clear of the centre, where the comet is.
const RADIUS_MIN = 1.6
const RADIUS_MAX = 26
const DEPTH = 220
const NEAR = 4
const LENGTH = 90
// Speed at full warp, in units per second.
const SPEED = 320

/**
 * The jump to lightspeed: streaks drawn in camera space so they always radiate
 * from the middle of the screen, where the comet is, however the camera turns.
 */
export function Hyperspace({ warp }: { warp: Warp }) {
  const lines = useRef<THREE.LineSegments>(null)
  const material = useRef<THREE.ShaderMaterial>(null)
  const travelled = useRef(0)

  const geometry = useMemo(() => {
    const rand = mulberry32(73)
    const streak = new Float32Array(STREAKS * 2 * 3)
    const end = new Float32Array(STREAKS * 2)
    for (let i = 0; i < STREAKS; i++) {
      // Denser towards the middle of the view, like stars ahead.
      const radius = RADIUS_MIN + (RADIUS_MAX - RADIUS_MIN) * Math.pow(rand(), 1.6)
      const s = [rand() * Math.PI * 2, radius, rand()]
      streak.set(s, i * 6)
      streak.set(s, i * 6 + 3)
      end[i * 2 + 1] = 1
    }
    const g = new THREE.BufferGeometry()
    // Positions come from the shader; this attribute only sets the vertex count.
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STREAKS * 2 * 3), 3))
    g.setAttribute('aStreak', new THREE.BufferAttribute(streak, 3))
    g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1))
    return g
  }, [])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uWarp: { value: 0 },
      uDepth: { value: DEPTH },
      uNear: { value: NEAR },
      uLength: { value: LENGTH },
      uHead: { value: new THREE.Color('#eef3ff') },
      uTail: { value: new THREE.Color('#5d7dff') },
    }),
    [],
  )

  useFrame((_, delta) => {
    const l = lines.current
    const m = material.current
    if (!l || !m) return
    l.visible = warp.level > 0.005
    // Streaks advance with the warp, so they slow to a stop as it drops away.
    travelled.current += SPEED * warp.level * delta
    m.uniforms.uTime.value = travelled.current
    m.uniforms.uWarp.value = warp.level
  })

  return (
    <lineSegments ref={lines} geometry={geometry} frustumCulled={false} visible={false} renderOrder={2}>
      <shaderMaterial
        ref={material}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </lineSegments>
  )
}
