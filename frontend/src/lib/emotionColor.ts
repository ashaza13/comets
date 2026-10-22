import * as THREE from 'three'
import { emotionRgb, type Emotion } from './color'

export function emotionColor(emotion: Pick<Emotion, 'hue' | 'saturation'>, target = new THREE.Color()): THREE.Color {
  const [r, g, b] = emotionRgb(emotion)
  // culori returns sRGB; THREE.Color stores linear values.
  return target.setRGB(r, g, b, THREE.SRGBColorSpace)
}
