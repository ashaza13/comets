import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { easing } from 'maath'
import * as THREE from 'three'
import fragmentShader from '../shaders/warp.frag'
import vertexShader from '../shaders/warp.vert'
import { mulberry32 } from '../lib/sky'
import type { Warp } from '../lib/warp'
import { useReducedMotion } from '../hooks/useReducedMotion'

const COUNT = 1800
const BOX = 50
// Seconds of travel each streak represents; longer reads as faster.
const STRETCH = 0.35
const MAX_STREAK = 9

/**
 * Endless dust around the camera. At rest it is a soft field of motes that
 * gives depth; while travelling the motes stretch into streaks along the
 * direction of motion, so moving through the cosmos is felt, not just seen.
 */
export function SpaceDust({ warp }: { warp?: Warp }) {
  const points = useRef<THREE.ShaderMaterial>(null)
  const lines = useRef<THREE.ShaderMaterial>(null)
  const pixelRatio = useThree((s) => s.viewport.dpr)
  const reducedMotion = useReducedMotion()
  const motion = useRef({ last: new THREE.Vector3(), velocity: new THREE.Vector3(), raw: new THREE.Vector3(), started: false })

  const geometry = useMemo(() => {
    const rand = mulberry32(41)
    const base = new Float32Array(COUNT * 3)
    const seed = new Float32Array(COUNT)
    for (let i = 0; i < COUNT; i++) {
      base.set([(rand() - 0.5) * BOX, (rand() - 0.5) * BOX, (rand() - 0.5) * BOX], i * 3)
      seed[i] = rand()
    }
    // Points: one vertex per mote. Lines: two vertices per mote (head, tail).
    const pointGeo = new THREE.BufferGeometry()
    pointGeo.setAttribute('position', new THREE.BufferAttribute(base, 3))
    pointGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    pointGeo.setAttribute('aEnd', new THREE.BufferAttribute(new Float32Array(COUNT), 1))

    const linePos = new Float32Array(COUNT * 6)
    const lineSeed = new Float32Array(COUNT * 2)
    const lineEnd = new Float32Array(COUNT * 2)
    for (let i = 0; i < COUNT; i++) {
      linePos.set(base.subarray(i * 3, i * 3 + 3), i * 6)
      linePos.set(base.subarray(i * 3, i * 3 + 3), i * 6 + 3)
      lineSeed[i * 2] = lineSeed[i * 2 + 1] = seed[i]
      lineEnd[i * 2 + 1] = 1
    }
    const lineGeo = new THREE.BufferGeometry()
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3))
    lineGeo.setAttribute('aSeed', new THREE.BufferAttribute(lineSeed, 1))
    lineGeo.setAttribute('aEnd', new THREE.BufferAttribute(lineEnd, 1))
    return { pointGeo, lineGeo }
  }, [])

  const makeUniforms = (round: number, opacity: number) => ({
    uCamPos: { value: new THREE.Vector3() },
    uVelocity: { value: new THREE.Vector3() },
    uBox: { value: BOX },
    uStretch: { value: STRETCH },
    uPixelRatio: { value: 1 },
    uPointSize: { value: 1.6 },
    uColor: { value: new THREE.Color('#b9c6ff') },
    uOpacity: { value: opacity },
    uRound: { value: round },
  })
  const pointUniforms = useMemo(() => makeUniforms(1, 0.55), [])
  const lineUniforms = useMemo(() => makeUniforms(0, 0), [])

  useFrame(({ camera }, delta) => {
    const p = points.current
    const l = lines.current
    if (!p || !l || delta <= 0) return
    const m = motion.current
    if (!m.started) {
      m.last.copy(camera.position)
      m.started = true
    }
    m.raw.subVectors(camera.position, m.last).divideScalar(delta)
    m.last.copy(camera.position)
    easing.damp3(m.velocity, m.raw, 0.25, delta)
    // Cap the streak length so a sudden jump can't draw lines across the screen.
    const speed = m.velocity.length()
    const streak = reducedMotion ? 0 : Math.min(speed * STRETCH, MAX_STREAK)

    for (const mat of [p, l]) {
      mat.uniforms.uCamPos.value.copy(camera.position)
      mat.uniforms.uPixelRatio.value = pixelRatio
      if (speed > 1e-3) mat.uniforms.uVelocity.value.copy(m.velocity).multiplyScalar(streak / (speed * STRETCH))
      else mat.uniforms.uVelocity.value.set(0, 0, 0)
    }
    // Streaks fade in with speed; motes dim slightly so the streaks dominate.
    const streaking = THREE.MathUtils.smoothstep(speed, 0.5, 4)
    // In hyperspace the dust gives way to the tunnel: its streaks run along the
    // comet's path, which would criss-cross the tunnel's radiating lines.
    const hyperspace = warp?.level ?? 0
    l.uniforms.uOpacity.value = reducedMotion ? 0 : 0.85 * streaking * (1 - hyperspace)
    p.uniforms.uOpacity.value = 0.55 * (1 - 0.4 * streaking) * (1 - 0.8 * hyperspace)
  })

  const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }
  return (
    <>
      <points geometry={geometry.pointGeo} frustumCulled={false}>
        <shaderMaterial ref={points} vertexShader={vertexShader} fragmentShader={fragmentShader} uniforms={pointUniforms} {...additive} />
      </points>
      <lineSegments geometry={geometry.lineGeo} frustumCulled={false}>
        <shaderMaterial ref={lines} vertexShader={vertexShader} fragmentShader={fragmentShader} uniforms={lineUniforms} {...additive} />
      </lineSegments>
    </>
  )
}
