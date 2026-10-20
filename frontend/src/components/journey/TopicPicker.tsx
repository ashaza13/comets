import { useState } from 'react'
import { DEPTH_LEVELS } from '../../lib/journey'
import { DOMAINS } from '../../lib/spec'

interface Props {
  onDone: (picks: Record<string, number>) => void
}

/** Tap topics that light you up; tap again to go deeper (curious → into it → obsessed → off). */
export function TopicPicker({ onDone }: Props) {
  const [picks, setPicks] = useState<Record<string, number>>({})

  const cycle = (id: string) =>
    setPicks((p) => {
      const next = { ...p }
      const level = (p[id] ?? -1) + 1
      if (level >= DEPTH_LEVELS.length) delete next[id]
      else next[id] = level
      return next
    })

  const count = Object.keys(picks).length
  return (
    <div className="topics">
      <div className="topics-grid">
        {DOMAINS.map((d) => {
          const level = picks[d.id]
          const on = level !== undefined
          return (
            <button
              key={d.id}
              className={`topic ${on ? 'topic--on' : ''}`}
              style={{ ['--topic' as string]: d.color, opacity: on ? 0.55 + 0.15 * level : undefined }}
              onClick={() => cycle(d.id)}
              aria-pressed={on}
            >
              {d.id}
              {on && <span className="topic-level">{DEPTH_LEVELS[level].label}</span>}
            </button>
          )
        })}
      </div>
      <button className="journey-primary" onClick={() => onDone(picks)}>
        {count ? `Done — ${count} picked` : 'None of these'}
      </button>
    </div>
  )
}
