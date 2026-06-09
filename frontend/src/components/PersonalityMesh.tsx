import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SessionState } from '../lib/types'

const MAX_TRAIL   = 80
const SAMPLE_EVERY = 2   // frames between position samples

interface Props {
  state: SessionState | null
  isLoading: boolean
}

export function PersonalityMesh({ state, isLoading }: Props) {
  // Nucleus refs
  const groupRef = useRef<THREE.Group>(null!)
  const glow1Ref = useRef<THREE.MeshBasicMaterial>(null!)
  const glow2Ref = useRef<THREE.MeshBasicMaterial>(null!)
  const glow3Ref = useRef<THREE.MeshBasicMaterial>(null!)
  const lightRef = useRef<THREE.PointLight>(null!)

  // Animation state
  const targetPos  = useRef(new THREE.Vector3(0, 0, 0))
  const currentHSL = useRef({ h: 200 / 360, s: 0.6, l: 0.55 })
  const targetHSL  = useRef({ h: 200 / 360, s: 0.6, l: 0.55 })
  const pulsePhase = useRef(0)
  const glowColor  = useRef(new THREE.Color())

  // Trail state — pre-allocated temp vectors to avoid per-frame allocation
  const trailHistory = useRef<THREE.Vector3[]>([])
  const frameCount   = useRef(0)
  const tmpTangent   = useRef(new THREE.Vector3())
  const tmpToCam     = useRef(new THREE.Vector3())
  const tmpBinormal  = useRef(new THREE.Vector3())

  // Fixed-size trail geometry — indices are static, only positions/colors update
  const trailGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_TRAIL * 2 * 3), 3))
    geo.setAttribute('color',    new THREE.BufferAttribute(new Float32Array(MAX_TRAIL * 2 * 3), 3))
    const idx: number[] = []
    for (let i = 0; i < MAX_TRAIL - 1; i++) {
      const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1
      idx.push(a, c, b, b, c, d)
    }
    geo.setIndex(idx)
    return geo
  }, [])

  const trailMat = useMemo(() => new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  }), [])

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
  }, [state])

  useFrame(({ camera }, delta) => {
    if (!groupRef.current) return

    const lerpT = 1 - Math.pow(0.02, delta)
    groupRef.current.position.lerp(targetPos.current, lerpT)

    // Lerp emotion color
    const cur = currentHSL.current
    const tgt = targetHSL.current
    const hueDiff = ((tgt.h - cur.h + 0.5) % 1) - 0.5
    cur.h = ((cur.h + hueDiff * lerpT) + 1) % 1
    cur.s += (tgt.s - cur.s) * lerpT
    cur.l += (tgt.l - cur.l) * lerpT

    glowColor.current.setHSL(cur.h, Math.min(cur.s * 1.3, 1), Math.min(cur.l + 0.2, 0.95))

    if (glow1Ref.current) glow1Ref.current.color.copy(glowColor.current)
    if (glow2Ref.current) glow2Ref.current.color.copy(glowColor.current)
    if (glow3Ref.current) glow3Ref.current.color.copy(glowColor.current)
    if (lightRef.current) lightRef.current.color.copy(glowColor.current)

    if (isLoading) {
      pulsePhase.current += delta * 3
      const p = 0.5 + 0.5 * Math.sin(pulsePhase.current)
      if (glow1Ref.current) glow1Ref.current.opacity = 0.55 + 0.2 * p
      if (glow2Ref.current) glow2Ref.current.opacity = 0.18 + 0.12 * p
      if (glow3Ref.current) glow3Ref.current.opacity = 0.05 + 0.06 * p
      if (lightRef.current) lightRef.current.intensity = 1.0 + 1.0 * p
    } else {
      pulsePhase.current = 0
      if (glow1Ref.current) glow1Ref.current.opacity = 0.65
      if (glow2Ref.current) glow2Ref.current.opacity = 0.25
      if (glow3Ref.current) glow3Ref.current.opacity = 0.08
      if (lightRef.current) lightRef.current.intensity = 1.8
    }

    // ── Trail sampling ──────────────────────────────────────────────────────
    frameCount.current++
    if (frameCount.current % SAMPLE_EVERY === 0) {
      const pos = groupRef.current.position.clone()
      const hist = trailHistory.current
      if (hist.length === 0 || pos.distanceTo(hist[hist.length - 1]) > 0.001) {
        hist.push(pos)
        if (hist.length > MAX_TRAIL) hist.shift()
      }
    }

    // ── Trail geometry update ───────────────────────────────────────────────
    const hist = trailHistory.current
    const N = hist.length
    if (N < 2) return

    const posAttr   = trailGeo.attributes.position as THREE.BufferAttribute
    const colorAttr = trailGeo.attributes.color    as THREE.BufferAttribute
    const posArr    = posAttr.array   as Float32Array
    const colorArr  = colorAttr.array as Float32Array

    for (let i = 0; i < MAX_TRAIL; i++) {
      const vi = i * 2

      if (i >= N) {
        // Collapse unused verts to the tail tip (degenerate — invisible)
        const tip = hist[0]
        posArr[vi * 3]     = tip.x; posArr[vi * 3 + 1] = tip.y; posArr[vi * 3 + 2] = tip.z
        posArr[vi * 3 + 3] = tip.x; posArr[vi * 3 + 4] = tip.y; posArr[vi * 3 + 5] = tip.z
        colorArr.fill(0, vi * 3, vi * 3 + 6)
        continue
      }

      // frac: 0 = oldest (tail tip), 1 = newest (nucleus)
      const frac       = i / (N - 1)
      const brightness = Math.pow(frac, 1.4)          // gradual fade toward tip
      const halfW      = frac * frac * 0.28            // fan: stays narrow, broadens near nucleus

      const p    = hist[i]
      const next = hist[Math.min(i + 1, N - 1)]
      const prev = hist[Math.max(i - 1, 0)]

      tmpTangent.current.subVectors(next, prev)
      if (tmpTangent.current.lengthSq() < 1e-10) tmpTangent.current.set(0, 0, 1)
      else tmpTangent.current.normalize()

      tmpToCam.current.subVectors(camera.position, p).normalize()
      tmpBinormal.current.crossVectors(tmpTangent.current, tmpToCam.current)
      if (tmpBinormal.current.lengthSq() < 1e-10) tmpBinormal.current.set(1, 0, 0)
      else tmpBinormal.current.normalize()

      posArr[vi * 3]     = p.x - tmpBinormal.current.x * halfW
      posArr[vi * 3 + 1] = p.y - tmpBinormal.current.y * halfW
      posArr[vi * 3 + 2] = p.z - tmpBinormal.current.z * halfW
      posArr[vi * 3 + 3] = p.x + tmpBinormal.current.x * halfW
      posArr[vi * 3 + 4] = p.y + tmpBinormal.current.y * halfW
      posArr[vi * 3 + 5] = p.z + tmpBinormal.current.z * halfW

      const r = glowColor.current.r * brightness
      const g = glowColor.current.g * brightness
      const b = glowColor.current.b * brightness
      colorArr[vi * 3]     = r; colorArr[vi * 3 + 1] = g; colorArr[vi * 3 + 2] = b
      colorArr[vi * 3 + 3] = r; colorArr[vi * 3 + 4] = g; colorArr[vi * 3 + 5] = b
    }

    posAttr.needsUpdate   = true
    colorAttr.needsUpdate = true
    trailGeo.computeBoundingSphere()
  })

  return (
    <>
      {/* Camera-facing ribbon trail with additive glow */}
      <mesh geometry={trailGeo} material={trailMat} />

      {/* Nucleus */}
      <group ref={groupRef}>
        {/* Bright phosphor core */}
        <mesh>
          <sphereGeometry args={[0.045, 8, 4]} />
          <meshBasicMaterial color="white" />
        </mesh>

        <pointLight ref={lightRef} intensity={1.8} distance={6} decay={2} />
      </group>
    </>
  )
}
