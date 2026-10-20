import { describe, expect, it } from 'vitest'
import { AXES, DOMAINS, PROMPTS, isMapRevealed } from '../spec'

describe('spec', () => {
  it('defines the three axes in order', () => {
    expect(AXES.map((a) => a.key)).toEqual(['x', 'y', 'z'])
  })

  it('gives every domain a unique id and a unit direction', () => {
    expect(new Set(DOMAINS.map((d) => d.id)).size).toBe(DOMAINS.length)
    for (const d of DOMAINS) {
      expect(Math.hypot(...d.direction)).toBeCloseTo(1, 3)
    }
  })

  it('has prompts', () => {
    expect(PROMPTS.length).toBeGreaterThan(0)
  })
})

describe('isMapRevealed', () => {
  it('reveals the map only once every prompt is answered', () => {
    expect(isMapRevealed(0)).toBe(false)
    expect(isMapRevealed(PROMPTS.length - 1)).toBe(false)
    expect(isMapRevealed(PROMPTS.length)).toBe(true)
    expect(isMapRevealed(PROMPTS.length + 3)).toBe(true)
  })
})
