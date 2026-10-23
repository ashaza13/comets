import { useCrew } from '../crewStore'
import { useConstellation } from '../groupStore'
import type { Member } from '../lib/groups'
import { crewScore, knowScore, MAX_POINTS, pickFriends, roundEmoji, type Bond, type Guess } from '../lib/crew'
import { dailyStatement } from '../lib/daily'
import { RESPONSES, statementText } from '../lib/statements'
import { StatementRating } from './journey/StatementRating'

const said = (actual: number) => RESPONSES[actual - 1].toLowerCase()

export type CrewMode = { kind: 'off' } | { kind: 'alone'; hasCrew: boolean } | { kind: 'friends'; picks: Member[] }

/** Which game today is: friends to guess, nobody yet (an invite), or none (sharing off). */
export function useCrewMode(today: number): CrewMode {
  const enabled = useConstellation((s) => s.enabled === true)
  const membership = useConstellation((s) => s.membership)
  const members = useConstellation((s) => s.members)
  if (!enabled) return { kind: 'off' }
  const friends = membership ? members.filter((m) => m.id !== membership.memberId) : []
  if (!membership || friends.length === 0) return { kind: 'alone', hasCrew: !!membership }
  return { kind: 'friends', picks: pickFriends(friends, today, membership.memberId) }
}

/** The day's result as emoji, for the share text; null until you've played. */
export function useGameSummary(today: number, mode: CrewMode): { label: string; emojis: string } | null {
  const data = useCrew((s) => s.data)
  if (mode.kind !== 'friends' || data?.day !== today) return null
  const guesses = mode.picks.flatMap((p) => data.guesses.filter((g) => g.target === p.id))
  if (guesses.length === 0) return null
  const { points, scored } = crewScore(guesses)
  const total = scored > 0 ? ` ${points}/${scored * MAX_POINTS}` : ''
  return { label: 'Know your crew', emojis: guesses.map(roundEmoji).join('') + total }
}

interface Props {
  today: number
  mode: CrewMode
  /** Open the Friends tab, to start or share a constellation. */
  onInvite: () => void
}

/** Today's game: what would each of a few friends say to today's statement? */
export function CrewGame({ today, mode, onInvite }: Props) {
  if (mode.kind === 'off') return null
  if (mode.kind === 'alone') return <Invite hasCrew={mode.hasCrew} onInvite={onInvite} />
  return <FriendRounds today={today} picks={mode.picks} />
}

function Invite({ hasCrew, onInvite }: { hasCrew: boolean; onInvite: () => void }) {
  return (
    <div className="crew">
      <div className="crew-head">Know your crew</div>
      <h3 className="crew-prompt">How well do you know your friends?</h3>
      <p className="crew-prompt-small">
        Each day, guess what they’d say to the day’s statement, and they guess you. Over time you’ll see who you know
        best, and who knows you best.
      </p>
      <button className="journey-primary journey-primary--small" onClick={onInvite}>
        {hasCrew ? 'Share your link' : 'Make a link for friends'}
      </button>
    </div>
  )
}

function FriendRounds({ today, picks }: { today: number; picks: Member[] }) {
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
  const bonds = new Map(current.bonds.map((b) => [b.member_id, b]))
  const next = picks.find((p) => !guesses.has(p.id))

  if (next) {
    const known = bondLine(next.name, bonds.get(next.id))
    return (
      <div className="crew" aria-live="polite">
        <div className="crew-head">
          Know your crew{' '}
          <span className="dim">
            · {picks.indexOf(next) + 1} of {picks.length}
          </span>
        </div>
        <h3 className="crew-prompt">
          What would <strong>{next.name}</strong> say?
        </h3>
        <div className="crew-statement">
          <span className="crew-quote">“{statementText(statement)}”</span>
          {known && <span className="dim"> · {known}</span>}
        </div>
        <StatementRating key={next.id} skippable={false} disabled={busy} onRate={(r) => r !== null && void guess(today, next.id, r)} />
        <div className="crew-note dim">
          {current.answered.includes(next.id)
            ? `${next.name} has answered. Lock in your guess to see.`
            : `${next.name} hasn’t answered yet; you’ll see when they do.`}
        </div>
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
        {played.map(({ friend, g }) => {
          const known = bondLine(friend.name, bonds.get(friend.id))
          return (
            <li key={friend.id} className="crew-result">
              <span className="crew-emoji" aria-hidden>
                {roundEmoji(g)}
              </span>
              <div>
                <div>
                  <span className="crew-name">{friend.name}</span> <span className="dim">{reveal(g)}</span>
                </div>
                {known && <div className="crew-bond dim">{known}</div>}
              </div>
            </li>
          )
        })}
      </ul>
      <div className="crew-total">
        {score.scored > 0 ? `${score.points} of ${score.scored * MAX_POINTS} points today` : 'Points appear as friends answer'}
        {score.scored > 0 && score.pending > 0 && <span className="dim"> · {score.pending} still to answer</span>}
      </div>
    </div>
  )
}

/** "You know Sara 7/9" (over the last month), once there's something to go on. */
function bondLine(name: string, bond: Bond | undefined): string | null {
  const score = bond ? knowScore(bond.you_know, bond.you_max) : null
  return score ? `you know ${name} ${score}` : null
}

function reveal(g: Guess): string {
  if (g.actual === null) return `you think ${said(g.guess)} · waiting for them`
  if (g.actual === 0) return 'skipped today'
  if (g.actual === g.guess) return `said ${said(g.actual)}`
  return `said ${said(g.actual)} · you guessed ${said(g.guess)}`
}
