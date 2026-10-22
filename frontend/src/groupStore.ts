import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { z } from 'zod'
import { api, groupIdFromSearch, newMemberSecret, SharingError, type Member } from './lib/groups'
import type { CometState } from './lib/schema'

interface Membership {
  id: string
  /** Lets this device update or remove its own entry. */
  secret: string
  /** Your public id in the group, to tell yourself apart from friends. */
  memberId: string
}

interface ConstellationStore {
  /** Whether the server has sharing set up; null until checked. */
  enabled: boolean | null
  membership: Membership | null
  /** Remembered so joining another constellation is one tap. */
  nickname: string
  /** A constellation from the link you opened that you haven't joined yet. */
  invite: string | null
  /** Members of the joined constellation, or of the invite before joining. */
  members: Member[]
  busy: boolean
  error: string | null

  /** Check the server and pick up a `?c=` link. */
  init: () => Promise<void>
  /** Start a new constellation and join it. */
  create: (name: string, state: CometState) => Promise<void>
  /** Join the constellation you were invited to (leaving any other). */
  join: (name: string, state: CometState) => Promise<void>
  refresh: () => Promise<void>
  /** Keep your entry in step with your comet (e.g. after a new journey). */
  sync: (state: CometState) => Promise<void>
  leave: () => Promise<void>
}

const PersistedSchema = z.object({
  membership: z.object({ id: z.string(), secret: z.string(), memberId: z.string() }).nullable().default(null),
  nickname: z.string().default(''),
})

// Show the constellation's link in the address bar too, so it can be copied from there.
function showInUrl(id: string | null) {
  const url = new URL(window.location.href)
  if (id) url.searchParams.set('c', id)
  else url.searchParams.delete('c')
  window.history.replaceState(null, '', url)
}

export const useConstellation = create<ConstellationStore>()(
  persist(
    (set, get) => {
      const fail = (e: unknown) => {
        const message = e instanceof Error ? e.message : 'Something went wrong.'
        set({ error: message, busy: false })
        // The constellation is gone (expired or never existed): forget it.
        if (e instanceof SharingError && e.status === 404) {
          const { membership, invite } = get()
          if (invite) set({ invite: null })
          else if (membership) set({ membership: null })
          set({ members: [] })
          showInUrl(null)
        }
      }

      const enter = async (id: string, name: string, state: CometState, secret: string) => {
        const me = await api.join(id, secret, name, state)
        set({ membership: { id, secret, memberId: me.id }, nickname: name, invite: null, error: null })
        showInUrl(id)
        await get().refresh()
      }

      return {
        enabled: null,
        membership: null,
        nickname: '',
        invite: null,
        members: [],
        busy: false,
        error: null,

        init: async () => {
          const linked = groupIdFromSearch(window.location.search)
          const { membership } = get()
          if (linked && linked !== membership?.id) set({ invite: linked })
          else if (!linked && membership) showInUrl(membership.id)
          try {
            set({ enabled: await api.enabled() })
          } catch {
            set({ enabled: false })
            return
          }
          if (get().enabled && (get().invite || get().membership)) await get().refresh()
        },

        create: async (name, state) => {
          set({ busy: true, error: null })
          try {
            const old = get().membership
            if (old) await api.leave(old.id, old.secret).catch(() => undefined)
            const id = await api.create()
            await enter(id, name, state, newMemberSecret())
            set({ busy: false })
          } catch (e) {
            fail(e)
          }
        },

        join: async (name, state) => {
          const { invite, membership } = get()
          if (!invite) return
          set({ busy: true, error: null })
          try {
            if (membership) await api.leave(membership.id, membership.secret).catch(() => undefined)
            await enter(invite, name, state, newMemberSecret())
            set({ busy: false })
          } catch (e) {
            fail(e)
          }
        },

        refresh: async () => {
          const id = get().invite ?? get().membership?.id
          if (!id) return
          try {
            const group = await api.get(id)
            // Ignore a response for a constellation we've since moved away from.
            if ((get().invite ?? get().membership?.id) === id) set({ members: group.members })
          } catch (e) {
            fail(e)
          }
        },

        sync: async (state) => {
          const { membership, nickname } = get()
          if (!membership || !nickname) return
          try {
            await api.join(membership.id, membership.secret, nickname, state)
            await get().refresh()
          } catch (e) {
            fail(e)
          }
        },

        leave: async () => {
          const { membership } = get()
          if (!membership) return
          set({ membership: null, members: [], error: null })
          showInUrl(null)
          await api.leave(membership.id, membership.secret).catch(() => undefined)
        },
      }
    },
    {
      name: 'comets:constellation',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ membership: s.membership, nickname: s.nickname }),
      merge: (persisted, current) => {
        const parsed = PersistedSchema.safeParse(persisted)
        return parsed.success ? { ...current, ...parsed.data } : current
      },
    },
  ),
)
