import { describe, expect, it } from 'vitest'
import { historyAt, lerpState } from '../playback'
import { INITIAL_STATE, type CometState } from '../schema'

const at = (x: number, hue: number, interests: Record<string, number> = {}): CometState => ({
  ...INITIAL_STATE,
  personality: { x, y: 0, z: 0 },
  emotion: { hue, saturation: 0.5, lightness: 0.5 },
  interests,
})

const history = [at(0.2, 60), at(0.6, 120, { music: 0.4 }), at(-0.2, 200)]

describe('historyAt', () => {
  it('returns the full history when live or past the end', () => {
    expect(historyAt(history, null)).toBe(history)
    expect(historyAt(history, 3)).toBe(history)
  })

  it('returns only the answers passed at whole-number playheads', () => {
    expect(historyAt(history, 0)).toEqual([])
    expect(historyAt(history, 2)).toEqual(history.slice(0, 2))
  })

  it('adds an interpolated state between answers', () => {
    const shown = historyAt(history, 1.5)
    expect(shown).toHaveLength(2)
    expect(shown[1].personality.x).toBeCloseTo(0.4)
    expect(shown[1].interests.music).toBeCloseTo(0.2)
  })

  it('starts the journey from the initial state', () => {
    expect(historyAt(history, 0.5)[0].personality.x).toBeCloseTo(0.1)
  })
})

describe('lerpState', () => {
  it('interpolates hue the short way round', () => {
    expect(lerpState(at(0, 350), at(0, 10), 0.5).emotion.hue).toBeCloseTo(0)
  })
})
