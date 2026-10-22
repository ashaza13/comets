import { useMemo, useRef, type ComponentRef } from 'react'
import { Billboard, Line, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { easing } from 'maath'
import * as THREE from 'three'
import fontUrl from '@fontsource/instrument-sans/files/instrument-sans-latin-500-normal.woff?url'
import { AXES, SPACE_SCALE, type Axis, type Vec3Tuple } from '../lib/spec'
import { axisLabelVisibility } from '../lib/sky'
import { createGlowTexture } from '../lib/textures'

const EXTENT = SPACE_SCALE * 1.55
const DOT_SPACING = EXTENT / 25
const RING_RADIUS = SPACE_SCALE * 1.67
// Label height as a fraction of its distance from the camera.
const LABEL_SIZE = 0.024

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

interface FadeProps {
  chartMode: boolean
  revealed: boolean
}

function ConstellationAxis({ axis, chartMode, revealed, glow }: FadeProps & { axis: Axis; glow: THREE.Texture }) {
  const dir = UNIT[axis.key]
  const dots = useMemo(() => axisDots(dir, axis.color), [dir, axis.color])
  const dotMaterial = useRef<THREE.PointsMaterial>(null)
  const line = useRef<Line2>(null)
  const labels = useRef<(TextMesh | null)[]>([])
  const labelGroups = useRef<(THREE.Group | null)[]>([])
  const group = useRef<THREE.Group>(null)
  const poles = useRef<(THREE.SpriteMaterial | null)[]>([])
  const fade = useRef({ chart: chartMode ? 1 : 0, reveal: revealed ? 1 : 0 })
  const viewDir = useMemo(() => new THREE.Vector3(), [])
  const labelPos = useMemo(() => new THREE.Vector3(), [])

  const end = (sign: number, k: number) => dir.clone().multiplyScalar(sign * k).toArray() as Vec3Tuple

  useFrame(({ camera }, delta) => {
    easing.damp(fade.current, 'chart', chartMode ? 1 : 0, 0.35, delta)
    easing.damp(fade.current, 'reveal', revealed ? 1 : 0, 1.2, delta)
    const { chart, reveal } = fade.current
    if (group.current) group.current.visible = reveal > 0.01
    if (reveal <= 0.01) return
    camera.getWorldDirection(viewDir)
    const visible = axisLabelVisibility(dir, viewDir)

    if (dotMaterial.current) dotMaterial.current.opacity = reveal * (1 - 0.65 * chart)
    if (line.current) {
      line.current.material.opacity = 0.32 * chart * reveal
      line.current.visible = chart > 0.01
    }
    for (const pole of poles.current) {
      if (pole) pole.opacity = reveal
    }
    for (const label of labels.current) {
      if (label) label.fillOpacity = visible * reveal * (0.55 + 0.35 * chart)
    }
    // Scale labels with their distance from the camera so they read at a
    // constant size, whether the pole is far away or right beside the camera.
    for (const g of labelGroups.current) {
      if (!g) continue
      g.getWorldPosition(labelPos)
      g.scale.setScalar(camera.position.distanceTo(labelPos) * LABEL_SIZE)
    }
  })

  return (
    <group ref={group} visible={revealed}>
      <points geometry={dots}>
        <pointsMaterial
          ref={dotMaterial}
          map={glow}
          size={4}
          sizeAttenuation={false}
          vertexColors
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <Line ref={line} points={[end(-1, EXTENT), end(1, EXTENT)]} color={axis.color} lineWidth={0.9} transparent opacity={0} />
      {([-1, 1] as const).map((sign, i) => (
        <group key={sign} position={end(sign, EXTENT)}>
          {/* A small star marks each pole of the constellation (screen-sized). */}
          <sprite scale={0.035}>
            <spriteMaterial
              ref={(m) => {
                poles.current[i] = m
              }}
              map={glow}
              color={axis.color}
              sizeAttenuation={false}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </sprite>
          <Billboard
            ref={(g) => {
              labelGroups.current[i] = g
            }}
          >
            <Text
              position={[0, -1.6, 0]}
              ref={(m: TextMesh | null) => {
                labels.current[i] = m
              }}
              font={fontUrl}
              fontSize={1}
              color={axis.color}
              anchorX="center"
              anchorY="middle"
              letterSpacing={0.01}
              fillOpacity={0.55}
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
function Rings({ chartMode, revealed }: FadeProps) {
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
    easing.damp(fade.current, 'v', chartMode && revealed ? 1 : 0, 0.35, delta)
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
 * each pole. They stay hidden until the map is revealed (every question
 * answered). Chart mode then fades in solid axes and rings for exact values.
 */
export function Constellations({ chartMode, revealed }: FadeProps) {
  const glow = useMemo(() => createGlowTexture(64), [])
  return (
    <>
      {AXES.map((a) => (
        <ConstellationAxis key={a.key} axis={a} chartMode={chartMode} revealed={revealed} glow={glow} />
      ))}
      <Rings chartMode={chartMode} revealed={revealed} />
    </>
  )
}
