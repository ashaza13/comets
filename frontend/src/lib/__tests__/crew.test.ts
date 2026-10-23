import { describe, expect, it } from 'vitest'
import { crewScore, knowScore, knowsYouBest, pickFriends, roundEmoji, type Bond } from '../crew'

const friends = Array.from({ length: 8 }, (_, i) => ({ id: `f${i}`, name: `Friend ${i}` }))

describe('picking friends to guess', () => {
  it('draws up to three, the same all day, whatever order the list comes in', () => {
    const today = pickFriends(friends, 24, 'me')
    expect(today).toHaveLength(3)
    expect(new Set(today.map((f) => f.id)).size).toBe(3)
    expect(pickFriends([...friends].reverse(), 24, 'me')).toEqual(today)
  })

  it('rotates through the crew over the days', () => {
    const seen = new Set<string>()
    for (let day = 1; day <= 14; day++) for (const f of pickFriends(friends, day, 'me')) seen.add(f.id)
    expect(seen.size).toBe(friends.length)
  })

  it('takes everyone in a small crew', () => {
    expect(pickFriends(friends.slice(0, 2), 5, 'me')).toHaveLength(2)
  })
})

describe('scoring', () => {
  it('marks each round', () => {
    expect(roundEmoji({ actual: 4, points: 3 })).toBe('🎯')
    expect(roundEmoji({ actual: 4, points: 1 })).toBe('🟡')
    expect(roundEmoji({ actual: 4, points: 0 })).toBe('⬛')
    expect(roundEmoji({ actual: null, points: null })).toBe('⏳')
    expect(roundEmoji({ actual: 0, points: null })).toBe('⬜')
  })

  it('adds up revealed rounds only', () => {
    const g = (actual: number | null, points: number | null) => ({ target: 't', guess: 3, actual, points })
    expect(crewScore([g(3, 3), g(4, 1), g(null, null), g(0, null)])).toEqual({ points: 4, scored: 2, pending: 1 })
  })

  it('says how well you know each other', () => {
    expect(knowScore(7, 9)).toBe('7/9')
    expect(knowScore(0, 0)).toBeNull()
    const bond = (id: string, knows: number, max: number): Bond => ({
      member_id: id,
      you_know: 0,
      you_max: 0,
      knows_you: knows,
      knows_you_max: max,
    })
    expect(knowsYouBest([bond('a', 2, 3), bond('b', 5, 6), bond('c', 0, 0)])?.member_id).toBe('b')
    // On a tie, the friend with more rounds behind them.
    expect(knowsYouBest([bond('a', 3, 3), bond('b', 9, 9)])?.member_id).toBe('b')
    expect(knowsYouBest([bond('a', 0, 0)])).toBeNull()
  })
})
