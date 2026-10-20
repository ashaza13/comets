import { useMemo, useRef, type RefObject } from 'react'
import { extend, useFrame, useThree, type ThreeElement } from '@react-three/fiber'
import { MeshLineGeometry, MeshLineMaterial } from 'meshline'
import * as THREE from 'three'
import fragmentShader from '../shaders/particle.frag'
import vertexShader from '../shaders/dustTail.vert'
import { packCurve, type CometLook } from '../lib/comet'
import { mulberry32 } from '../lib/sky'
import { journeyPath, liveControlPoints, type JourneyPath } from '../lib/playback'
import { tailTexture } from '../lib/tail'
import { useReducedMotion } from '../hooks/useReducedMotion'
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
const CURVE_TEXELS = SAMPLES + 1
const DUST_PARTICLES = 6000
// The ribbon is the tail's thin bright spine (in screen pixels, so it stays
// visible from the map's distance); the dust particles give it body.
const WIDTH = 3

// Thin at the oldest end, full width at the head.
const taper = (p: number) => Math.pow(p, 1.6)

interface Props {
  /** One state per observation, oldest first. Empty in demo and debug mode. */
  history: CometState[]
  head: RefObject<THREE.Group | null>
  /** Live comet appearance: colour for the motion trail, uncertainty for dust scatter. */
  look: RefObject<CometLook | null>
  /**
   * While replaying: the full journey path and how far along it the comet is
   * (curve parameter t). The tail is then drawn as the curve's first t, so it
   * grows smoothly instead of re-bending at each answer.
   */
  journey?: { path: JourneyPath; t: number } | null
}

// Below this curve parameter the replayed tail is too short to draw.
const MIN_REPLAY_T = 1e-4

