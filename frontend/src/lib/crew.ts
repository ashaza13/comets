import { z } from 'zod'
import { request } from './groups'
import { mulberry32, seedFrom } from './seed'
import type { Tallies } from './dailyApi'

/**
 * Know your crew: each day you answer the day's statement, then guess how a few
 * friends in your constellation answered it. Mirrors backend/app/crew.py.
 * Without friends yet, you guess the crowd instead.
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
})

export type Guess = z.infer<typeof GuessSchema>
export type CrewDay = z.infer<typeof CrewDaySchema>

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

// ── Solo: guess the crowd ──────────────────────────────────────────────────────

/** Share of everyone today who called the statement accurate (4 or 5), 0–1. */
export function crowdAgreed(tallies: Tallies): number | null {
  const total = Object.values(tallies.answers).reduce((a, b) => a + b, 0)
  if (total === 0) return null
  return ((tallies.answers['4'] ?? 0) + (tallies.answers['5'] ?? 0)) / total
}

/** Points for guessing `guess` percent when it was `actual` (0–1): within 5 points 🎯, within 15 🟡. */
export function crowdPoints(guess: number, actual: number): number {
  const off = Math.abs(guess - actual * 100)
  return off <= 5 ? MAX_POINTS : off <= 15 ? 1 : 0
}
