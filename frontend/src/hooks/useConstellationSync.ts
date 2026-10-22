import { useEffect } from 'react'
import { useConstellation } from '../groupStore'
import type { CometState } from '../lib/schema'

const POLL_MS = 20_000

/**
 * Keeps the constellation in step: picks up a shared link on load, writes your
 * reading once the journey is done (and again if it changes), and checks for
 * friends joining while the page is open.
 */
export function useConstellationSync(finalState: CometState | null, complete: boolean) {
  const init = useConstellation((s) => s.init)
  const sync = useConstellation((s) => s.sync)
  const refresh = useConstellation((s) => s.refresh)
  const groupId = useConstellation((s) => s.membership?.id ?? null)
  const watching = useConstellation((s) => s.enabled === true && (s.membership !== null || s.invite !== null))

  useEffect(() => {
    void init()
  }, [init])

  useEffect(() => {
    if (groupId && complete && finalState) void sync(finalState)
  }, [groupId, complete, finalState, sync])

  useEffect(() => {
    if (!watching) return
    const check = () => {
      if (!document.hidden) void refresh()
    }
    const id = window.setInterval(check, POLL_MS)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', check)
    }
  }, [watching, refresh])
}
