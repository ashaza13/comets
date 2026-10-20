import { clampChroma, converter } from 'culori'
import * as THREE from 'three'
import type { CometState } from './schema'

type Emotion = CometState['emotion']

const toOklch = converter('oklch')
const toRgb = converter('rgb')

// The emotion hue scale (0 red · 60 yellow · 120 green · 200 blue · 270 violet)
// is defined in HSL degrees. We keep that hue identity but render in OKLCH at a
// fixed perceptual lightness, so yellow no longer looks brighter than blue and
// saturation reads as intensity rather than as a brightness change.
const COMA_LIGHTNESS = 0.8
const MIN_CHROMA = 0.02
const MAX_CHROMA = 0.19

export function emotionRgb({ hue, saturation }: Pick<Emotion, 'hue' | 'saturation'>): [number, number, number] {
  const h = toOklch({ mode: 'hsl', h: hue, s: 1, l: 0.5 })?.h ?? 0
  const c = MIN_CHROMA + (MAX_CHROMA - MIN_CHROMA) * Math.min(Math.max(saturation, 0), 1)
  const rgb = toRgb(clampChroma({ mode: 'oklch', l: COMA_LIGHTNESS, c, h }, 'oklch'))
  return [clamp01(rgb.r), clamp01(rgb.g), clamp01(rgb.b)]
}

export function emotionColor(emotion: Pick<Emotion, 'hue' | 'saturation'>, target = new THREE.Color()): THREE.Color {
  const [r, g, b] = emotionRgb(emotion)
  // culori returns sRGB; THREE.Color stores linear values.
  return target.setRGB(r, g, b, THREE.SRGBColorSpace)
}

export function emotionCss(emotion: Pick<Emotion, 'hue' | 'saturation'>): string {
  const [r, g, b] = emotionRgb(emotion).map((v) => Math.round(v * 255))
  return `rgb(${r} ${g} ${b})`
}

// Energy drives how hard the comet burns rather than how dark its colour is,
// so a depleted mood stays visible, just dimmer and smaller.
export function energyGlow(lightness: number): number {
  return 0.45 + 1.1 * Math.min(Math.max(lightness, 0), 1)
}

function clamp01(v: number): number {
  return Math.min(Math.max(v, 0), 1)
}
