import { useState } from 'react'
import { useCrew } from '../crewStore'
import { knowScore, knowsYouBest, type Bond } from '../lib/crew'
import { useConstellation } from '../groupStore'
import { emotionCss } from '../lib/color'
import { describeAxis } from '../lib/describe'
import { likeness, MAX_NAME_LENGTH, sharedInterests, shareUrl, type Member } from '../lib/groups'
import type { CometState } from '../lib/schema'
import { AXES } from '../lib/spec'

const names = (members: Member[]) => {
  const list = members.map((m) => m.name)
  return list.length <= 3 ? list.join(', ').replace(/, ([^,]*)$/, ' and $1') : `${list.slice(0, 2).join(', ')} and ${list.length - 2} others`
}

/** Friends compared with you: how alike, where they landed, what you share. */
function FriendRow({ friend, you, bond }: { friend: Member; you: CometState; bond?: Bond }) {
  const alike = Math.round(likeness(you.personality, friend.personality) * 100)
  const shared = sharedInterests(you.interests, friend.interests).slice(0, 2)
  return (
    <li className="friend">
      <div className="friend-head">
        <span className="friend-name">
          <span className="nt-swatch" style={{ background: emotionCss(friend.emotion) }} />
          {friend.name}
        </span>
        <span className="friend-alike">{alike}% alike</span>
      </div>
      <div className="friend-reading">{AXES.map((a) => describeAxis(a, friend.personality[a.key])).join(' · ')}</div>
      {shared.length > 0 && <div className="friend-shared">you both love {shared.join(' and ')}</div>}
      {bond && <BondLine name={friend.name} bond={bond} />}
    </li>
  )
}

/** How well you and one friend know each other, from a month of daily guesses. */
function BondLine({ name, bond }: { name: string; bond: Bond }) {
  const you = knowScore(bond.you_know, bond.you_max)
  const them = knowScore(bond.knows_you, bond.knows_you_max)
  if (!you && !them) return null
  return (
    <div className="friend-bond">
      {you && <span>you know {name} {you}</span>}
      {you && them && <span className="dim"> · </span>}
      {them && <span>{name} knows you {them}</span>}
    </div>
  )
}

/** Who knows the crew best: points from guessing each other this week. */
function Leaderboard({ members, me }: { members: Member[]; me: string }) {
  const data = useCrew((s) => s.data)
  const board = data?.board ?? []
  const names = new Map(members.map((m) => [m.id, m.name]))
  const rows = board.filter((r) => names.has(r.member_id))
  if (rows.length < 2 || rows.every((r) => r.week === 0)) return null
  return (
    <div className="board">
      <div className="board-head dim">Who knows the crew best · this week</div>
      <ol className="board-rows">
        {rows.map((r, i) => (
          <li key={r.member_id} className={`board-row ${r.member_id === me ? 'board-row--me' : ''}`}>
            <span className="board-rank">{i + 1}</span>
            <span className="board-name">{r.member_id === me ? 'You' : names.get(r.member_id)}</span>
            <span className="dim">{r.today > 0 ? `+${r.today} today` : ''}</span>
            <span className="board-points">{r.week}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function ShareLink({ groupId }: { groupId: string }) {
  const [copied, setCopied] = useState(false)
  const url = shareUrl(groupId)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      window.prompt('Copy this link', url)
    }
  }
  return (
    <div className="share">
      <input className="share-url" value={url} readOnly onFocus={(e) => e.currentTarget.select()} aria-label="Constellation link" />
      <button className="share-btn" onClick={copy}>
        {copied ? 'Copied' : 'Copy'}
      </button>
      {'share' in navigator && (
        <button
          className="share-btn"
          onClick={() => navigator.share({ title: 'Our constellation', text: 'Join my constellation: each day we guess how well we know each other.', url }).catch(() => undefined)}
        >
          Share
        </button>
      )}
    </div>
  )
}

interface Props {
  /** Your comet at the end of the journey. */
  state: CometState
}

/** Make or join a shared link and see how you compare with the friends on it. */
export function ConstellationPanel({ state }: Props) {
  const { enabled, membership, invite, members, busy, error, nickname, create, join, leave } = useConstellation()
  const crew = useCrew((s) => s.data)
  const [name, setName] = useState(nickname)

  if (enabled === null) return <p className="constellation-note">Checking…</p>
  if (!enabled) return <p className="constellation-note">Sharing isn't available on this server yet.</p>

  if (invite || !membership) {
    const submit = () => {
      const trimmed = name.trim()
      if (!trimmed || busy) return
      void (invite ? join(trimmed, state) : create(trimmed, state))
    }
    return (
      <div className="constellation">
        <p className="constellation-lead">
          {invite
            ? members.length > 0
              ? `${names(members)} ${members.length === 1 ? 'is' : 'are'} in this constellation. Add your comet to see how you compare.`
              : 'You were invited to a constellation. Add your comet to see how you compare.'
            : 'Make a link for friends. Each day you answer one statement, then guess how your friends answered it, and see where you all land in the cosmos.'}
        </p>
        <form
          className="constellation-form"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <input
            className="constellation-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={MAX_NAME_LENGTH}
            placeholder="Your first name or nickname"
            aria-label="Your name"
            autoComplete="given-name"
          />
          <button className="journey-primary journey-primary--small" disabled={!name.trim() || busy}>
            {busy ? '…' : invite ? 'Join' : 'Create link'}
          </button>
        </form>
        <p className="constellation-note">
          Anyone with the link sees your name and where you landed. Each day’s answer is shown only to friends who guess it.
          {invite && membership && ' Joining this leaves your current constellation.'}
        </p>
        {error && <p className="constellation-error">{error}</p>}
      </div>
    )
  }

  const bonds = new Map((crew?.bonds ?? []).map((b) => [b.member_id, b]))
  const best = knowsYouBest(crew?.bonds ?? [])
  const bestName = best ? members.find((m) => m.id === best.member_id)?.name : null
  const friends = members
    .filter((m) => m.id !== membership.memberId)
    .sort((a, b) => likeness(state.personality, b.personality) - likeness(state.personality, a.personality))

  return (
    <div className="constellation">
      <ShareLink groupId={membership.id} />
      <Leaderboard members={members} me={membership.memberId} />
      {best && bestName && (
        <p className="friend-best">
          <strong>{bestName}</strong> knows you best <span className="dim">· {knowScore(best.knows_you, best.knows_you_max)} this month</span>
        </p>
      )}
      {friends.length === 0 ? (
        <p className="constellation-lead">No one else yet. Send the link to a friend: once they've taken the journey you'll guess each other's answers every day, and they'll appear on your map.</p>
      ) : (
        <ul className="friends">
          {friends.map((f) => (
            <FriendRow key={f.id} friend={f} you={state} bond={bonds.get(f.id)} />
          ))}
        </ul>
      )}
      {error && <p className="constellation-error">{error}</p>}
      <button className="journey-link constellation-leave" onClick={() => void leave()}>
        Leave this constellation
      </button>
    </div>
  )
}
