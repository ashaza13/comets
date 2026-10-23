import { describe, expect, it } from 'vitest'
import spec from '../../../../backend/app/spec.json'
import {
  canCheckIn,
  checkInDays,
  dailyStatement,
  dayNumber,
  formatCountdown,
  moodSquare,
  shareText,
  streak,
  untilNextCheckIn,
} from '../daily'
import { INITIAL_STATE, type Entry } from '../schema'
import { seedFrom } from '../seed'
import { STAR_BY_ID, STAR_TYPES, starType } from '../stars'
import { STATEMENTS } from '../statements'

const entry = (day: number | undefined, hue = 200, saturation = 0.6): Entry => ({
  id: `e${day}-${hue}`,
  kind: 'statement',
  text: '',
  prompt: null,
  observation: { personality: { x: null, y: null, z: null }, emotion: { hue: null, saturation: null, lightness: null }, interests: [], confidence: 0, reasoning: '' },
  state: { ...INITIAL_STATE, emotion: { hue, saturation, lightness: 0.5 } },
  day,
})

describe('days', () => {
  it('counts local calendar days from Day 1 on 1 October 2026', () => {
    expect(dayNumber(new Date(2026, 9, 1, 0, 1))).toBe(1)
    expect(dayNumber(new Date(2026, 9, 1, 23, 59))).toBe(1)
    expect(dayNumber(new Date(2026, 9, 22, 12))).toBe(22)
    // Across a daylight-saving change (late October in many zones) days stay whole.
    expect(dayNumber(new Date(2026, 10, 2, 0, 30)) - dayNumber(new Date(2026, 10, 1, 23, 30))).toBe(1)
  })

  it('opens the next check-in at local midnight', () => {
    const now = new Date(2026, 9, 22, 21, 30)
    expect(untilNextCheckIn(now)).toBe(150 * 60_000)
    expect(formatCountdown(150 * 60_000)).toBe('2h 30m')
    expect(formatCountdown(59_000)).toBe('1m')
  })
})

describe('the daily statement', () => {
  it('matches the backend, day for day', () => {
    // Pinned in backend/tests/test_daily.py too.
    expect(seedFrom('day-1')).toBe(1328657491)
    expect([1, 2, 3, 12, 13, 22, 100].map((d) => dailyStatement(d).id)).toEqual([
      'parties',
      'art',
      'abstract-interest',
      'vivid-imagination',
      'parties',
      'art',
      'talk-a-lot',
    ])
    expect(spec.statements).toEqual(STATEMENTS.map((s) => s.id))
    expect(spec.star_types).toEqual(STAR_TYPES.map((s) => s.id))
  })

  it('never repeats two days running and deals every statement each run', () => {
    for (let d = 1; d < 400; d++) expect(dailyStatement(d).id).not.toBe(dailyStatement(d - 1).id)
    const run = Array.from({ length: 12 }, (_, i) => dailyStatement(25 + i).id).sort()
    expect(run).toEqual(STATEMENTS.map((s) => s.id).sort())
  })
})

describe('streaks and check-ins', () => {
  it('counts consecutive days back from today, or yesterday if today is still to do', () => {
    expect(streak([3, 4, 5], 5)).toBe(3)
    expect(streak([3, 4, 5], 6)).toBe(3)
    expect(streak([3, 4, 5], 7)).toBe(0)
    expect(streak([1, 3, 4], 4)).toBe(2)
    expect(streak([], 4)).toBe(0)
  })

  it('knows whether today is done, ignoring entries without a day', () => {
    const entries = [entry(undefined), entry(20), entry(21)]
    expect(checkInDays(entries)).toEqual([20, 21])
    expect(canCheckIn(entries, 21)).toBe(false)
    expect(canCheckIn(entries, 22)).toBe(true)
  })
})

describe('star types', () => {
  it('names each octant, and the centre', () => {
    expect(starType({ x: 0.6, y: 0.4, z: 0.5 }).name).toBe('Supernova')
    expect(starType({ x: -0.6, y: -0.4, z: -0.5 }).name).toBe('Red Dwarf')
    expect(starType({ x: -0.3, y: 0.4, z: -0.2 }).name).toBe('White Dwarf')
    expect(starType({ x: 0.05, y: -0.1, z: 0.1 }).name).toBe('Binary Star')
    expect(new Set(STAR_TYPES.map((s) => s.id)).size).toBe(9)
  })
})

describe('share text', () => {
  it('reads like a daily result for a group chat', () => {
    const text = shareText({
      day: 43,
      star: STAR_BY_ID['blue-giant'],
      streak: 6,
      moods: [{ hue: 200, saturation: 0.7 }, { hue: 60, saturation: 0.8 }, { hue: 120, saturation: 0.1 }],
      statement: STATEMENTS[9],
      response: 4,
      agreed: 0.58,
      url: 'https://comets.example/',
    })
    expect(text.split('\n')).toEqual([
      'Comets · Day 43 🔵 Blue Giant',
      '🔥 6-day streak',
      `${moodSquare({ hue: 200, saturation: 0.7 })}${moodSquare({ hue: 60, saturation: 0.8 })}⬜`,
      '“I keep in the background.” → moderately accurate (58% same)',
      'https://comets.example/',
    ])
    expect(moodSquare({ hue: 60, saturation: 0.8 })).toBe('🟨')
  })
})
