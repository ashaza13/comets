import { converter } from 'culori'
import { describe, expect, it } from 'vitest'
import { emotionRgb, energyGlow } from '../color'

const toOklch = converter('oklch')
const oklch = ([r, g, b]: [number, number, number]) => toOklch({ mode: 'rgb', r, g, b })

describe('emotionRgb', () => {
  it('keeps hue identity: joyful reads yellow, reflective reads blue', () => {
    const [r, g, b] = emotionRgb({ hue: 60, saturation: 1 })
    expect(r).toBeGreaterThan(b)
    expect(g).toBeGreaterThan(b)
    const [r2, , b2] = emotionRgb({ hue: 200, saturation: 1 })
    expect(b2).toBeGreaterThan(r2)
  })

  it('renders every hue at the same perceptual lightness', () => {
    const ls = [0, 60, 120, 200, 270].map((h) => oklch(emotionRgb({ hue: h, saturation: 0.8 })).l)
    for (const l of ls) expect(l).toBeCloseTo(ls[0], 1)
  })

  it('maps saturation to chroma', () => {
    const muted = oklch(emotionRgb({ hue: 120, saturation: 0 })).c ?? 0
    const vivid = oklch(emotionRgb({ hue: 120, saturation: 1 })).c ?? 0
    expect(vivid).toBeGreaterThan(muted * 3)
  })

  it('stays in gamut', () => {
    for (let h = 0; h < 360; h += 15) {
      for (const v of emotionRgb({ hue: h, saturation: 1 })) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('energyGlow', () => {
  it('keeps depleted moods visible and grows with energy', () => {
    expect(energyGlow(0)).toBeGreaterThan(0.3)
    expect(energyGlow(1)).toBeGreaterThan(energyGlow(0.2))
  })
})
