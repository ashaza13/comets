import { emotionRgb } from './color'
import { mulberry32, seedFrom } from './seed'
import type { Entry } from './schema'
import { RESPONSES, STATEMENTS, statementText, type Statement } from './statements'
import type { StarType } from './stars'

/**
 * The daily orbit: after the first full journey, a short check-in each day
 * (mood plus one statement, the same statement for everyone that day). Days
 * are counted by the user's local calendar from a launch epoch, like Wordle.
 */
const EPOCH = Date.UTC(2026, 9, 1) // 1 October 2026 is Day 1
const DAY_MS = 86_400_000

/** Today's number in the user's local calendar (Day 1 = the epoch). */
export function dayNumber(date: Date): number {
  const local = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.round((local - EPOCH) / DAY_MS) + 1
}

/** The statements in a seeded shuffled order for one run of days. */
function deck(block: number): Statement[] {
  const order = [...STATEMENTS]
  const rand = mulberry32(seedFrom(`deck-${block}`))
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

/**
 * The statement everyone rates on `day` (the backend's app/daily.py agrees).
 * The statements are dealt like a shuffled deck, one per day, so each comes
 * round once per run of days, and a new deck never starts with the card the
 * last one ended on.
 */
export function dailyStatement(day: number): Statement {
  const n = STATEMENTS.length
  const block = Math.floor((day - 1) / n)
  const index = (((day - 1) % n) + n) % n
  const order = deck(block)
  if (order[0] === deck(block - 1)[n - 1]) [order[0], order[1]] = [order[1], order[0]]
  return order[index]
}

/**
 * The days the user checked in (including the journey's day), ascending. A day
 * counts once a statement was answered (or skipped) that day, not just the mood.
 */
export function checkInDays(entries: Entry[]): number[] {
  const days = entries.flatMap((e) => (e.day !== undefined && e.kind === 'statement' ? [e.day] : []))
  return [...new Set(days)].sort((a, b) => a - b)
}

/** Your answer to `day`'s statement (1–5), null if skipped, undefined if not given. */
export function dailyResponse(entries: Entry[], day: number): number | null | undefined {
  const id = dailyStatement(day).id
  const answer = entries.findLast((e) => e.day === day && e.kind === 'statement' && e.statementId === id)
  if (!answer) return undefined
  const i = RESPONSES.indexOf(answer.text as (typeof RESPONSES)[number])
  return i >= 0 ? i + 1 : null
}

/** Today's check-in so far: whether the mood is in yet. */
export function moodDoneToday(entries: Entry[], today: number): boolean {
  return entries.some((e) => e.day === today && e.kind === 'mood')
}

/** The comet as each check-in day ended, oldest first (for the reading). */
export function dayEnds(entries: Entry[]): { day: number; entry: Entry }[] {
  const byDay = new Map<number, Entry>()
  for (const e of entries) if (e.day !== undefined) byDay.set(e.day, e)
  const days = new Set(checkInDays(entries))
  return [...byDay.entries()].filter(([d]) => days.has(d)).sort((a, b) => a[0] - b[0]).map(([day, entry]) => ({ day, entry }))
}

/** Consecutive days of check-ins, counting back from today (or yesterday, if today isn't done yet). */
export function streak(days: number[], today: number): number {
  const set = new Set(days)
  let d = set.has(today) ? today : today - 1
  let n = 0
  while (set.has(d)) {
    n++
    d--
  }
  return n
}

/** Whether today's check-in is still to do. */
export function canCheckIn(entries: Entry[], today: number): boolean {
  return !checkInDays(entries).includes(today)
}

/** Milliseconds until local midnight, when the next check-in opens. */
export function untilNextCheckIn(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return next.getTime() - now.getTime()
}

export function formatCountdown(ms: number): string {
  const minutes = Math.max(0, Math.ceil(ms / 60_000))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// Mood colours as the nearest coloured square, for the share text.
const SQUARES: [string, [number, number, number]][] = [
  ['🟥', [0.86, 0.36, 0.33]],
  ['🟧', [0.92, 0.6, 0.3]],
  ['🟨', [0.92, 0.84, 0.4]],
  ['🟩', [0.45, 0.78, 0.45]],
  ['🟦', [0.4, 0.6, 0.92]],
  ['🟪', [0.66, 0.5, 0.9]],
]

export function moodSquare(emotion: { hue: number; saturation: number }): string {
  if (emotion.saturation < 0.2) return '⬜'
  const [r, g, b] = emotionRgb(emotion)
  let best = SQUARES[0]
  let bestD = Infinity
  for (const sq of SQUARES) {
    const [sr, sg, sb] = sq[1]
    const d = (r - sr) ** 2 + (g - sg) ** 2 + (b - sb) ** 2
    if (d < bestD) {
      best = sq
      bestD = d
    }
  }
  return best[0]
}

/** The mood each check-in day ended on, oldest first, for the last `count` days. */
export function recentMoods(entries: Entry[], count = 7): { hue: number; saturation: number }[] {
  const byDay = new Map<number, { hue: number; saturation: number }>()
  for (const e of entries) if (e.day !== undefined) byDay.set(e.day, e.state.emotion)
  return [...byDay.entries()].sort((a, b) => a[0] - b[0]).slice(-count).map(([, mood]) => mood)
}

interface ShareInput {
  day: number
  star: StarType
  streak: number
  moods: { hue: number; saturation: number }[]
  statement: Statement
  /** Today's game as emoji (e.g. "Know your crew" 🎯🟡⏳ 4/6), once played. */
  game: { label: string; emojis: string } | null
  url: string
}

/**
 * The Wordle-style result to paste into a group chat. It never gives away your
 * own answer, since that's what friends are guessing.
 */
export function shareText({ day, star, streak, moods, statement, game, url }: ShareInput): string {
  const lines = [`Comets · Day ${day} ${star.emoji} ${star.name}`]
  if (game) lines.push(`${game.label} ${game.emojis}`)
  if (streak > 1) lines.push(`🔥 ${streak}-day streak`)
  if (moods.length) lines.push(moods.map(moodSquare).join(''))
  lines.push(`“${statementText(statement)}” What would I say?`)
  lines.push(url)
  return lines.join('\n')
}
