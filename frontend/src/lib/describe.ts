import type { Axis } from './spec'

// Plain-language readings, used instead of raw numbers outside chart mode.

/** "leaning introvert", "strongly creative", "balanced" … */
export function describeAxis(axis: Axis, value: number): string {
  const pole = value >= 0 ? axis.positive : axis.negative
  const magnitude = Math.abs(value)
  if (magnitude < 0.15) return `balanced ${axis.negative}–${axis.positive}`
  if (magnitude < 0.4) return `leaning ${pole}`
  if (magnitude < 0.7) return pole
  return `strongly ${pole}`
}

/** Hedge for an axis whose estimate is still loose (uncertainty is a variance, 0–1). */
export function certaintyNote(uncertainty: number): string | null {
  // A few cards on an axis bring the spread below ~0.6, so the hedge fades once
  // there is a real basis for the reading.
  const sd = Math.sqrt(uncertainty)
  if (sd > 0.85) return 'no read yet'
  if (sd > 0.6) return 'still forming'
  return null
}

// Named points on the emotion hue circle (matching the extractor's scale).
const FEELINGS: [number, string][] = [
  [0, 'frustrated'],
  [35, 'restless'],
  [60, 'joyful'],
  [95, 'hopeful'],
  [120, 'calm'],
  [165, 'content'],
  [200, 'reflective'],
  [235, 'wistful'],
  [270, 'anxious'],
  [315, 'tense'],
]

export function feelingName(hue: number): string {
  let best = FEELINGS[0]
  let bestDistance = Infinity
  for (const entry of FEELINGS) {
    const d = Math.abs(((hue - entry[0] + 540) % 360) - 180)
    if (d < bestDistance) {
      best = entry
      bestDistance = d
    }
  }
  return best[1]
}

/** "mildly calm, low energy" */
export function describeEmotion(e: { hue: number; saturation: number; lightness: number }): string {
  const intensity = e.saturation < 0.3 ? 'faintly ' : e.saturation < 0.6 ? 'mildly ' : e.saturation < 0.85 ? '' : 'intensely '
  const energy = e.lightness < 0.33 ? 'low energy' : e.lightness < 0.66 ? 'steady energy' : 'high energy'
  return `${intensity}${feelingName(e.hue)}, ${energy}`
}

export function describeDepth(depth: number): string {
  if (depth < 0.3) return 'curious'
  if (depth < 0.6) return 'into it'
  return 'deep in'
}

export function describeConfidence(confidence: number): string {
  if (confidence < 0.35) return 'faint signal'
  if (confidence < 0.7) return 'some signal'
  return 'clear signal'
}
