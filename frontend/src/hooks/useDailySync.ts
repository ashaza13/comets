import { useEffect, useMemo } from 'react'
import { useDaily } from '../dailyStore'
import { checkInDays, dailyResponse, dailyStatement, dayEnds, streak as streakOf } from '../lib/daily'
import type { ReadingDay } from '../lib/dailyApi'
import type { Entry } from '../lib/schema'
import { starType } from '../lib/stars'

/**
 * Once today's check-in is done (the first journey counts), count today's
 * answer in the anonymous tallies and fetch the day's reading.
 */
export function useDailySync(entries: Entry[], today: number, checkedIn: boolean) {
  const submit = useDaily((s) => s.submit)
  const loadReading = useDaily((s) => s.loadReading)
  const state = entries.at(-1)?.state ?? null
  const star = state ? starType(state.personality).id : null
  const response = dailyResponse(entries, today)

  const days = useMemo<ReadingDay[]>(
    () =>
      dayEnds(entries)
        .slice(-14)
        .map(({ day, entry }) => {
          const r = dailyResponse(entries, day)
          return {
            day,
            ...entry.state.personality,
            hue: entry.state.emotion.hue,
            saturation: entry.state.emotion.saturation,
            energy: entry.state.emotion.lightness,
            statement: r === undefined ? null : dailyStatement(day).id,
            response: r ?? null,
          }
        }),
    [entries],
  )
  const streak = streakOf(checkInDays(entries), today)

  useEffect(() => {
    if (!checkedIn || !star || response === undefined) return
    void submit(today, dailyStatement(today).id, response, star)
  }, [checkedIn, star, response, today, submit])

  useEffect(() => {
    if (!checkedIn || !star || days.length === 0) return
    void loadReading(today, days, star, streak)
  }, [checkedIn, star, days, today, streak, loadReading])
}
