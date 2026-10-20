import { useMemo, useRef, type ComponentRef } from 'react'
import { Billboard, Line, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { easing } from 'maath'
import * as THREE from 'three'
import fontUrl from '@fontsource/space-mono/files/space-mono-latin-400-normal.woff?url'
import { AXES, type Axis, type Vec3Tuple } from '../lib/spec'
import { axisLabelVisibility } from '../lib/sky'
import { createGlowTexture } from '../lib/textures'

const EXTENT = 2.8
const DOT_SPACING = 0.11
const RING_RADIUS = 3

const UNIT: Record<Axis['key'], THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
}

type Line2 = ComponentRef<typeof Line>

// Troika text exposes fillOpacity as a mutable property.
type TextMesh = THREE.Mesh & { fillOpacity: number }

/** Dots along the axis, faint near the centre (where the comet lives) and towards the ends. */
function axisDots(dir: THREE.Vector3, hex: string) {
  const n = Math.floor(EXTENT / DOT_SPACING)
  const color = new THREE.Color(hex)
  const positions: number[] = []
  const colors: number[] = []
  for (let i = -n; i <= n; i++) {
    const t = Math.abs(i) / n
    const alpha = 0.75 * THREE.MathUtils.smoothstep(t, 0.06, 0.3) * (1 - 0.55 * t)
    if (alpha <= 0) continue
    positions.push(dir.x * i * DOT_SPACING, dir.y * i * DOT_SPACING, dir.z * i * DOT_SPACING)
    colors.push(color.r, color.g, color.b, alpha)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4))
  return geometry
}

function ConstellationAxis({ axis, chartMode, glow }: { axis: Axis; chartMode: boolean; glow: THREE.Texture }) {
  const dir = UNIT[axis.key]
  const dots = useMemo(() => axisDots(dir, axis.color), [dir, axis.color])
  const dotMaterial = useRef<THREE.PointsMaterial>(null)
  const line = useRef<Line2>(null)
  const labels = useRef<(TextMesh | null)[]>([])
  const fade = useRef({ chart: chartMode ? 1 : 0 })
  const viewDir = useMemo(() => new THREE.Vector3(), [])

  const end = (sign: number, k: number) => dir.clone().multiplyScalar(sign * k).toArray() as Vec3Tuple

  useFrame(({ camera }, delta) => {
    easing.damp(fade.current, 'chart', chartMode ? 1 : 0, 0.35, delta)
    const chart = fade.current.chart
    camera.getWorldDirection(viewDir)
    const visible = axisLabelVisibility(dir, viewDir)

    if (dotMaterial.current) dotMaterial.current.opacity = 1 - 0.65 * chart
    if (line.current) {
      line.current.material.opacity = 0.32 * chart
      line.current.visible = chart > 0.01
    }
    for (const label of labels.current) {
      if (label) label.fillOpacity = visible * (0.42 + 0.43 * chart)
    }
  })

  return (
    <group>
      <points geometry={dots}>
        <pointsMaterial
          ref={dotMaterial}
          map={glow}
          size={0.05}
          sizeAttenuation
          vertexColors
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <Line ref={line} points={[end(-1, EXTENT), end(1, EXTENT)]} color={axis.color} lineWidth={0.9} transparent opacity={0} />
      {([-1, 1] as const).map((sign, i) => (
        <group key={sign} position={end(sign, EXTENT + 0.12)}>
          {/* A small star marks each pole of the constellation. */}
          <sprite scale={0.22}>
            <spriteMaterial map={glow} color={axis.color} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
          <Billboard position={dir.clone().multiplyScalar(sign * 0.3).toArray() as Vec3Tuple}>
            <Text
              ref={(m: TextMesh | null) => {
                labels.current[i] = m
              }}
              font={fontUrl}
              fontSize={0.12}
              color={axis.color}
              anchorX="center"
              anchorY="middle"
              letterSpacing={0.08}
              fillOpacity={0.42}
            >
              {sign < 0 ? axis.negative : axis.positive}
            </Text>
          </Billboard>
        </group>
      ))}
    </group>
  )
}

// Chart-mode graticule: three great circles, one per plane.
function Rings({ chartMode }: { chartMode: boolean }) {
  const lines = useRef<(Line2 | null)[]>([])
  const fade = useRef({ v: chartMode ? 1 : 0 })
  const circle = useMemo(
    () =>
      Array.from({ length: 129 }, (_, i) => {
        const a = (i / 128) * Math.PI * 2
        return [Math.cos(a) * RING_RADIUS, Math.sin(a) * RING_RADIUS, 0] as Vec3Tuple
      }),
    [],
  )
  useFrame((_, delta) => {
    easing.damp(fade.current, 'v', chartMode ? 1 : 0, 0.35, delta)
    for (const l of lines.current) {
      if (!l) continue
      l.material.opacity = 0.3 * fade.current.v
      l.visible = fade.current.v > 0.01
    }
  })
  const rotations: [number, number, number][] = [
    [0, 0, 0],
    [Math.PI / 2, 0, 0],
    [0, Math.PI / 2, 0],
  ]
  return (
    <group>
      {rotations.map((rotation, i) => (
        <Line
          key={i}
          ref={(l) => {
            lines.current[i] = l
          }}
          points={circle}
          rotation={rotation}
          color="#4a4a8a"
          lineWidth={0.6}
          transparent
          opacity={0}
        />
      ))}
    </group>
  )
}

/**
 * The personality axes drawn as constellations: dotted arcs with a star at
 * each pole. Chart mode fades in solid axes and rings for reading exact values.
 */
export function Constellations({ chartMode }: { chartMode: boolean }) {
  const glow = useMemo(() => createGlowTexture(64), [])
  return (
    <>
      {AXES.map((a) => (
        <ConstellationAxis key={a.key} axis={a} chartMode={chartMode} glow={glow} />
      ))}
      <Rings chartMode={chartMode} />
    </>
  )
}
