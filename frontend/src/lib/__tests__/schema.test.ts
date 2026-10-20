import { describe, expect, it } from 'vitest'
import { ObserveResponseSchema } from '../schema'

describe('ObserveResponseSchema', () => {
  it('accepts a backend response and rejects a malformed one', () => {
    const ok = {
      observation: {
        personality: { x: 0.4, y: null, z: null },
        emotion: { hue: 60, saturation: 0.8, lightness: null },
        interests: [{ domain: 'music', depth: 0.6 }],
        confidence: 0.7,
        reasoning: 'r',
      },
      state: {
        personality: { x: 0.2, y: 0, z: 0 },
        uncertainty: { x: 0.5, y: 1, z: 1 },
        emotion: { hue: 120, saturation: 0.5, lightness: 0.5 },
        interests: { music: 0.2 },
        message_count: 1,
      },
      next_prompt: null,
    }
    expect(ObserveResponseSchema.parse(ok)).toEqual(ok)
    expect(ObserveResponseSchema.safeParse({ ...ok, state: {} }).success).toBe(false)
  })
})
