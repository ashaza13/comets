import { z } from 'zod'
import { request } from './groups'

// Mirrors backend/app/daily.py and app/reading.py.

export const TalliesSchema = z.object({
  day: z.number(),
  statement_id: z.string(),
  answers: z.record(z.string(), z.number()),
  stars: z.record(z.string(), z.number()),
  counted: z.boolean(),
})
export type Tallies = z.infer<typeof TalliesSchema>

export interface ReadingDay {
  day: number
  x: number
  y: number
  z: number
  hue: number
  saturation: number
  energy: number
  statement: string | null
  response: number | null
}

export const dailyApi = {
  tallies: (day: number) => request(`/daily/${day}`, TalliesSchema),
  answer: (day: number, statementId: string, response: number, starType: string) =>
    request(`/daily/${day}/answer`, TalliesSchema, {
      method: 'POST',
      body: JSON.stringify({ statement_id: statementId, response, star_type: starType }),
    }),
  reading: (days: ReadingDay[], starType: string, streak: number) =>
    request('/reading', z.object({ reading: z.string() }), {
      method: 'POST',
      body: JSON.stringify({ days, star_type: starType, streak }),
    }).then((r) => r.reading),
}

/** Share of everyone who gave `response`, 0–1, or null if no one has answered yet. */
export function shareOf(tallies: Tallies, response: number): number | null {
  const total = Object.values(tallies.answers).reduce((a, b) => a + b, 0)
  return total > 0 ? (tallies.answers[String(response)] ?? 0) / total : null
}

/** How common a star type is among check-ins, 0–1, or null with no data. */
export function rarity(tallies: Tallies, starId: string): number | null {
  const total = Object.values(tallies.stars).reduce((a, b) => a + b, 0)
  return total > 0 ? (tallies.stars[starId] ?? 0) / total : null
}
