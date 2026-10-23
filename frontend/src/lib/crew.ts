import { z } from 'zod'
import { request } from './groups'
import { mulberry32, seedFrom } from './seed'

/**
 * Know your crew: each day you answer the day's statement, then guess what a
 * few friends in your constellation would say to it. Over the weeks it adds up
 * to how well you know each friend, and how well each of them knows you.
 * Mirrors backend/app/crew.py.
 */

export const GuessSchema = z.object({
  target: z.string(),
  guess: z.number(),
  /** The friend's answer once given: 0 if they skipped, null while pending. */
  actual: z.number().nullable(),
  points: z.number().nullable(),
})

export const CrewDaySchema = z.object({
  day: z.number(),
  statement_id: z.string(),
  answered: z.array(z.string()),
  my_answer: z.number().nullable(),
  guesses: z.array(GuessSchema),
  board: z.array(z.object({ member_id: z.string(), today: z.number(), week: z.number() })),
  bonds: z.array(
    z.object({
      member_id: z.string(),
      you_know: z.number(),
      you_max: z.number(),
      knows_you: z.number(),
      knows_you_max: z.number(),
    }),
  ),
})

export type Guess = z.infer<typeof GuessSchema>
export type CrewDay = z.infer<typeof CrewDaySchema>
export type Bond = CrewDay['bonds'][number]

const dayPath = (groupId: string, secret: string, day: number) => `/groups/${groupId}/members/${secret}/days/${day}`

export const crewApi = {
  get: (groupId: string, secret: string, day: number) => request(dayPath(groupId, secret, day), CrewDaySchema),
  answer: (groupId: string, secret: string, day: number, response: number | null) =>
    request(`${dayPath(groupId, secret, day)}/answer`, CrewDaySchema, { method: 'PUT', body: JSON.stringify({ response }) }),
  guess: (groupId: string, secret: string, day: number, target: string, guess: number) =>
    request(`${dayPath(groupId, secret, day)}/guesses/${target}`, CrewDaySchema, {
      method: 'PUT',
      body: JSON.stringify({ guess }),
    }),
}

/** How many friends you guess each day. */
export const ROUNDS = 3
export const MAX_POINTS = 3

/**
 * Today's friends to guess: up to three, a different draw each day (and for each
 * guesser), so a big constellation rotates through everyone.
 */
export function pickFriends<T extends { id: string }>(friends: T[], day: number, me: string, n = ROUNDS): T[] {
  const rand = mulberry32(seedFrom(`crew-${day}-${me}`))
  const keyed = [...friends].sort((a, b) => a.id.localeCompare(b.id)).map((f) => ({ f, k: rand() }))
  return keyed
    .sort((a, b) => a.k - b.k)
    .slice(0, n)
    .map(({ f }) => f)
}

/** One emoji per round for the share text: 🎯 exact, 🟡 one off, ⬛ miss, ⏳ pending, ⬜ void. */
export function roundEmoji(g: Pick<Guess, 'actual' | 'points'>): string {
  if (g.actual === null) return '⏳'
  if (g.points === null) return '⬜'
  return g.points >= MAX_POINTS ? '🎯' : g.points > 0 ? '🟡' : '⬛'
}

export function crewScore(guesses: Guess[]): { points: number; scored: number; pending: number } {
  return {
    points: guesses.reduce((sum, g) => sum + (g.points ?? 0), 0),
    scored: guesses.filter((g) => g.points !== null).length,
    pending: guesses.filter((g) => g.actual === null).length,
  }
}

/** How well one of you knows the other, as "7/9", or null before any guess has been revealed. */
export function knowScore(points: number, max: number): string | null {
  return max > 0 ? `${points}/${max}` : null
}

/** The friend who knows you best (by share of points, then by rounds played), if anyone has scored. */
export function knowsYouBest(bonds: Bond[]): Bond | null {
  const scored = bonds.filter((b) => b.knows_you_max > 0)
  if (scored.length === 0) return null
  return scored.reduce((best, b) => {
    const share = b.knows_you / b.knows_you_max
    const bestShare = best.knows_you / best.knows_you_max
    return share > bestShare || (share === bestShare && b.knows_you_max > best.knows_you_max) ? b : best
  })
}
