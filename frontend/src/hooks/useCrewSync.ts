import { useEffect } from 'react'
import { useCrew } from '../crewStore'
import { useConstellation } from '../groupStore'
import { dailyResponse } from '../lib/daily'
import type { Entry } from '../lib/schema'

const POLL_MS = 30_000

/**
 * Once today's check-in is done, share your answer with your constellation so
 * friends can guess it, and keep checking for friends' answers coming in.
 */
export function useCrewSync(entries: Entry[], today: number, checkedIn: boolean) {
  const answer = useCrew((s) => s.answer)
  const load = useCrew((s) => s.load)
  const groupId = useConstellation((s) => s.membership?.id ?? null)
  // Joining or leaving changes who's in the crew.
  const memberCount = useConstellation((s) => s.members.length)
  const response = dailyResponse(entries, today)

  useEffect(() => {
    if (!groupId || !checkedIn || response === undefined) return
    void answer(today, response)
  }, [groupId, checkedIn, response, today, answer, memberCount])

  useEffect(() => {
    if (!groupId || !checkedIn) return
    const check = () => {
      if (!document.hidden) void load(today)
    }
    const id = window.setInterval(check, POLL_MS)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', check)
    }
  }, [groupId, checkedIn, today, load])
}
