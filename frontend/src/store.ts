import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { z } from 'zod'
import { observe } from './lib/api'
import { applyObservation } from './lib/estimate'
import { EntrySchema, INITIAL_STATE, type CometState, type Entry, type EntryKind, type Observation } from './lib/schema'

interface Answer {
  kind: Exclude<EntryKind, 'text'>
  observation: Observation
  /** What was chosen, in words, for the log and memory cards. */
  text: string
  prompt: string
  statementId?: string
}

interface CometStore {
  entries: Entry[]
  isLoading: boolean
  error: string | null
  // Manual state from the ?debug panel; overrides the observed comet when set.
  debugComet: CometState | null
  // Chart mode shows crisp axes and rings and exact numbers.
  chartMode: boolean
  toggleChartMode: () => void
  /** Record a tap answer. Scored in the browser, so it applies instantly. */
  answer: (answer: Answer) => void
  /** Free writing ("say more"), read by Claude on the backend. */
  send: (text: string, prompt: string | null) => Promise<void>
  reset: () => void
  setDebugComet: (state: CometState | null) => void
}

const PersistedSchema = z.object({
  entries: z.array(EntrySchema),
  chartMode: z.boolean().default(false),
})

export const useCometStore = create<CometStore>()(
  persist(
    (set, get) => ({
      entries: [],
      isLoading: false,
      error: null,
      debugComet: null,
      chartMode: false,
      toggleChartMode: () => set((s) => ({ chartMode: !s.chartMode })),

      answer: ({ kind, observation, text, prompt, statementId }) => {
        set((s) => {
          const latest = s.entries.at(-1)?.state ?? INITIAL_STATE
          const state = applyObservation(latest, observation)
          return {
            entries: [...s.entries, { id: crypto.randomUUID(), kind, text, prompt, statementId, observation, state }],
            error: null,
          }
        })
      },

      send: async (text, prompt) => {
        if (get().isLoading) return
        set({ isLoading: true, error: null })
        try {
          const latest = get().entries.at(-1)?.state ?? null
          const res = await observe(text, prompt, latest)
          set((s) => ({
            entries: [
              ...s.entries,
              { id: crypto.randomUUID(), kind: 'text', text, prompt, observation: res.observation, state: res.state },
            ],
          }))
        } catch (e) {
          set({ error: e instanceof Error ? e.message : 'Something went wrong.' })
        } finally {
          set({ isLoading: false })
        }
      },

      reset: () => set({ entries: [], error: null }),
      setDebugComet: (debugComet) => set({ debugComet }),
    }),
    {
      name: 'comets:v1',
      // v2: tap-based journey (v1 was text only). v3: research-based statements
      // replaced the this-or-that cards. Older journeys don't fit, so start fresh.
      version: 3,
      migrate: () => ({ entries: [], chartMode: false }),
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ entries: s.entries, chartMode: s.chartMode }),
      // Discard stored data that no longer matches the schema instead of crashing.
      merge: (persisted, current) => {
        const parsed = PersistedSchema.safeParse(persisted)
        return parsed.success ? { ...current, ...parsed.data } : current
      },
    },
  ),
)
