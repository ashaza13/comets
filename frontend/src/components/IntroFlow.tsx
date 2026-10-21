import { useState, useEffect, useCallback } from 'react'
import { JOURNEY_STEPS } from '../lib/journey'
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
    body: 'A living map of who you are, drawn from how you feel, how you choose and what you love.',
    axes: null,
    cta: null,
    autoAdvance: 3200,
  },
  {
    eyebrow: 'how it works',
    title: 'Every choice carries a signal.',
    body: 'A mood. A preference. A passion. Each one moves your comet through three-dimensional space, and its tail remembers the path.',
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
    body: `About a minute of quick taps (${JOURNEY_STEPS} in all). Your comet travels with each one, and the full map of where you are appears at the end.`,
    axes: null,
    cta: 'Begin',
    autoAdvance: null,
  },
]

interface Props {
  exiting: boolean
  /** Leave the intro (Begin or skip). */
  onDone: () => void
}

export function IntroFlow({ exiting, onDone }: Props) {
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

  // ── Slide auto-advance ────────────────────────────────────────────────────
  useEffect(() => {
    if (!slide.autoAdvance) return
    const id = setTimeout(() => advanceSlide(), slide.autoAdvance)
    return () => clearTimeout(id)
  }, [slide.autoAdvance, advanceSlide])

  return (
    <div className={`intro-overlay ${exiting ? 'intro-overlay--exiting' : ''}`}>
      <button className="intro-skip" onClick={onDone} tabIndex={0}>
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

          {slide.axes && (
            <div className="intro-axes">
              {slide.axes.map((ax) => (
                <div key={ax.label} className="intro-axis-row">
                  <span className="intro-axis-label" style={{ color: ax.color }}>
                    {ax.label}
                  </span>
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
      </div>
    </div>
  )
}
