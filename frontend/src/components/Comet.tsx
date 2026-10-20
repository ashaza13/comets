import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Billboard, Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { easing } from 'maath'
import * as THREE from 'three'
import { emotionColor, emotionCss, energyGlow } from '../lib/color'
import type { CometState } from '../lib/schema'
import { AXES, DOMAINS, domainColor } from '../lib/spec'
import { meanUncertainty, toWorld } from '../lib/tail'

const UP = new THREE.Vector3(0, 1, 0)
const JET_MIN = 0.06
const JET_MAX = 1.5

// Soft radial falloff used for the coma and halo sprites.
function useGlowTexture() {
  return useMemo(() => {
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')!
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)')
    g.addColorStop(0.6, 'rgba(255,255,255,0.12)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    return new THREE.CanvasTexture(canvas)
  }, [])
}

// A cone with its base at the nucleus and its tip one unit out along +y.
function useJetGeometry() {
  return useMemo(() => new THREE.ConeGeometry(0.045, 1, 10, 1, true).translate(0, 0.5, 0), [])
}

interface Props {
  state: CometState | null
  isLoading: boolean
  demo: boolean
}

export interface CometHandle {
  group: THREE.Group | null
  color: THREE.Color
}

export const Comet = forwardRef<CometHandle, Props>(function Comet({ state, isLoading, demo }, ref) {
  const [hovered, setHovered] = useState(false)
  const group = useRef<THREE.Group>(null)
  const coma = useRef<THREE.Sprite>(null)
  const halo = useRef<THREE.Sprite>(null)
  const nucleus = useRef<THREE.MeshBasicMaterial>(null)
  const jets = useRef<(THREE.Mesh | null)[]>([])

  const color = useRef(new THREE.Color().setHSL(0.55, 0.6, 0.6))
  const targetColor = useMemo(() => new THREE.Color(), [])
  const targetPos = useMemo(() => new THREE.Vector3(), [])
  const glow = useRef({ energy: 1, spread: 1 })

  const glowTexture = useGlowTexture()
  const jetGeometry = useJetGeometry()
  const jetQuats = useMemo(
    () => DOMAINS.map((d) => new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(...d.direction).normalize())),
    [],
  )

  useImperativeHandle(ref, () => ({
    get group() {
      return group.current
    },
    color: color.current,
  }))

  useFrame(({ clock }, delta) => {
    const g = group.current
    if (!g) return
    const t = clock.getElapsedTime()

    if (demo || !state) {
      targetPos.set(Math.cos(t * 0.28) * 1.6, Math.sin(t * 0.17) * 1.0, Math.sin(t * 0.41) * 1.3)
      targetColor.setHSL((t * 0.055) % 1, 0.75, 0.65)
      easing.damp3(g.position, targetPos, 1.2, delta)
      easing.damp(glow.current, 'energy', 1, 0.5, delta)
      easing.damp(glow.current, 'spread', 0.6, 0.5, delta)
    } else {
      toWorld(state.personality, targetPos)
      emotionColor(state.emotion, targetColor)
      easing.damp3(g.position, targetPos, 0.6, delta)
      easing.damp(glow.current, 'energy', energyGlow(state.emotion.lightness), 0.6, delta)
      easing.damp(glow.current, 'spread', meanUncertainty(state.uncertainty), 0.6, delta)
    }
    easing.dampC(color.current, targetColor, 0.5, delta)

    const pulse = isLoading ? 0.75 + 0.25 * Math.sin(t * 5) : 1
    const { energy, spread } = glow.current

    if (nucleus.current) nucleus.current.color.copy(color.current).lerp(WHITE, 0.6).multiplyScalar(2.2 * energy * pulse)
    if (coma.current) {
      coma.current.scale.setScalar(0.55 + 0.35 * energy)
      ;(coma.current.material as THREE.SpriteMaterial).color.copy(color.current).multiplyScalar(1.3 * energy * pulse)
    }
    if (halo.current) {
      // An uncertain estimate is drawn as a wide, diffuse halo that tightens with evidence.
      halo.current.scale.setScalar(1.1 + 2.2 * spread)
      const m = halo.current.material as THREE.SpriteMaterial
      m.color.copy(color.current)
      m.opacity = (0.18 + 0.12 * (1 - spread)) * pulse
    }

    DOMAINS.forEach((d, i) => {
      const jet = jets.current[i]
      if (!jet) return
      const depth = demo || !state ? 0 : (state.interests[d.id] ?? 0)
      const target = depth > 0.01 ? JET_MIN + depth * (JET_MAX - JET_MIN) : 0.0001
      easing.damp(jet.scale, 'y', target, 0.8, delta)
      jet.visible = jet.scale.y > 0.002
      ;(jet.material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.2 * Math.sin(t * 3 + i * 1.7)
    })
  })

  const topInterests = state
    ? Object.entries(state.interests)
        .filter(([, d]) => d > 0.05)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    : []

  return (
    <group ref={group} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
      {/* Invisible hit area so hover is easy to trigger */}
      <mesh visible={false}>
        <sphereGeometry args={[0.6, 8, 4]} />
      </mesh>

      <mesh>
        <sphereGeometry args={[0.05, 16, 8]} />
        <meshBasicMaterial ref={nucleus} toneMapped={false} />
      </mesh>

      <Billboard>
        <sprite ref={halo}>
          <spriteMaterial map={glowTexture} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
        <sprite ref={coma}>
          <spriteMaterial map={glowTexture} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
      </Billboard>

      {DOMAINS.map((d, i) => (
        <mesh
          key={d.id}
          ref={(m) => {
            jets.current[i] = m
          }}
          geometry={jetGeometry}
          quaternion={jetQuats[i]}
          scale={[1, 0.0001, 1]}
          visible={false}
        >
          <meshBasicMaterial
            color={new THREE.Color(d.color).multiplyScalar(1.6)}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}

      {hovered && state && !demo && (
        <Html position={[0.6, 0.6, 0]} distanceFactor={7} zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
          <div className="nucleus-tooltip">
            <div className="nt-section">
              <div className="nt-label">position</div>
              {AXES.map((a) => {
                const v = state.personality[a.key]
                return (
                  <div key={a.key} className="nt-row">
                    <span style={{ color: a.color }}>{v >= 0 ? a.positive : a.negative}</span>
                    <span>
                      {Math.abs(v).toFixed(2)}
                      <span className="dim"> ±{Math.sqrt(state.uncertainty[a.key]).toFixed(2)}</span>
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="nt-divider" />

            <div className="nt-section">
              <div className="nt-label">emotion</div>
              <div className="nt-row">
                <div className="nt-swatch" style={{ background: emotionCss(state.emotion) }} />
                <span style={{ color: emotionCss(state.emotion) }}>
                  {state.emotion.hue.toFixed(0)}° · {(state.emotion.saturation * 100).toFixed(0)}% · energy{' '}
                  {(state.emotion.lightness * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {topInterests.length > 0 && (
              <>
                <div className="nt-divider" />
                <div className="nt-section">
                  <div className="nt-label">depth</div>
                  {topInterests.map(([domain, depth]) => (
                    <div key={domain} className="nt-row">
                      <span style={{ color: domainColor(domain), minWidth: 80 }}>{domain}</span>
                      <div className="nt-bar">
                        <div className="nt-bar-fill" style={{ width: `${depth * 100}%`, background: domainColor(domain) }} />
                      </div>
                      <span className="dim">{depth.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Html>
      )}
    </group>
  )
})

const WHITE = new THREE.Color('white')
