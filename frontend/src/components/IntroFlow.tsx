import { useState, useEffect, useRef, useCallback } from 'react'
import { AXES } from '../lib/spec'

interface Slide {
  eyebrow: string | null
  title: string | null
  body: string | null
  axes: { color: string; label: string; desc: string }[] | null
  cta: string | null
  autoAdvance: number | null
}

const SLIDES: Slide[] = [
  {
    eyebrow: null,
    title: 'Personality\nVectorscope',
    body: 'A living map of who you are, built in real time from how you write.',
    axes: null,
    cta: null,
    autoAdvance: 3200,
  },
  {
    eyebrow: 'how it works',
    title: 'Your words carry signals.',
    body: 'Emotional tone. Curiosity. Ways of thinking. Every message you send moves your comet through three-dimensional space, and its tail remembers the path.',
    axes: null,
    cta: null,
    autoAdvance: 4800,
  },
  {
    eyebrow: 'three axes',
    title: null,
    body: null,
    axes: AXES.map((a) => ({ color: a.color, label: `${a.negative} ↔ ${a.positive}`, desc: a.description })),
    cta: null,
    autoAdvance: 4800,
  },
  {
    eyebrow: 'reading the comet',
    title: null,
    body: 'Its colour is your mood. Its glow is your energy. Jets mark the subjects you know deeply. The haze tightens as the scope gets surer of you.',
    axes: null,
    cta: null,
    autoAdvance: 5600,
  },
  {
    eyebrow: 'ready',
    title: 'No right answers.',
    body: 'Just respond honestly. The scope reads the signals in how you write.',
    axes: null,
    cta: 'Begin',
    autoAdvance: null,
  },
]

// After this many answered questions, App transitions to main layout
export const INTRO_COMPLETE_AT = 3

interface Props {
  exiting: boolean
  promptSuggestion: string | null
  isLoading: boolean
  error: string | null
  onSend: (text: string) => void
  messageCount: number
  onSkip: () => void
}

type InternalPhase = 'slides' | 'questions'

export function IntroFlow({
  exiting,
  promptSuggestion,
  isLoading,
  error,
  onSend,
  messageCount,
  onSkip,
}: Props) {
  const [internalPhase, setInternalPhase] = useState<InternalPhase>('slides')
  const [slideIdx, setSlideIdx]           = useState(0)
  const [contentVisible, setContentVisible] = useState(true)
  const [input, setInput]                 = useState('')
  const textareaRef                       = useRef<HTMLTextAreaElement>(null)

  const slide = SLIDES[slideIdx]

  const fadeTransition = useCallback((cb: () => void) => {
    setContentVisible(false)
    setTimeout(() => { cb(); setContentVisible(true) }, 380)
  }, [])

  const advanceSlide = useCallback(() => {
    if (slideIdx < SLIDES.length - 1) {
      fadeTransition(() => setSlideIdx(s => s + 1))
    } else {
      fadeTransition(() => setInternalPhase('questions'))
    }
  }, [slideIdx, fadeTransition])

  // ── Slide auto-advance ────────────────────────────────────────────────────
  useEffect(() => {
    if (internalPhase !== 'slides' || !slide.autoAdvance) return
    const id = setTimeout(() => advanceSlide(), slide.autoAdvance)
    return () => clearTimeout(id)
  }, [slide.autoAdvance, internalPhase, advanceSlide])

  // Focus textarea when entering questions phase
  useEffect(() => {
    if (internalPhase === 'questions') {
      setTimeout(() => textareaRef.current?.focus(), 400)
    }
  }, [internalPhase])

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return
    setInput('')
    onSend(trimmed)
  }, [input, isLoading, onSend])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={`intro-overlay ${exiting ? 'intro-overlay--exiting' : ''}`}>

      {/* Skip link */}
      <button className="intro-skip" onClick={onSkip} tabIndex={0}>
        skip →
      </button>

      <div className={`intro-content ${contentVisible ? 'intro-content--visible' : ''}`}>

        {/* ── SLIDES ─────────────────────────────────────────────────────── */}
        {internalPhase === 'slides' && (
          <div className="intro-slide">
            {slide.eyebrow && (
              <span className="intro-eyebrow">{slide.eyebrow}</span>
            )}

            {slide.title && (
              <h1 className="intro-title">
                {slide.title.split('\n').map((line, i) => (
                  <span key={i}>{line}{i < slide.title!.split('\n').length - 1 && <br />}</span>
                ))}
              </h1>
            )}

            {slide.body && (
              <p className="intro-body">{slide.body}</p>
            )}

            {slide.axes && (
              <div className="intro-axes">
                {slide.axes.map((ax) => (
                  <div key={ax.label} className="intro-axis-row">
                    <span className="intro-axis-label" style={{ color: ax.color }}>{ax.label}</span>
                    <span className="intro-axis-desc">{ax.desc}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="intro-slide-footer">
              {slide.cta ? (
                <button className="intro-cta" onClick={advanceSlide}>
                  {slide.cta}
                </button>
              ) : (
                <div className="intro-dots">
                  {SLIDES.map((_, i) => (
                    <button
                      key={i}
                      className={`intro-dot ${i === slideIdx ? 'intro-dot--active' : i < slideIdx ? 'intro-dot--done' : ''}`}
                      onClick={() => fadeTransition(() => setSlideIdx(i))}
                      aria-label={`Slide ${i + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── QUESTIONS ──────────────────────────────────────────────────── */}
        {internalPhase === 'questions' && (
          <div className="intro-questions">
            <div className="intro-q-progress">
              {Array.from({ length: INTRO_COMPLETE_AT }).map((_, i) => (
                <span
                  key={i}
                  className={`intro-q-dot ${messageCount > i ? 'intro-q-dot--filled' : ''}`}
                />
              ))}
            </div>

            <div className={`intro-q-prompt ${isLoading ? 'intro-q-prompt--loading' : ''}`}>
              {promptSuggestion ?? '…'}
            </div>

            {error && <div className="intro-q-error">{error}</div>}

            <div className="intro-q-input-row">
              <textarea
                ref={textareaRef}
                className="intro-q-textarea"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isLoading ? 'reading your signal…' : 'Write freely…'}
                disabled={isLoading}
                rows={4}
              />
              <button
                className="intro-q-submit"
                onClick={handleSubmit}
                disabled={isLoading || !input.trim()}
              >
                {isLoading ? '…' : '→'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
