import { useEffect, useRef, useState } from 'react'
import { emotionCss } from '../lib/color'
import type { CometState, Entry, Observation } from '../lib/schema'
import { AXES, domainColor } from '../lib/spec'

function SignalReadout({ observation }: { observation: Observation }) {
  const { personality: p, emotion: e, interests, confidence, reasoning } = observation
  const axes = AXES.filter((a) => p[a.key] !== null)

  return (
    <div className="signal-readout">
      <div className="readout-row">
        <span className="dim">confidence</span>
        <span style={{ color: `hsl(${confidence * 120}, 80%, 60%)` }}>{(confidence * 100).toFixed(0)}%</span>
      </div>

      {axes.length > 0 && (
        <div className="readout-row">
          <span className="dim">reads as</span>
          <span>
            {axes.map((a) => {
              const v = p[a.key]!
              return (
                <span key={a.key} style={{ color: a.color, marginLeft: 6 }}>
                  {v >= 0 ? a.positive : a.negative} {Math.abs(v).toFixed(2)}
                </span>
              )
            })}
          </span>
        </div>
      )}

      {e.hue !== null && (
        <div className="readout-row">
          <span className="dim">emotion</span>
          <span style={{ color: emotionCss({ hue: e.hue, saturation: e.saturation ?? 0.5 }) }}>
            hue {e.hue.toFixed(0)}°{e.saturation !== null ? ` · ${(e.saturation * 100).toFixed(0)}%` : ''}
            {e.lightness !== null ? ` · energy ${(e.lightness * 100).toFixed(0)}%` : ''}
          </span>
        </div>
      )}

      {interests.length > 0 && (
        <div className="readout-interests">
          {interests.map((i) => (
            <span
              key={i.domain}
              className="interest-tag"
              style={{ borderColor: domainColor(i.domain), color: domainColor(i.domain) }}
            >
              {i.domain} {i.depth.toFixed(2)}
            </span>
          ))}
        </div>
      )}

      {reasoning && <div className="readout-reasoning">{reasoning}</div>}
    </div>
  )
}

function StatePanel({ state }: { state: CometState }) {
  const topInterests = Object.entries(state.interests)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  return (
    <div className="state-panel">
      {AXES.map((a) => {
        const v = state.personality[a.key]
        return (
          <div key={a.key} className="state-row">
            <span className="dim">{a.name}</span>
            <span style={{ color: a.color }}>
              {v >= 0 ? a.positive : a.negative} {Math.abs(v).toFixed(2)}
              <span className="dim"> ±{Math.sqrt(state.uncertainty[a.key]).toFixed(2)}</span>
            </span>
          </div>
        )
      })}
      <div className="state-row">
        <span className="dim">emotion</span>
        <span style={{ color: emotionCss(state.emotion) }}>
          {state.emotion.hue.toFixed(0)}° · {(state.emotion.saturation * 100).toFixed(0)}% · energy{' '}
          {(state.emotion.lightness * 100).toFixed(0)}%
        </span>
      </div>
      {topInterests.length > 0 && (
        <div className="state-row interests-row">
          <span className="dim">depth</span>
          <span>
            {topInterests.map(([domain, depth]) => (
              <span
                key={domain}
                className="interest-tag"
                style={{ borderColor: domainColor(domain), color: domainColor(domain) }}
              >
                {domain} {depth.toFixed(2)}
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
  promptSuggestion: string | null
  isLoading: boolean
  error: string | null
  onSend: (text: string) => void
  onReset: () => void
  onClose: () => void
}

export function ChatPanel({ state, entries, promptSuggestion, isLoading, error, onSend, onReset, onClose }: Props) {
  const [input, setInput] = useState('')
  const historyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight
    }
  }, [entries])

  const handleSubmit = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return
    setInput('')
    onSend(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(input)
    }
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <span className="chat-title">Personality Vectorscope</span>
        <div className="chat-header-right">
          {state && <span className="message-count">{state.message_count} signals</span>}
          {entries.length > 0 && (
            <button
              className="chat-reset-btn"
              onClick={() => window.confirm('Start a new comet? This clears your history on this device.') && onReset()}
            >
              new comet
            </button>
          )}
          <button className="chat-close-btn" onClick={onClose} aria-label="Close panel">✕</button>
        </div>
      </div>

      {state && <StatePanel state={state} />}

      <div className="chat-history" ref={historyRef}>
        {entries.length === 0 && (
          <div className="chat-empty">Start by answering the prompt below, or write freely.</div>
        )}

        {entries.map((entry) => (
          <div key={entry.id} className="chat-message">
            <div className="message-text">{entry.text}</div>
            <SignalReadout observation={entry.observation} />
          </div>
        ))}

        {isLoading && (
          <div className="chat-message loading-msg">
            <span className="loading-dots">extracting signals</span>
          </div>
        )}
      </div>

      {error && <div className="chat-error">{error}</div>}

      {promptSuggestion && entries.length === 0 && (
        <button
          className="prompt-suggestion"
          onClick={() => setInput(promptSuggestion)}
          disabled={isLoading}
        >
          {promptSuggestion}
        </button>
      )}

      {promptSuggestion && entries.length > 0 && (
        <div className="next-prompt">
          <span className="dim">next →</span>
          <button
            className="prompt-pill"
            onClick={() => setInput(promptSuggestion)}
            disabled={isLoading}
          >
            {promptSuggestion.length > 80
              ? promptSuggestion.slice(0, 80) + '…'
              : promptSuggestion}
          </button>
        </div>
      )}

      <div className="chat-input-row">
        <textarea
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write freely, or answer the prompt above…"
          disabled={isLoading}
          rows={3}
        />
        <button
          className="send-btn"
          onClick={() => handleSubmit(input)}
          disabled={isLoading || !input.trim()}
        >
          {isLoading ? '…' : '→'}
        </button>
      </div>
    </div>
  )
}
