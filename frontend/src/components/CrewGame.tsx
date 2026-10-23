import { useState } from 'react'
import { crowdGuess, useCrew } from '../crewStore'
import { useConstellation } from '../groupStore'
import { useDaily } from '../dailyStore'
import type { Member } from '../lib/groups'
import { crewScore, crowdAgreed, crowdPoints, MAX_POINTS, pickFriends, roundEmoji, type Guess } from '../lib/crew'
import { dailyStatement } from '../lib/daily'
import { RESPONSES, statementText } from '../lib/statements'
import { StatementRating } from './journey/StatementRating'

// The crowd is revealed once enough people have answered for it to mean something.
export const CROWD_MIN = 5

const said = (actual: number) => RESPONSES[actual - 1].toLowerCase()

interface Props {
  today: number
  /** Open the Friends tab, to start or share a constellation. */
  onInvite: () => void
}

export type CrewMode = { kind: 'off' } | { kind: 'crowd'; hasCrew: boolean } | { kind: 'friends'; picks: Member[] }

/** Which game today is: friends to guess, the crowd (no friends yet), or none (sharing off). */
export function useCrewMode(today: number): CrewMode {
  const enabled = useConstellation((s) => s.enabled === true)
  const membership = useConstellation((s) => s.membership)
  const members = useConstellation((s) => s.members)
  if (!enabled) return { kind: 'off' }
  const friends = membership ? members.filter((m) => m.id !== membership.memberId) : []
  if (!membership || friends.length === 0) return { kind: 'crowd', hasCrew: !!membership }
  return { kind: 'friends', picks: pickFriends(friends, today, membership.memberId) }
}

/** The day's result as emoji, for the share text; null until you've played. */
export function useGameSummary(today: number, mode: CrewMode): { label: string; emojis: string } | null {
  const data = useCrew((s) => s.data)
  const crowd = useCrew((s) => s.crowd)
  const tallies = useDaily((s) => s.tallies)
  if (mode.kind === 'friends') {
    if (data?.day !== today) return null
    const guesses = mode.picks.flatMap((p) => data.guesses.filter((g) => g.target === p.id))
    if (guesses.length === 0) return null
    const { points, scored } = crewScore(guesses)
    const total = scored > 0 ? ` ${points}/${scored * MAX_POINTS}` : ''
    return { label: 'Know your crew', emojis: guesses.map(roundEmoji).join('') + total }
  }
  if (mode.kind === 'crowd') {
    const locked = crowdGuess(crowd, today)
    if (locked === undefined) return null
    const todays = tallies?.day === today ? tallies : null
    const total = todays ? Object.values(todays.answers).reduce((a, b) => a + b, 0) : 0
    const agreed = todays && total >= CROWD_MIN ? crowdAgreed(todays) : null
    return { label: 'Guess the crowd', emojis: agreed === null ? '⏳' : roundEmoji({ actual: 1, points: crowdPoints(locked, agreed) }) }
  }
  return null
}

/** Today's game: guess how your friends answered (or, on your own, the crowd). */
export function CrewGame({ today, mode, onInvite }: Props & { mode: CrewMode }) {
  if (mode.kind === 'off') return null
  if (mode.kind === 'crowd') return <CrowdRound today={today} onInvite={onInvite} hasCrew={mode.hasCrew} />
  return <FriendRounds today={today} picks={mode.picks} />
}

