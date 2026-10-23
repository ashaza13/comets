import { create } from 'zustand'
import { dailyApi, type ReadingDay, type Tallies } from './lib/dailyApi'

interface DailyStore {
  /** Today's anonymous tallies, once fetched (null when sharing is off). */
  tallies: Tallies | null
  reading: { day: number; text: string } | null
  readingFailed: boolean
  /** Count today's answer (once per device) and fetch the tallies. */
  submit: (day: number, statementId: string, response: number | null, starType: string) => Promise<void>
  /** Fetch today's reading, unless already cached for the day. */
  loadReading: (day: number, days: ReadingDay[], starType: string, streak: number) => Promise<void>
}

const TALLIED = (day: number) => `comets:tallied:${day}`
const READING = (day: number) => `comets:reading:${day}`

// Storage can be unavailable (private windows, blocked site data): treat it as empty.
const read = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Not cached; the server's own once-a-day rule still holds.
  }
}

export const useDaily = create<DailyStore>()((set, get) => ({
  tallies: null,
  reading: null,
  readingFailed: false,

  submit: async (day, statementId, response, starType) => {
    try {
      const counted = read(TALLIED(day)) === '1'
      const tallies =
        response !== null && !counted ? await dailyApi.answer(day, statementId, response, starType) : await dailyApi.tallies(day)
      if (response !== null) write(TALLIED(day), '1')
      set({ tallies })
    } catch {
      set({ tallies: null })
    }
  },

  loadReading: async (day, days, starType, streak) => {
    if (get().reading?.day === day) return
    const cached = read(READING(day))
    if (cached) {
      set({ reading: { day, text: cached }, readingFailed: false })
      return
    }
    try {
      const text = await dailyApi.reading(days, starType, streak)
      write(READING(day), text)
      set({ reading: { day, text }, readingFailed: false })
    } catch {
      set({ readingFailed: true })
    }
  },
}))
