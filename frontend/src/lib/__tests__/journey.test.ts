import { describe, expect, it } from 'vitest'
import { describeAxis, describeEmotion, feelingName } from '../describe'
import { applyObservation } from '../estimate'
import { JOURNEY_STEPS, STATEMENT_STEPS, answeredStatements, statementObservation, stepKind, topicsObservation } from '../journey'
import { INITIAL_STATE, type Entry } from '../schema'
import { AXES, DOMAIN_BY_ID } from '../spec'
import { STATEMENTS, nextStatement, statementReading, statementText } from '../statements'

describe('statement bank', () => {
  it('has unique ids and four statements per axis, two keyed each way', () => {
    expect(new Set(STATEMENTS.map((s) => s.id)).size).toBe(STATEMENTS.length)
    for (const axis of ['x', 'y', 'z'] as const) {
      const items = STATEMENTS.filter((s) => s.axis === axis)
      expect(items).toHaveLength(4)
      expect(items.filter((s) => s.key === 1)).toHaveLength(2)
    }
  })

  it('shows each item in the first person', () => {
    expect(statementText(STATEMENTS[0])).toBe('I am the life of the party.')
  })

  it('never puts two statements for the same axis side by side', () => {
    for (let i = 1; i < STATEMENTS.length; i++) expect(STATEMENTS[i].axis).not.toBe(STATEMENTS[i - 1].axis)
  })
})

describe('scoring', () => {
  it('maps the five responses onto the axis, reversing negatively keyed items', () => {
    const positive = STATEMENTS.find((s) => s.key === 1)!
    const negative = STATEMENTS.find((s) => s.key === -1)!
    expect([1, 2, 3, 4, 5].map((r) => statementReading(positive, r))).toEqual([-1, -0.5, 0, 0.5, 1])
    expect(statementReading(negative, 5)).toBe(-1)
  })

  it('reads only the statement’s own axis, and nothing when skipped', () => {
    const s = STATEMENTS.find((st) => st.id === 'art')!
    expect(statementObservation(s, 5).personality).toEqual({ x: null, y: null, z: 1 })
    expect(statementObservation(s, 5).reasoning).toContain('very accurate')
    const skipped = statementObservation(s, null)
    expect(skipped.personality).toEqual({ x: null, y: null, z: null })
    expect(skipped.confidence).toBe(0)
  })

  it('agreeing with every statement leaves the comet near the centre', () => {
    let state = INITIAL_STATE
    for (const s of STATEMENTS) state = applyObservation(state, statementObservation(s, 5))
    for (const axis of ['x', 'y', 'z'] as const) expect(Math.abs(state.personality[axis])).toBeLessThan(0.35)
  })

  it('a consistent extravert lands far out on x with a firm estimate', () => {
    let state = INITIAL_STATE
    for (const s of STATEMENTS.filter((st) => st.axis === 'x')) state = applyObservation(state, statementObservation(s, s.key === 1 ? 5 : 1))
    expect(state.personality.x).toBeGreaterThan(0.8)
    expect(Math.sqrt(state.uncertainty.x)).toBeLessThan(0.45)
  })
})

describe('journey steps', () => {
  it('runs mood, statements, then topics', () => {
    expect(stepKind(0)).toBe('mood')
    expect(stepKind(1)).toBe('statement')
    expect(stepKind(STATEMENT_STEPS)).toBe('statement')
    expect(stepKind(STATEMENT_STEPS + 1)).toBe('topics')
    expect(stepKind(JOURNEY_STEPS)).toBeNull()
  })

  it('asks each statement once, in order', () => {
    const first = nextStatement(new Set())!
    expect(first.id).toBe(STATEMENTS[0].id)
    const entries = [{ statementId: first.id } as Entry]
    expect(nextStatement(answeredStatements(entries))!.id).toBe(STATEMENTS[1].id)
    expect(nextStatement(new Set(STATEMENTS.map((s) => s.id)))).toBeNull()
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
