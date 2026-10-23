import { useEffect, useState } from 'react'
import { crowdGuess, useCrew } from '../crewStore'
import { useDaily } from '../dailyStore'
import { useConstellation } from '../groupStore'
import { CrewGame, useCrewMode, useGameSummary } from './CrewGame'
import {
  checkInDays,
  dailyResponse,
  dailyStatement,
  formatCountdown,
  recentMoods,
  shareText,
  streak as streakOf,
  untilNextCheckIn,
} from '../lib/daily'
import { rarity, shareOf } from '../lib/dailyApi'
import { shareUrl } from '../lib/groups'
import type { Entry } from '../lib/schema'
import { describeEmotion } from '../lib/describe'
import { starType } from '../lib/stars'
import { RESPONSES, statementText } from '../lib/statements'

const pct = (v: number) => `${Math.round(v * 100)}%`

/** Ticks once a minute, for the countdown. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

interface Props {
  entries: Entry[]
  today: number
  /** Open the Friends tab, to start or share a constellation. */
  onInvite: () => void
}

/** Today in your orbit: your star, the reading, what everyone said, and a result to share. */
export function DailyCard({ entries, today, onInvite }: Props) {
  const now = useNow()
  const { tallies, reading, readingFailed } = useDaily()
  const [copied, setCopied] = useState(false)
  const mode = useCrewMode(today)
  const game = useGameSummary(today, mode)
  const groupId = useConstellation((s) => s.membership?.id ?? null)
  // On your own, everyone's answers stay hidden until you've guessed the crowd.
  const crowdPending = useCrew((s) => mode.kind === 'crowd' && crowdGuess(s.crowd, today) === undefined)
  const state = entries.at(-1)?.state
  if (!state) return null

  const star = starType(state.personality)
  const streak = streakOf(checkInDays(entries), today)
  const statement = dailyStatement(today)
  const response = dailyResponse(entries, today)
  const answered = typeof response === 'number' ? response : null
  const todays = tallies?.day === today ? tallies : null
  const common = todays ? rarity(todays, star.id) : null
  const same = todays && answered !== null ? shareOf(todays, answered) : null
  const total = todays ? Object.values(todays.answers).reduce((a, b) => a + b, 0) : 0

  const share = async () => {
    const text = shareText({
      day: today,
      star,
      streak,
      moods: recentMoods(entries),
      statement,
      game,
      url: groupId ? shareUrl(groupId) : `${window.location.origin}/`,
    })
    try {
      if ('share' in navigator && matchMedia('(pointer: coarse)').matches) await navigator.share({ text })
      else {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1600)
      }
    } catch {
      // Share sheet dismissed, or clipboard unavailable: nothing to do.
    }
  }

  return (
    <div className="daily-card">
      <CrewGame today={today} mode={mode} onInvite={onInvite} />

      <div className="daily-star" style={{ ['--star' as string]: star.color }}>
        <span className="daily-star-dot" aria-hidden />
        <div>
          <div className="daily-star-name">
            {star.name}
            {common !== null && <span className="dim"> · {pct(common)} of comets</span>}
          </div>
          <div className="daily-star-blurb">{star.blurb}</div>
        </div>
      </div>

      <p className="daily-reading">
        {reading?.day === today ? (
          reading.text
        ) : readingFailed ? (
          // Without the reading (offline, say), a plain note on today's mood.
          `Today your comet burns ${describeEmotion(state.emotion)}.`
        ) : (
          <span className="dim">Reading your orbit…</span>
        )}
      </p>

      <div className="daily-question">
        <div className="dim">Day {today} · today’s statement</div>
        <div className="daily-statement">“{statementText(statement)}”</div>
        {todays && total > 0 && !crowdPending && (
          <div className="daily-bars" role="img" aria-label="How everyone answered today">
            {RESPONSES.map((label, i) => {
              const n = todays.answers[String(i + 1)] ?? 0
              return (
                <div key={label} className={`daily-bar ${answered === i + 1 ? 'daily-bar--mine' : ''}`} title={`${label}: ${n}`}>
                  <span style={{ height: `${Math.max(4, (n / Math.max(...Object.values(todays.answers), 1)) * 100)}%` }} />
                </div>
              )
            })}
          </div>
        )}
        <div className="daily-answer">
          {answered !== null ? (
            <>
              You said <strong>{RESPONSES[answered - 1].toLowerCase()}</strong>
              {same !== null && total > 1 && !crowdPending && <span className="dim"> · {pct(same)} of {total} comets agreed</span>}
            </>
          ) : (
            <span className="dim">You skipped today’s statement.</span>
          )}
        </div>
      </div>

      <footer className="daily-foot">
        <span className="dim">
          {streak > 1 ? `🔥 ${streak}-day streak · ` : ''}next check-in in {formatCountdown(untilNextCheckIn(now))}
        </span>
        <button className="result-replay" onClick={share}>
          {copied ? 'Copied' : 'Share'}
        </button>
      </footer>
    </div>
  )
}
