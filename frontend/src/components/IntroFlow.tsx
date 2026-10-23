import { useState, useEffect, useCallback, useRef } from 'react'
import { JOURNEY_STEPS } from '../lib/journey'
import { AXES } from '../lib/spec'

interface Slide {
  eyebrow: string | null
  title: string | null
  body: string | null
  axes: { label: string; desc: string }[] | null
  cta: string | null
}

// A horizontal drag this long (px) is a swipe rather than a tap.
const SWIPE_PX = 40

const SLIDES: Slide[] = [
  {
    eyebrow: null,
    title: 'Personality\nVectorscope',
    body: 'A living map of who you are, drawn from how you feel, how you choose and what you love.',
    axes: null,
    cta: null,
  },
  {
    eyebrow: 'how it works',
    title: 'Every choice carries a signal.',
    body: 'A mood. A preference. A passion. Each one moves your comet through three-dimensional space, and its tail remembers the path.',
    axes: null,
    cta: null,
  },
  {
    eyebrow: 'three axes',
    title: null,
    body: null,
    axes: AXES.map((a) => ({ label: `${a.negative} ↔ ${a.positive}`, desc: a.description })),
    cta: null,
  },
  {
    eyebrow: 'reading the comet',
    title: null,
    body: 'Its colour is your mood. Its glow is your energy. Jets mark the subjects you know deeply. The haze tightens as the scope gets surer of you.',
    axes: null,
    cta: null,
  },
  {
    eyebrow: 'ready',
    title: 'No right answers.',
    body: `First, set up your comet: about a minute of quick taps (${JOURNEY_STEPS} in all). After that it's one statement a day, and guessing how your friends answered it.`,
    axes: null,
    cta: 'Begin',
  },
]

interface Props {
  exiting: boolean
  /** Leave the intro (Begin or skip). */
  onDone: () => void
  /** Opened from a friend's constellation link. */
  invited?: boolean
}

export function IntroFlow({ exiting, onDone, invited = false }: Props) {
  const [slideIdx, setSlideIdx] = useState(0)
  const [contentVisible, setContentVisible] = useState(true)
  const slide = SLIDES[slideIdx]

  const fadeTransition = useCallback((cb: () => void) => {
    setContentVisible(false)
    setTimeout(() => {
      cb()
      setContentVisible(true)
    }, 380)
  }, [])

  const advanceSlide = useCallback(() => {
    if (slideIdx < SLIDES.length - 1) fadeTransition(() => setSlideIdx((s) => s + 1))
    else onDone()
  }, [slideIdx, fadeTransition, onDone])

  const goBack = useCallback(() => {
    if (slideIdx > 0) fadeTransition(() => setSlideIdx((s) => s - 1))
  }, [slideIdx, fadeTransition])

  // Readers set their own pace: tap or swipe, or the arrow keys, Space or Enter.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        advanceSlide()
      } else if (e.key === 'ArrowLeft') goBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advanceSlide, goBack])

  const press = useRef<{ x: number; y: number } | null>(null)
  const onPointerUp = (e: React.PointerEvent) => {
    const start = press.current
    press.current = null
    if (!start) return
    const dx = e.clientX - start.x
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(e.clientY - start.y)) {
      if (dx < 0) advanceSlide()
      else goBack()
    } else advanceSlide()
  }

  // A gentle hint that the reader moves on, once they've had time to read.
  const [hint, setHint] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setHint(true), 1500)
    return () => clearTimeout(id)
  }, [])

  // Buttons inside the overlay handle their own clicks, not the tap-to-advance.
  const own = { onPointerDown: (e: React.PointerEvent) => e.stopPropagation(), onPointerUp: (e: React.PointerEvent) => e.stopPropagation() }

  return (
    <div
      className={`intro-overlay ${exiting ? 'intro-overlay--exiting' : ''}`}
      onPointerDown={(e) => {
        press.current = { x: e.clientX, y: e.clientY }
      }}
      onPointerUp={onPointerUp}
    >
      <button className="intro-skip" onClick={onDone} tabIndex={0} {...own}>
        Skip intro
      </button>

      <div className={`intro-content ${contentVisible ? 'intro-content--visible' : ''}`}>
        <div className="intro-slide">
          {slide.eyebrow && <span className="intro-eyebrow">{slide.eyebrow}</span>}

          {slide.title && (
            <h1 className="intro-title">
              {slide.title.split('\n').map((line, i, lines) => (
                <span key={i}>
                  {line}
                  {i < lines.length - 1 && <br />}
                </span>
              ))}
            </h1>
          )}

          {slide.body && <p className="intro-body">{slide.body}</p>}

          {invited && slideIdx === 0 && (
            <p className="intro-invite">A friend shared their constellation. Take the journey, then see where you land beside them.</p>
          )}

          {slide.axes && (
            <div className="intro-axes">
              {slide.axes.map((ax) => (
                <div key={ax.label} className="intro-axis-row">
                  <span className="intro-axis-label">
                    {ax.label}
                  </span>
                  <span className="intro-axis-desc">{ax.desc}</span>
                </div>
              ))}
            </div>
          )}

          <div className="intro-slide-footer">
            {slide.cta ? (
              <button className="intro-cta" onClick={advanceSlide} {...own}>
                {slide.cta}
              </button>
            ) : (
              <div className="intro-dots">
                {SLIDES.map((_, i) => (
                  <button
                    key={i}
                    className={`intro-dot ${i === slideIdx ? 'intro-dot--active' : i < slideIdx ? 'intro-dot--done' : ''}`}
                    onClick={() => fadeTransition(() => setSlideIdx(i))}
                    {...own}
                    aria-label={`Slide ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={`intro-hint ${hint && !slide.cta ? 'intro-hint--on' : ''}`} aria-hidden>
        Tap to continue
      </div>
    </div>
  )
}
