import { useEffect, useRef, useState } from 'react'
import { emotionCss } from '../lib/color'
import { certaintyNote, describeAxis, describeConfidence, describeDepth, describeEmotion } from '../lib/describe'
import type { CometState, Entry, Observation } from '../lib/schema'
import { AXES, domainColor } from '../lib/spec'

const signed = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`

/** What one answer told us. Plain language, or exact numbers in chart mode. */
function SignalReadout({ observation, exact }: { observation: Observation; exact: boolean }) {
  const { personality: p, emotion: e, interests, confidence, reasoning } = observation
  const axes = AXES.filter((a) => p[a.key] !== null)

  return (
    <div className="signal-readout">
      {axes.length > 0 && (
        <div className="readout-row">
          <span className="dim">reads as</span>
          <span>
            {axes.map((a) => (
              <span key={a.key} style={{ color: a.color, marginLeft: 6 }}>
                {exact ? `${a.key} ${signed(p[a.key]!)}` : describeAxis(a, p[a.key]!)}
              </span>
            ))}
          </span>
        </div>
      )}

      {e.hue !== null && (
        <div className="readout-row">
          <span className="dim">feeling</span>
          <span style={{ color: emotionCss({ hue: e.hue, saturation: e.saturation ?? 0.5 }) }}>
            {exact
              ? `hue ${e.hue.toFixed(0)}° · ${((e.saturation ?? 0) * 100).toFixed(0)}% · energy ${((e.lightness ?? 0) * 100).toFixed(0)}%`
              : describeEmotion({ hue: e.hue, saturation: e.saturation ?? 0.5, lightness: e.lightness ?? 0.5 })}
          </span>
        </div>
      )}

      {interests.length > 0 && (
        <div className="readout-interests">
          {interests.map((i) => (
            <span key={i.domain} className="interest-tag" style={{ ['--tag' as string]: domainColor(i.domain) }}>
              {i.domain} {exact ? i.depth.toFixed(2) : `· ${describeDepth(i.depth)}`}
            </span>
          ))}
        </div>
      )}

      {exact && (
        <div className="readout-row">
          <span className="dim">confidence</span>
          <span>{(confidence * 100).toFixed(0)}%</span>
        </div>
      )}
      {!exact && confidence > 0 && confidence < 0.5 && <div className="readout-row dim">{describeConfidence(confidence)}</div>}

      {reasoning && <div className="readout-reasoning">{reasoning}</div>}
    </div>
  )
}

/** Where the comet is now. */
function StatePanel({ state, exact }: { state: CometState; exact: boolean }) {
  const topInterests = Object.entries(state.interests)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  return (
    <div className="state-panel">
      {AXES.map((a) => {
        const v = state.personality[a.key]
        const note = certaintyNote(state.uncertainty[a.key])
        return (
          <div key={a.key} className="state-row">
            <span className="dim state-axis">{a.name}</span>
            <span className="state-value">
              {exact ? (
                <>
                  {signed(v)}
                  <span className="dim"> ±{Math.sqrt(state.uncertainty[a.key]).toFixed(2)}</span>
                </>
              ) : note === 'no read yet' ? (
                <span className="dim">{note}</span>
              ) : (
                <>
                  {describeAxis(a, v)}
                  {note && <span className="dim"> · {note}</span>}
                </>
              )}
            </span>
          </div>
        )
      })}
      <div className="state-row">
        <span className="dim state-axis">feeling</span>
        <span style={{ color: emotionCss(state.emotion) }}>
          {exact
            ? `${state.emotion.hue.toFixed(0)}° · ${(state.emotion.saturation * 100).toFixed(0)}% · energy ${(state.emotion.lightness * 100).toFixed(0)}%`
            : describeEmotion(state.emotion)}
        </span>
      </div>
      {topInterests.length > 0 && (
        <div className="state-row interests-row">
          <span className="dim state-axis">loves</span>
          <span>
            {topInterests.map(([domain, depth]) => (
              <span key={domain} className="interest-tag" style={{ ['--tag' as string]: domainColor(domain) }}>
                {domain} {exact ? depth.toFixed(2) : `· ${describeDepth(depth)}`}
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  )
}

interface Props {
  state: CometState | null
  entries: Entry[]
  /** Show exact numbers (chart mode) instead of plain language. */
  exact: boolean
  isLoading: boolean
  error: string | null
  onSend: (text: string) => void
  onReset: () => void
  onClose: () => void
}

export function ChatPanel({ state, entries, exact, isLoading, error, onSend, onReset, onClose }: Props) {
  const [input, setInput] = useState('')
  const historyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight
  }, [entries])

  const handleSubmit = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return
    setInput('')
    onSend(trimmed)
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <span className="chat-title">Personality Vectorscope</span>
        <div className="chat-header-right">
          {entries.length > 0 && (
            <button
              className="chat-reset-btn"
              onClick={() => window.confirm('Start a new comet? This clears your history on this device.') && onReset()}
            >
              new comet
            </button>
          )}
          <button className="chat-close-btn" onClick={onClose} aria-label="Close panel">
            ✕
          </button>
        </div>
      </div>

      {state && <StatePanel state={state} exact={exact} />}

      <div className="chat-history" ref={historyRef}>
        {entries.length === 0 && <div className="chat-empty">Your answers will appear here.</div>}

        {entries.map((entry) => (
          <div key={entry.id} className="chat-message">
            {entry.prompt && <div className="message-prompt">{entry.prompt}</div>}
            <div className="message-text">{entry.text}</div>
            <SignalReadout observation={entry.observation} exact={exact} />
          </div>
        ))}

        {isLoading && (
          <div className="chat-message loading-msg">
            <span className="loading-dots">reading</span>
          </div>
        )}
      </div>

      {error && <div className="chat-error">{error}</div>}

      <div className="chat-input-row">
        <textarea
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit(input)
            }
          }}
          placeholder="Optional: say more in your own words…"
          disabled={isLoading}
          rows={3}
        />
        <button className="send-btn" onClick={() => handleSubmit(input)} disabled={isLoading || !input.trim()}>
          {isLoading ? '…' : '→'}
        </button>
      </div>
    </div>
  )
}
