import { RESPONSES } from '../../lib/statements'

interface Props {
  /** Called with the response, 1 (very inaccurate) to 5 (very accurate), or null to skip. */
  onRate: (response: number | null) => void
  /** Offer "skip" (not when guessing a friend's answer). */
  skippable?: boolean
  disabled?: boolean
}

/** The five-point IPIP response scale; tap how well the statement describes you. */
export function StatementRating({ onRate, skippable = true, disabled = false }: Props) {
  return (
    <div className="rating">
      <div className="rating-options" role="group" aria-label="How accurately does this describe you?">
        {RESPONSES.map((label, i) => (
          <button key={label} className={`rating-option rating-option--${i + 1}`} onClick={() => onRate(i + 1)} disabled={disabled}>
            <span className="rating-dot" aria-hidden>
              <span className="rating-mark" />
            </span>
            <span className="rating-label">{label}</span>
          </button>
        ))}
      </div>
      {skippable && (
        <button className="journey-link" onClick={() => onRate(null)}>
          skip
        </button>
      )}
    </div>
  )
}
