import { useRef, useState, type PointerEvent } from 'react'
import { describeEmotion } from '../../lib/describe'

// Labels placed around the wheel at their hue (degrees clockwise from the top).
const LABELS: [number, string][] = [
  [0, 'frustrated'],
  [60, 'joyful'],
  [120, 'calm'],
  [200, 'reflective'],
  [270, 'anxious'],
]

interface Props {
  onDone: (hue: number, intensity: number, energy: number) => void
}

/**
 * Pick a feeling on a colour wheel: the angle is the kind of feeling, the
 * distance from the centre how strongly it's felt. A slider sets energy.
 */
export function MoodWheel({ onDone }: Props) {
  const wheel = useRef<HTMLDivElement>(null)
  const [pick, setPick] = useState<{ hue: number; intensity: number } | null>(null)
  const [energy, setEnergy] = useState(0.5)

  const choose = (e: PointerEvent<HTMLDivElement>) => {
    const rect = wheel.current?.getBoundingClientRect()
    if (!rect) return
    const dx = e.clientX - (rect.left + rect.width / 2)
    const dy = e.clientY - (rect.top + rect.height / 2)
    const radius = rect.width / 2
    const hue = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360
    setPick({ hue, intensity: Math.min(Math.hypot(dx, dy) / radius, 1) })
  }

  const marker = pick && {
    left: `${50 + 50 * pick.intensity * Math.sin((pick.hue * Math.PI) / 180)}%`,
    top: `${50 - 50 * pick.intensity * Math.cos((pick.hue * Math.PI) / 180)}%`,
  }

  return (
    <div className="mood">
      <div className="mood-wheel-wrap">
        <div
          ref={wheel}
          className="mood-wheel"
          role="slider"
          aria-label="How you feel: tap a colour; further from the centre is stronger"
          aria-valuetext={pick ? describeEmotion({ hue: pick.hue, saturation: pick.intensity, lightness: energy }) : 'not chosen'}
          tabIndex={0}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            choose(e)
          }}
          onPointerMove={(e) => {
            if (e.buttons) choose(e)
          }}
        >
          {marker && <span className="mood-marker" style={marker} />}
        </div>
        {LABELS.map(([hue, label]) => (
          <span
            key={label}
            className="mood-label"
            style={{
              left: `${50 + 61 * Math.sin((hue * Math.PI) / 180)}%`,
              top: `${50 - 58 * Math.cos((hue * Math.PI) / 180)}%`,
            }}
          >
            {label}
          </span>
        ))}
      </div>

      <label className="mood-energy">
        <span>drained</span>
        <input type="range" min={0} max={1} step={0.01} value={energy} onChange={(e) => setEnergy(Number(e.target.value))} aria-label="Energy" />
        <span>buzzing</span>
      </label>

      <div className="mood-reading">{pick ? describeEmotion({ hue: pick.hue, saturation: pick.intensity, lightness: energy }) : 'Tap the wheel'}</div>

      <button className="journey-primary" disabled={!pick} onClick={() => pick && onDone(pick.hue, pick.intensity, energy)}>
        That’s how I feel
      </button>
    </div>
  )
}
