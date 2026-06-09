import { useRef, useEffect, useState } from 'react'
import type { SessionState, SignalDeltas } from '../lib/types'
import { DOMAIN_COLORS } from '../lib/domains'

function SignalReadout({ deltas }: { deltas: SignalDeltas }) {
  const { personality: p, emotion: e, interests, confidence, reasoning } = deltas

  const fmtDelta = (v: number) =>
    v === 0 ? null : (
      <span style={{ color: v > 0 ? '#6bffb8' : '#ff6b6b' }}>
        {v > 0 ? '+' : ''}{v.toFixed(2)}
      </span>
    )

  return (
    <div className="signal-readout">
      <div className="readout-row">
        <span className="dim">confidence</span>
        <span style={{ color: `hsl(${confidence * 120}, 80%, 60%)` }}>
          {(confidence * 100).toFixed(0)}%
        </span>
      </div>

      {(p.x !== 0 || p.y !== 0 || p.z !== 0) && (
        <div className="readout-row">
          <span className="dim">position</span>
          <span>
            x{fmtDelta(p.x)} y{fmtDelta(p.y)} z{fmtDelta(p.z)}
          </span>
        </div>
      )}

      {(e.hue !== null || e.saturation !== null) && (
        <div className="readout-row">
          <span className="dim">emotion</span>
          <span
            style={{
              color: e.hue !== null
                ? `hsl(${e.hue}, ${(e.saturation ?? 0.5) * 100}%, 65%)`
                : undefined,
            }}
          >
            {e.hue !== null ? `hue ${e.hue.toFixed(0)}°` : '—'}
            {e.saturation !== null ? ` sat ${(e.saturation * 100).toFixed(0)}%` : ''}
            {e.lightness !== null ? ` lum ${(e.lightness * 100).toFixed(0)}%` : ''}
          </span>
        </div>
      )}

      {interests.length > 0 && (
        <div className="readout-interests">
          {interests.map((i) => (
            <span
              key={i.domain}
              className="interest-tag"
              style={{ borderColor: DOMAIN_COLORS[i.domain] ?? '#666', color: DOMAIN_COLORS[i.domain] ?? '#aaa' }}
            >
              {i.domain} {i.depth_delta > 0 ? '+' : ''}{i.depth_delta.toFixed(2)}
            </span>
          ))}
        </div>
      )}

      {reasoning && <div className="readout-reasoning">{reasoning}</div>}
    </div>
  )
}

function StatePanel({ state }: { state: SessionState }) {
  const topInterests = Object.entries(state.interests)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  return (
    <div className="state-panel">
      <div className="state-row">
        <span className="dim">position</span>
        <span>
          ({state.personality.x.toFixed(2)}, {state.personality.y.toFixed(2)}, {state.personality.z.toFixed(2)})
        </span>
      </div>
      <div className="state-row">
        <span className="dim">emotion</span>
        <span
          style={{
            color: `hsl(${state.emotion.hue}, ${state.emotion.saturation * 100}%, 65%)`,
          }}
        >
          {state.emotion.hue.toFixed(0)}° / {(state.emotion.saturation * 100).toFixed(0)}% / {(state.emotion.lightness * 100).toFixed(0)}%
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
                style={{ borderColor: DOMAIN_COLORS[domain] ?? '#666', color: DOMAIN_COLORS[domain] ?? '#aaa' }}
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

interface Message {
  id: string
  text: string
  deltas: SignalDeltas
}

interface Props {
  state: SessionState | null
  connected: boolean
  messages: Message[]
  promptSuggestion: string | null
  isLoading: boolean
  error: string | null
  onSend: (text: string) => void
}

export function ChatPanel({ state, connected, messages, promptSuggestion, isLoading, error, onSend }: Props) {
  const [input, setInput] = useState('')
  const historyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight
    }
  }, [messages])

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
        {state && (
          <span className="message-count">{state.message_count} signals</span>
        )}
      </div>

      {state && <StatePanel state={state} />}

      <div className="chat-history" ref={historyRef}>
        {messages.length === 0 && (
          <div className="chat-empty">
            {promptSuggestion
              ? 'Start by answering the prompt below, or write freely.'
              : 'Connecting…'}
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="chat-message">
            <div className="message-text">{msg.text}</div>
            <SignalReadout deltas={msg.deltas} />
          </div>
        ))}

        {isLoading && (
          <div className="chat-message loading-msg">
            <span className="loading-dots">extracting signals</span>
          </div>
        )}
      </div>

      {error && <div className="chat-error">{error}</div>}

      {promptSuggestion && messages.length === 0 && (
        <button
          className="prompt-suggestion"
          onClick={() => setInput(promptSuggestion)}
          disabled={isLoading}
        >
          {promptSuggestion}
        </button>
      )}

      {promptSuggestion && messages.length > 0 && (
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
          disabled={isLoading || !connected}
          rows={3}
        />
        <button
          className="send-btn"
          onClick={() => handleSubmit(input)}
          disabled={isLoading || !input.trim() || !connected}
        >
          {isLoading ? '…' : '→'}
        </button>
      </div>
    </div>
  )
}
