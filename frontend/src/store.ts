import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { z } from 'zod'
import { observe } from './lib/api'
import { EntrySchema, type CometState, type Entry } from './lib/schema'
import { PROMPTS } from './lib/spec'

interface CometStore {
  entries: Entry[]
  nextPrompt: string | null
  isLoading: boolean
  error: string | null
  // Manual state from the ?debug panel; overrides the observed comet when set.
  debugComet: CometState | null
  send: (text: string) => Promise<void>
  reset: () => void
  setDebugComet: (state: CometState | null) => void
}

const PersistedSchema = z.object({
  entries: z.array(EntrySchema),
  nextPrompt: z.string().nullable(),
})

export const useCometStore = create<CometStore>()(
  persist(
    (set, get) => ({
      entries: [],
      nextPrompt: PROMPTS[0],
      isLoading: false,
      error: null,
      debugComet: null,

      send: async (text) => {
        const { entries, nextPrompt, isLoading } = get()
        if (isLoading) return
        set({ isLoading: true, error: null })
        try {
          const latest = entries.at(-1)?.state ?? null
          const res = await observe(text, nextPrompt, latest)
          set((s) => ({
            entries: [
              ...s.entries,
              { id: crypto.randomUUID(), text, prompt: nextPrompt, observation: res.observation, state: res.state },
            ],
            nextPrompt: res.next_prompt,
          }))
        } catch (e) {
          set({ error: e instanceof Error ? e.message : 'Something went wrong.' })
        } finally {
          set({ isLoading: false })
        }
      },

      reset: () => set({ entries: [], nextPrompt: PROMPTS[0], error: null }),
      setDebugComet: (debugComet) => set({ debugComet }),
    }),
    {
      name: 'comets:v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ entries: s.entries, nextPrompt: s.nextPrompt }),
      // Discard stored data that no longer matches the schema instead of crashing.
      merge: (persisted, current) => {
        const parsed = PersistedSchema.safeParse(persisted)
        return parsed.success ? { ...current, ...parsed.data } : current
      },
    },
  ),
)
