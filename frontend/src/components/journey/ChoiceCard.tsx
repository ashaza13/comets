import type { Card, CardOption } from '../../lib/cards'

interface Props {
  card: Card
  onChoose: (option: CardOption) => void
  onSkip: () => void
}

/** Two options; tap the one that pulls you. */
export function ChoiceCard({ card, onChoose, onSkip }: Props) {
  return (
    <div className="choice">
      <div className="choice-options">
        {[card.a, card.b].map((option) => (
          <button key={option.label} className="choice-option" onClick={() => onChoose(option)}>
            {option.label}
          </button>
        ))}
      </div>
      <button className="journey-link" onClick={onSkip}>
        neither — skip
      </button>
    </div>
  )
}