export function Tail({ history, head, look, journey = null }: Props) {
  // Live tail follows the same path of distinct places as replays do.
  const livePath = useMemo(() => (journey ? null : journeyPath(history)), [journey, history])
  const path = journey?.path ?? livePath
  const colorStates = useMemo(() => path?.states ?? [], [path])
  const recent = !journey && history.length === 0
  const lineMesh = useRef<THREE.Mesh>(null)
  const dustPoints = useRef<THREE.Points>(null)
  const geometry = useRef<MeshLineGeometry>(null)
  const material = useRef<MeshLineMaterial>(null)
  const dustMaterial = useRef<THREE.ShaderMaterial>(null)
  const curve = useRef<THREE.DataTexture>(null)
  const sampled = useRef<THREE.Vector3[]>([])
  const pixelRatio = useThree((s) => s.viewport.dpr)
  const reducedMotion = useReducedMotion()

  const dust = useMemo(() => {
    const rand = mulberry32(17)
    const seed = new Float32Array(DUST_PARTICLES * 3)
    for (let i = 0; i < seed.length; i++) seed[i] = rand()
    // Positions are computed in the shader; the attribute only sets the draw count.
    return { seed, positions: new Float32Array(DUST_PARTICLES * 3), curve: new Float32Array(CURVE_TEXELS * 4) }
  }, [])
  const dustUniforms = useMemo(
    () => ({
      uCurve: { value: null as THREE.DataTexture | null },
      uColors: { value: null as THREE.DataTexture | null },
      uCount: { value: 0 },
      uTime: { value: 0 },
      uSpread: { value: 1 },
      uPixelRatio: { value: 1 },
      uTint: { value: new THREE.Color(1, 1, 1) },
      uColorSpan: { value: 1 },
    }),
    [],
  )
  // Stable constructor args: a new object here would rebuild the material every render.
  const materialArgs = useMemo(() => [{ resolution: new THREE.Vector2(1, 1), lineWidth: WIDTH }] as const, [])

  // Per-observation emotion colours along the ribbon's length.
  const colors = useMemo(
    () => (recent ? new Uint8Array([255, 255, 255, 0, 255, 255, 255, 255]) : tailTexture(colorStates)),
    [colorStates, recent],
  )

  useFrame(({ size, clock }) => {
    const headPos = head.current?.position
    const l = look.current
    if (!headPos || !l || !geometry.current || !material.current) return
    // MeshLineMaterial copies the resolution it is constructed with, so keep its own copy current.
    material.current.resolution.set(size.width, size.height)

    let points: THREE.Vector3[]
    // Fraction of the colour texture the drawn tail spans (less than 1 mid-replay).
    let colorSpan = 1
    // Nothing travelled yet (e.g. only the mood step so far): no tail to draw.
    const drawn = recent || path !== null
    if (lineMesh.current) lineMesh.current.visible = drawn
    if (dustPoints.current) dustPoints.current.visible = drawn
    if (!drawn) return

    if (journey) {
      sampled.current = []
      const t = Math.max(journey.t, MIN_REPLAY_T)
      points = Array.from({ length: SAMPLES + 1 }, (_, i) => journey.path.curve.getPoint((i / SAMPLES) * t))
      colorSpan = t
      material.current.color.set('white')
    } else if (recent) {
      // No observations to draw: show the recent motion path behind the head.
      const trail = sampled.current
      if (trail.length === 0 || trail[trail.length - 1].distanceTo(headPos) > 0.004) {
        trail.push(headPos.clone())
        if (trail.length > DEMO_LENGTH) trail.shift()
      }
      points = trail.length > 1 ? trail : [headPos.clone(), headPos.clone()]
      material.current.color.copy(l.color)
    } else {
      sampled.current = []
      points = new THREE.CatmullRomCurve3(liveControlPoints(path!, headPos), false, 'centripetal').getPoints(SAMPLES)
      material.current.color.set('white')
    }
    geometry.current.setPoints(points, taper)
    material.current.repeat.set(colorSpan, 1)

    const dm = dustMaterial.current
    const tex = curve.current
    if (dm && tex) {
      dm.uniforms.uCount.value = packCurve(points, tex.image.data as Float32Array)
      tex.needsUpdate = true
      dm.uniforms.uTime.value = clock.getElapsedTime() * (reducedMotion ? 0.2 : 1)
      dm.uniforms.uSpread.value = l.spread
      dm.uniforms.uPixelRatio.value = pixelRatio
      dm.uniforms.uColorSpan.value = colorSpan
      if (recent) dm.uniforms.uTint.value.copy(l.color)
      else dm.uniforms.uTint.value.setRGB(1.3, 1.3, 1.3)
    }
  })

  const colorTexture = (attach: string) => (
    // Declared as a child so R3F owns its lifecycle; keyed so a new history gets a new texture.
    <dataTexture
      key={colors.length + ':' + colorStates.length}
      attach={attach}
      args={[colors, colors.length / 4, 1, THREE.RGBAFormat]}
      colorSpace={THREE.SRGBColorSpace}
      magFilter={THREE.LinearFilter}
      minFilter={THREE.LinearFilter}
      needsUpdate
    />
  )

  return (
    <>
      <mesh ref={lineMesh} frustumCulled={false}>
        <meshLineGeometry ref={geometry} />
        <meshLineMaterial
          ref={material}
          args={materialArgs}
          sizeAttenuation={0}
          opacity={0.8}
          useMap={1}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        >
          {colorTexture('map')}
        </meshLineMaterial>
      </mesh>

      <points ref={dustPoints} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[dust.positions, 3]} />
          <bufferAttribute attach="attributes-aSeed" args={[dust.seed, 3]} />
        </bufferGeometry>
        <shaderMaterial
          ref={dustMaterial}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={dustUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        >
          <dataTexture
            ref={curve}
            attach="uniforms-uCurve-value"
            args={[dust.curve, CURVE_TEXELS, 1, THREE.RGBAFormat, THREE.FloatType]}
            magFilter={THREE.NearestFilter}
            minFilter={THREE.NearestFilter}
          />
          {colorTexture('uniforms-uColors-value')}
        </shaderMaterial>
      </points>
    </>
  )
}
