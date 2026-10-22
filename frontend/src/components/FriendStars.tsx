import { useMemo } from 'react'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { emotionColor } from '../lib/emotionColor'
import type { Member } from '../lib/groups'
import { toWorld } from '../lib/tail'
import { createGlowTexture } from '../lib/textures'

interface Props {
  /** Everyone in the constellation except you. */
  friends: Member[]
  visible: boolean
}

/** Friends from a shared constellation, each a star in their mood's colour with their name. */
export function FriendStars({ friends, visible }: Props) {
  const glow = useMemo(() => createGlowTexture(64), [])
  if (!visible) return null
  return (
    <group>
      {friends.map((f) => (
        <group key={f.id} position={toWorld(f.personality)}>
          {/* Screen-sized, like the axis stars, so friends read from the map's distance. */}
          <sprite scale={0.034}>
            <spriteMaterial
              map={glow}
              color={emotionColor(f.emotion).multiplyScalar(1.5)}
              sizeAttenuation={false}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </sprite>
          <sprite scale={0.009}>
            <spriteMaterial map={glow} color="white" sizeAttenuation={false} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </sprite>
          <Html center zIndexRange={[12, 0]} style={{ pointerEvents: 'none' }}>
            <div className="friend-label">{f.name}</div>
          </Html>
        </group>
      ))}
    </group>
  )
}
