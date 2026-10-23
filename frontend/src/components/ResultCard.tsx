import { useState } from 'react'
import { useConstellation } from '../groupStore'
import { ConstellationPanel } from './ConstellationPanel'
import { DailyCard } from './DailyCard'
import { checkInDays } from '../lib/daily'
import { emotionCss } from '../lib/color'
import { describeAxis, describeDepth, describeEmotion } from '../lib/describe'
import type { CometState, Entry } from '../lib/schema'
import { AXES, domainColor } from '../lib/spec'

const percent = (v: number) => `${((Math.min(Math.max(v, -1), 1) + 1) / 2) * 100}%`

interface Props {
  /** The comet at the end of the journey. */
  state: CometState
  /** Show exact numbers (chart mode) instead of plain language. */
  exact: boolean
  onReplay: () => void
  /** For the Today tab: the journey and daily check-ins so far, and today's day number. */
  entries: Entry[]
  today: number
}

/** Where the journey ended, read out axis by axis, shown once the map is revealed. */
export function ResultCard({ state, exact, onReplay, entries, today }: Props) {
  const [open, setOpen] = useState(true)
  const invited = useConstellation((s) => s.invite !== null)
  const sharing = useConstellation((s) => s.enabled === true)
  const friendCount = useConstellation((s) => (s.membership ? s.members.filter((m) => m.id !== s.membership!.memberId).length : 0))
  // Open on Friends when you came from a friend's link, so joining is the next
  // step; returning visitors and anyone with friends to guess open on Today; a
  // first journey on where you landed.
  const returning = checkInDays(entries).length > 1 || friendCount > 0
  const [tab, setTab] = useState<'you' | 'today' | 'friends'>(invited ? 'friends' : returning ? 'today' : 'you')
  const topInterests = Object.entries(state.interests)
    .filter(([, d]) => d > 0.05)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)

  if (!open) {
    return (
      <button className="result-chip" onClick={() => setOpen(true)}>
        Your reading
      </button>
    )
  }

  return (
    <section className="result" aria-label="Your comet">
      <header className="result-head">
        <div className="result-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'you'} className="result-tab" onClick={() => setTab('you')}>
            Where you landed
          </button>
          <button role="tab" aria-selected={tab === 'today'} className="result-tab" onClick={() => setTab('today')}>
            Today
          </button>
          {sharing && (
            <button role="tab" aria-selected={tab === 'friends'} className="result-tab" onClick={() => setTab('friends')}>
              Friends{friendCount > 0 ? ` (${friendCount})` : invited ? ' ·' : ''}
            </button>
          )}
        </div>
        <button className="result-close" onClick={() => setOpen(false)} aria-label="Hide">
          ×
        </button>
      </header>

      {sharing && tab === 'friends' ? (
        <ConstellationPanel state={state} />
      ) : tab === 'today' ? (
        <DailyCard entries={entries} today={today} onInvite={() => setTab('friends')} />
      ) : (
        <>
          <h2 className="result-title">{AXES.map((a) => describeAxis(a, state.personality[a.key])).join('\u00a0· ')}</h2>

          {AXES.map((a) => {
            const v = state.personality[a.key]
            const sd = Math.sqrt(state.uncertainty[a.key])
            return (
              <div key={a.key} className="result-axis">
                <div className="result-axis-head">
                  <span className="result-axis-name">{a.name}</span>
                  <span className="dim">
                    {exact ? `${v >= 0 ? '+' : ''}${v.toFixed(2)} ±${sd.toFixed(2)}` : describeAxis(a, v)}
                  </span>
                </div>
                <div className="result-scale">
                  <span className="result-pole">{a.negative}</span>
                  <div className="result-track">
                    {/* The band is how sure the estimate is; the dot is where it sits. */}
                    <div className="result-band" style={{ left: percent(v - sd), right: `calc(100% - ${percent(v + sd)})` }} />
                    <div className="result-centre" />
                    <div className="result-dot" style={{ left: percent(v) }} />
                  </div>
                  <span className="result-pole">{a.positive}</span>
                </div>
                <div className="result-desc">{a.description}</div>
              </div>
            )
          })}

          <div className="result-row">
            <span className="dim">feeling</span>
            <span className="result-feeling">
              <span className="nt-swatch" style={{ background: emotionCss(state.emotion) }} />
              {describeEmotion(state.emotion)}
            </span>
          </div>

          {topInterests.length > 0 && (
            <div className="result-row">
              <span className="dim">loves</span>
              <span className="result-tags">
                {topInterests.map(([domain, depth]) => (
                  <span key={domain} className="interest-tag" style={{ ['--tag' as string]: domainColor(domain) }}>
                    {domain} {exact ? depth.toFixed(2) : `· ${describeDepth(depth)}`}
                  </span>
                ))}
              </span>
            </div>
          )}

          <footer className="result-foot">
            <span className="dim">Hover the stars on your trail to revisit each answer.</span>
            <button className="result-replay" onClick={onReplay}>
              Replay journey
            </button>
          </footer>
        </>
      )}
    </section>
  )
}
