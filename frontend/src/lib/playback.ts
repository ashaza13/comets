import { INITIAL_STATE, type CometState } from './schema'

/**
 * The journey can be replayed: a playhead runs from 0 (before the first
 * answer) to N (after the last). Fractional values interpolate between answers.
 */

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpHue(a: number, b: number, t: number): number {
  const diff = ((b - a + 540) % 360) - 180
  return (a + diff * t + 360) % 360
}

export function lerpState(a: CometState, b: CometState, t: number): CometState {
  const domains = new Set([...Object.keys(a.interests), ...Object.keys(b.interests)])
  return {
    personality: {
      x: lerp(a.personality.x, b.personality.x, t),
      y: lerp(a.personality.y, b.personality.y, t),
      z: lerp(a.personality.z, b.personality.z, t),
    },
    uncertainty: {
      x: lerp(a.uncertainty.x, b.uncertainty.x, t),
      y: lerp(a.uncertainty.y, b.uncertainty.y, t),
      z: lerp(a.uncertainty.z, b.uncertainty.z, t),
    },
    emotion: {
      hue: lerpHue(a.emotion.hue, b.emotion.hue, t),
      saturation: lerp(a.emotion.saturation, b.emotion.saturation, t),
      lightness: lerp(a.emotion.lightness, b.emotion.lightness, t),
    },
    interests: Object.fromEntries([...domains].map((d) => [d, lerp(a.interests[d] ?? 0, b.interests[d] ?? 0, t)])),
    message_count: t < 1 ? a.message_count : b.message_count,
  }
}

/**
 * The history as it stood at the playhead: every answer already passed, plus an
 * interpolated state between the last one passed and the next. A null playhead
 * means "live" and returns the full history.
 */
export function historyAt(history: CometState[], playhead: number | null): CometState[] {
  if (playhead === null || playhead >= history.length) return history
  const p = Math.max(0, playhead)
  const passed = Math.floor(p)
  const t = p - passed
  if (t === 0) return history.slice(0, passed)
  const from = passed === 0 ? INITIAL_STATE : history[passed - 1]
  return [...history.slice(0, passed), lerpState(from, history[passed], t)]
}
