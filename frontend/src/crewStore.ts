import { create } from 'zustand'
import { useConstellation } from './groupStore'
import { crewApi, type CrewDay } from './lib/crew'

interface CrewStore {
  /** Today in your constellation, once loaded. */
  data: CrewDay | null
  busy: boolean
  error: string | null
  load: (day: number) => Promise<void>
  /** Share your own answer with the crew (final once given). */
  answer: (day: number, response: number | null) => Promise<void>
  guess: (day: number, target: string, guess: number) => Promise<void>
  /** Your guess at the crowd, by day, kept on this device. */
  crowd: Record<number, number>
  guessCrowd: (day: number, percent: number) => void
}

const CROWD = (day: number) => `comets:crowd:${day}`

function readCrowd(day: number): number | undefined {
  try {
    const v = localStorage.getItem(CROWD(day))
    return v === null ? undefined : Number(v)
  } catch {
    return undefined
  }
}

export const useCrew = create<CrewStore>()((set, get) => {
  // Every call needs your membership; without one there's no crew to play with.
  const call = async (run: (groupId: string, secret: string) => Promise<CrewDay>) => {
    const membership = useConstellation.getState().membership
    if (!membership) {
      set({ data: null })
      return
    }
    try {
      const data = await run(membership.id, membership.secret)
      // Ignore a response for a constellation we've since left.
      if (useConstellation.getState().membership?.id === membership.id) set({ data, error: null })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Something went wrong.' })
    }
  }

  return {
    data: null,
    busy: false,
    error: null,
    crowd: {},

    load: (day) => call((g, s) => crewApi.get(g, s, day)),

    answer: (day, response) => call((g, s) => crewApi.answer(g, s, day, response)),

    guess: async (day, target, guess) => {
      if (get().busy) return
      set({ busy: true })
      await call((g, s) => crewApi.guess(g, s, day, target, guess))
      set({ busy: false })
    },

    guessCrowd: (day, percent) => {
      try {
        localStorage.setItem(CROWD(day), String(percent))
      } catch {
        // Kept for this visit only.
      }
      set({ crowd: { ...get().crowd, [day]: percent } })
    },
  }
})

/** Your crowd guess for `day`, from this visit or an earlier one. */
export function crowdGuess(crowd: Record<number, number>, day: number): number | undefined {
  return crowd[day] ?? readCrowd(day)
}
