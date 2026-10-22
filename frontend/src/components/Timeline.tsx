interface Props {
  /** Number of answers in the journey. */
  total: number
  /** Current playhead, or null when showing the live (latest) state. */
  playhead: number | null
  playing: boolean
  onScrub: (value: number) => void
  onPlay: () => void
}

/** Scrubber for replaying the journey answer by answer. */
export function Timeline({ total, playhead, playing, onScrub, onPlay }: Props) {
  const value = playhead ?? total
  const passed = Math.min(Math.floor(value), total)
  return (
    <div className="timeline" role="group" aria-label="Journey timeline">
      <button className="timeline-play" onClick={onPlay} aria-label={playing ? 'Replaying' : 'Replay journey'} disabled={playing}>
        {playing ? '◌' : '▶'}
      </button>
      <input
        className="timeline-range"
        type="range"
        min={0}
        max={total}
        step={0.01}
        value={value}
        onChange={(e) => onScrub(Number(e.target.value))}
        aria-valuetext={`${passed} of ${total} answers`}
      />
      <span className="timeline-label">
        {passed}/{total}
      </span>
    </div>
  )
}
