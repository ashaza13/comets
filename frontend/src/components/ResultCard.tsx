import { useState } from 'react'
import { emotionCss } from '../lib/color'
import { describeAxis, describeDepth, describeEmotion } from '../lib/describe'
import type { CometState } from '../lib/schema'
import { AXES, domainColor } from '../lib/spec'

const percent = (v: number) => `${((Math.min(Math.max(v, -1), 1) + 1) / 2) * 100}%`

interface Props {
  /** The comet at the end of the journey. */
  state: CometState
  /** Show exact numbers (chart mode) instead of plain language. */
  exact: boolean
  onReplay: () => void
}

/** Where the journey ended, read out axis by axis, shown once the map is revealed. */
export function ResultCard({ state, exact, onReplay }: Props) {
  const [open, setOpen] = useState(true)
  const topInterests = Object.entries(state.interests)
    .filter(([, d]) => d > 0.05)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)

  if (!open) {
    return (
      <button className="result-chip" onClick={() => setOpen(true)}>
        ✦ your comet
      </button>
    )
  }

  return (
    <section className="result" aria-label="Your comet">
      <header className="result-head">
        <div>
          <div className="result-kicker">where you landed</div>
          <h2 className="result-title">{AXES.map((a) => describeAxis(a, state.personality[a.key])).join(' · ')}</h2>
        </div>
        <button className="result-close" onClick={() => setOpen(false)} aria-label="Hide">
          ×
        </button>
      </header>

      {AXES.map((a) => {
        const v = state.personality[a.key]
        const sd = Math.sqrt(state.uncertainty[a.key])
        return (
          <div key={a.key} className="result-axis">
            <div className="result-axis-head">
              <span style={{ color: a.color }}>{a.name}</span>
              <span className="dim">
                {exact ? `${v >= 0 ? '+' : ''}${v.toFixed(2)} ±${sd.toFixed(2)}` : describeAxis(a, v)}
              </span>
            </div>
            <div className="result-scale">
              <span className="result-pole">{a.negative}</span>
              <div className="result-track" style={{ ['--axis' as string]: a.color }}>
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
        <span className="result-feeling" style={{ color: emotionCss(state.emotion) }}>
          <span className="nt-swatch" style={{ background: emotionCss(state.emotion) }} />
          {describeEmotion(state.emotion)}
        </span>
      </div>

      {topInterests.length > 0 && (
        <div className="result-row">
          <span className="dim">loves</span>
          <span className="result-tags">
            {topInterests.map(([domain, depth]) => (
              <span key={domain} className="interest-tag" style={{ borderColor: domainColor(domain), color: domainColor(domain) }}>
                {domain} {exact ? depth.toFixed(2) : `· ${describeDepth(depth)}`}
              </span>
            ))}
          </span>
        </div>
      )}

      <footer className="result-foot">
        <span className="dim">Hover the stars on your trail to revisit each answer.</span>
        <button className="result-replay" onClick={onReplay}>
          ▶ replay
        </button>
      </footer>
    </section>
  )
}