function FriendRounds({ today, picks }: { today: number; picks: { id: string; name: string }[] }) {
  const { data, busy, error, guess } = useCrew()
  const statement = dailyStatement(today)
  const current = data?.day === today ? data : null

  if (!current || current.my_answer === null) {
    return (
      <div className="crew">
        <div className="crew-head">Know your crew</div>
        <p className="dim">{error ?? 'Sharing your answer with the crew…'}</p>
      </div>
    )
  }

  const guesses = new Map(current.guesses.map((g) => [g.target, g]))
  const next = picks.find((p) => !guesses.has(p.id))
  const round = picks.indexOf(next!) + 1

  if (next) {
    return (
      <div className="crew" aria-live="polite">
        <div className="crew-head">
          Know your crew <span className="dim">· round {round} of {picks.length}</span>
        </div>
        <h3 className="crew-prompt">
          How did <strong>{next.name}</strong> answer?
        </h3>
        <div className="crew-statement dim">“{statementText(statement)}”</div>
        <StatementRating key={next.id} skippable={false} disabled={busy} onRate={(r) => r !== null && void guess(today, next.id, r)} />
        {current.answered.includes(next.id) ? null : (
          <div className="crew-note dim">{next.name} hasn’t checked in yet; you’ll see when they do.</div>
        )}
        {error && <p className="constellation-error">{error}</p>}
      </div>
    )
  }

  const played = picks.map((p) => ({ friend: p, g: guesses.get(p.id)! }))
  const score = crewScore(played.map((r) => r.g))
  return (
    <div className="crew">
      <div className="crew-head">
        Know your crew <span className="crew-score">{played.map((r) => roundEmoji(r.g)).join('')}</span>
      </div>
      <ul className="crew-results">
        {played.map(({ friend, g }) => (
          <li key={friend.id} className="crew-result">
            <span className="crew-emoji" aria-hidden>
              {roundEmoji(g)}
            </span>
            <span className="crew-name">{friend.name}</span>
            <span className="dim">{reveal(g)}</span>
          </li>
        ))}
      </ul>
      <div className="crew-total">
        {score.scored > 0 ? `${score.points} of ${score.scored * MAX_POINTS} points` : 'Points appear as friends check in'}
        {score.scored > 0 && score.pending > 0 && <span className="dim"> · {score.pending} still to check in</span>}
      </div>
    </div>
  )
}

function reveal(g: Guess): string {
  if (g.actual === null) return `you said ${said(g.guess)} · waiting`
  if (g.actual === 0) return 'skipped today'
  if (g.actual === g.guess) return `said ${said(g.actual)}`
  return `said ${said(g.actual)} · you guessed ${said(g.guess)}`
}

function CrowdRound({ today, onInvite, hasCrew }: { today: number; onInvite: () => void; hasCrew: boolean }) {
  const tallies = useDaily((s) => s.tallies)
  const crowd = useCrew((s) => s.crowd)
  const guessCrowd = useCrew((s) => s.guessCrowd)
  const [value, setValue] = useState(50)
  const locked = crowdGuess(crowd, today)
  const todays = tallies?.day === today ? tallies : null
  const total = todays ? Object.values(todays.answers).reduce((a, b) => a + b, 0) : 0
  const agreed = todays && total >= CROWD_MIN ? crowdAgreed(todays) : null

  const invite = (
    <button className="journey-link crew-invite" onClick={onInvite}>
      {hasCrew ? 'Share your link to play with friends →' : 'Play with friends: make a link →'}
    </button>
  )

  if (locked === undefined) {
    return (
      <div className="crew">
        <div className="crew-head">Guess the crowd</div>
        <h3 className="crew-prompt">What share of comets called today’s statement accurate?</h3>
        <div className="crowd-slider">
          <input
            type="range"
            min={0}
            max={100}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            aria-label="Your guess, percent"
          />
          <span className="crowd-value">{value}%</span>
        </div>
        <button className="journey-primary journey-primary--small" onClick={() => guessCrowd(today, value)}>
          Lock it in
        </button>
        {invite}
      </div>
    )
  }

  const points = agreed !== null ? crowdPoints(locked, agreed) : null
  return (
    <div className="crew">
      <div className="crew-head">
        Guess the crowd{' '}
        {points !== null && <span className="crew-score">{roundEmoji({ actual: 1, points })}</span>}
      </div>
      <p className="crew-prompt-small">
        You guessed <strong>{locked}%</strong>
        {agreed !== null ? (
          <>
            {' '}
            · <strong>{Math.round(agreed * 100)}%</strong> of {total} comets called it accurate
          </>
        ) : (
          <span className="dim"> · revealed once {CROWD_MIN} comets have answered ({total} so far)</span>
        )}
      </p>
      {invite}
    </div>
  )
}
