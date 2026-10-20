import { describe, expect, it } from 'vitest'
import { CARDS, cardInformation, nextCard } from '../cards'
import { describeAxis, describeEmotion, feelingName } from '../describe'
import { CARD_STEPS, JOURNEY_STEPS, cardObservation, stepKind, topicsObservation } from '../journey'
import { AXES, DOMAIN_BY_ID } from '../spec'

describe('card bank', () => {
  it('has unique ids, distinct options and in-range loadings', () => {
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length)
    for (const card of CARDS) {
      expect(card.a.label).not.toBe(card.b.label)
      for (const v of [...Object.values(card.a.loadings), ...Object.values(card.b.loadings)]) {
        expect(Math.abs(v)).toBeLessThanOrEqual(1)
      }
      // Every card must separate its options on at least one axis.
      expect(cardInformation(card, { x: 1, y: 1, z: 1 })).toBeGreaterThan(0.5)
    }
  })

  it('has enough cards on every axis for a journey', () => {
    for (const axis of ['x', 'y', 'z'] as const) {
      expect(CARDS.filter((c) => Math.abs((c.a.loadings[axis] ?? 0) - (c.b.loadings[axis] ?? 0)) >= 0.8).length).toBeGreaterThanOrEqual(CARD_STEPS / 2)
    }
  })
})

describe('nextCard', () => {
  it('targets the axis we are least sure about and never repeats', () => {
    const card = nextCard(new Set(), { x: 0.05, y: 0.05, z: 1 })!
    expect(Math.abs(card.a.loadings.z ?? 0)).toBeGreaterThan(0)
    expect(nextCard(new Set([card.id]), { x: 0.05, y: 0.05, z: 1 })!.id).not.toBe(card.id)
    expect(nextCard(new Set(CARDS.map((c) => c.id)), { x: 1, y: 1, z: 1 })).toBeNull()
  })
})

describe('journey steps', () => {
  it('runs mood, cards, then topics', () => {
    expect(stepKind(0)).toBe('mood')
    expect(stepKind(1)).toBe('card')
    expect(stepKind(CARD_STEPS)).toBe('card')
    expect(stepKind(CARD_STEPS + 1)).toBe('topics')
    expect(stepKind(JOURNEY_STEPS)).toBeNull()
  })

  it('turns a card choice into readings on only the axes it speaks to', () => {
    const card = CARDS.find((c) => c.id === 'toy')!
    const obs = cardObservation(card, card.b)
    expect(obs.personality).toEqual({ x: null, y: null, z: 0.7 })
    expect(obs.reasoning).toContain('A box of paints')
  })

  it('reports picked topics with their depth', () => {
    expect(topicsObservation({ music: 2, art: 0 }).interests).toEqual([
      { domain: 'music', depth: 0.95 },
      { domain: 'art', depth: 0.35 },
    ])
    expect(DOMAIN_BY_ID.music).toBeDefined()
  })
})

describe('plain-language readings', () => {
  it('describes axis positions', () => {
    const x = AXES[0]
    expect(describeAxis(x, 0.05)).toBe('balanced introvert–extrovert')
    expect(describeAxis(x, -0.3)).toBe('leaning introvert')
    expect(describeAxis(x, 0.55)).toBe('extrovert')
    expect(describeAxis(x, 0.9)).toBe('strongly extrovert')
  })

  it('names feelings around the wheel and describes emotion', () => {
    expect(feelingName(358)).toBe('frustrated')
    expect(feelingName(118)).toBe('calm')
    expect(describeEmotion({ hue: 200, saturation: 0.4, lightness: 0.2 })).toBe('mildly reflective, low energy')
  })
})

describe('certaintyNote', () => {
  it('hedges only until a few answers have landed on an axis', async () => {
    const { certaintyNote } = await import('../describe')
    expect(certaintyNote(1)).toBe('no read yet')
    expect(certaintyNote(0.5)).toBe('still forming')
    expect(certaintyNote(0.25)).toBeNull()
  })
})
