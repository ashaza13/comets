import { useMemo, useState } from 'react'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { emotionColor, emotionCss } from '../lib/color'
import type { Entry } from '../lib/schema'
import { AXES } from '../lib/spec'
import { toWorld } from '../lib/tail'
import { createGlowTexture } from '../lib/textures'

const clip = (text: string, max: number) => (text.length > max ? text.slice(0, max - 1) + '…' : text)

interface Props {
  /** Answers to mark, oldest first. */
  entries: Entry[]
  /** Total answers in the journey, for the "3 of 7" label. */
  total: number
  /** Hover cards are enabled once the map is revealed. */
  interactive: boolean
  /** Reports whether any memory card is open, so other tooltips can step aside. */
  onHoverChange?: (hovering: boolean) => void
}

/** A small star left at each past answer; hover one to read it back. */
export function MemoryStars({ entries, total, interactive, onHoverChange }: Props) {
  const glow = useMemo(() => createGlowTexture(64), [])
  const [hovered, setHoveredState] = useState<string | null>(null)
  const setHovered = (next: string | null) => {
    setHoveredState(next)
    onHoverChange?.(next !== null)
  }

  return (
    <group>
      {entries.map((entry, i) => {
        const position = toWorld(entry.state.personality)
        const color = emotionColor(entry.state.emotion).multiplyScalar(1.6)
        const isHovered = interactive && hovered === entry.id
        return (
          <group key={entry.id} position={position}>
            {/* Screen-sized (no attenuation) so the stars stay visible from the map's distance. */}
            <sprite scale={isHovered ? 0.05 : 0.032}>
              <spriteMaterial map={glow} color={color} sizeAttenuation={false} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
            </sprite>
            <sprite scale={0.01}>
              <spriteMaterial map={glow} color="white" sizeAttenuation={false} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
            </sprite>
            {interactive && (
              <mesh
                visible={false}
                onPointerOver={(e) => {
                  e.stopPropagation()
                  setHovered(entry.id)
                }}
                onPointerOut={() => {
                  if (hovered === entry.id) setHovered(null)
                }}
              >
                <sphereGeometry args={[0.9, 8, 6]} />
              </mesh>
            )}
            {isHovered && (
              <Html position={[0.25, 0.25, 0]} zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
                <div className="nucleus-tooltip memory-card">
                  <div className="nt-label">
                    answer {i + 1} of {total}
                  </div>
                  {entry.prompt && <div className="memory-prompt">{clip(entry.prompt, 90)}</div>}
                  <div className="memory-text">“{clip(entry.text, 180)}”</div>
                  <div className="nt-divider" />
                  <div className="nt-row">
                    <div className="nt-swatch" style={{ background: emotionCss(entry.state.emotion) }} />
                    <span className="memory-reading">{entry.observation.reasoning}</span>
                  </div>
                  <div className="memory-axes">
                    {AXES.filter((a) => entry.observation.personality[a.key] !== null).map((a) => {
                      const v = entry.observation.personality[a.key]!
                      return (
                        <span key={a.key} style={{ color: a.color }}>
                          {v >= 0 ? a.positive : a.negative}
                        </span>
                      )
                    })}
                  </div>
                </div>
              </Html>
            )}
          </group>
        )
      })}
    </group>
  )
}
