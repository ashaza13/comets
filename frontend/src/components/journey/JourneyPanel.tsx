import { nextCard, type Card } from '../../lib/cards'
import { JOURNEY_STEPS, cardObservation, completedSteps, moodObservation, stepKind, topicsObservation, usedCards } from '../../lib/journey'
import { describeEmotion } from '../../lib/describe'
import { DEPTH_LEVELS } from '../../lib/journey'
import { INITIAL_STATE, type Entry } from '../../lib/schema'
import { useCometStore } from '../../store'
import { ChoiceCard } from './ChoiceCard'
import { MoodWheel } from './MoodWheel'
import { SayMore } from './SayMore'
import { TopicPicker } from './TopicPicker'

const MOOD_PROMPT = 'How are you, right now?'
const TOPICS_PROMPT = 'What lights you up?'

interface Props {
  entries: Entry[]
  isLoading: boolean
  error: string | null
}

/** The guided journey: a mood check, a run of this-or-that cards, then interests. */
export function JourneyPanel({ entries, isLoading, error }: Props) {
  const answer = useCometStore((s) => s.answer)
  const send = useCometStore((s) => s.send)

  const done = completedSteps(entries)
  const kind = stepKind(done)
  if (!kind) return null

  const uncertainty = entries.at(-1)?.state.uncertainty ?? INITIAL_STATE.uncertainty
  const card: Card | null = kind === 'card' ? nextCard(usedCards(entries), uncertainty) : null
  const prompt = kind === 'mood' ? MOOD_PROMPT : kind === 'topics' ? TOPICS_PROMPT : (card?.prompt ?? '')

  return (
    <div className="journey" role="region" aria-label="Journey">
      <div className="journey-progress" aria-label={`Step ${done + 1} of ${JOURNEY_STEPS}`}>
        {Array.from({ length: JOURNEY_STEPS }, (_, i) => (
          <span key={i} className={`journey-dot ${i < done ? 'journey-dot--done' : i === done ? 'journey-dot--now' : ''}`} />
        ))}
      </div>

      <h2 className="journey-prompt">{prompt}</h2>

      {kind === 'mood' && (
        <MoodWheel
          onDone={(hue, intensity, energy) =>
            answer({
              kind: 'mood',
              observation: moodObservation(hue, intensity, energy),
              text: `Feeling ${describeEmotion({ hue, saturation: intensity, lightness: energy })}`,
              prompt,
            })
          }
        />
      )}

      {kind === 'card' && card && (
        <ChoiceCard
          key={card.id}
          card={card}
          onChoose={(option) =>
            answer({ kind: 'card', observation: cardObservation(card, option), text: `Chose “${option.label}”`, prompt, cardId: card.id })
          }
          onSkip={() =>
            answer({
              kind: 'card',
              // A skipped card still counts as a step but tells us nothing.
              observation: { ...cardObservation(card, card.a), personality: { x: null, y: null, z: null }, confidence: 0, reasoning: 'Skipped.' },
              text: 'Skipped',
              prompt,
              cardId: card.id,
            })
          }
        />
      )}

      {kind === 'topics' && (
        <TopicPicker
          onDone={(picks) =>
            answer({
              kind: 'topics',
              observation: topicsObservation(picks),
              text: Object.keys(picks).length
                ? Object.entries(picks)
                    .map(([d, level]) => `${d} (${DEPTH_LEVELS[level].label})`)
                    .join(', ')
                : 'None picked',
              prompt,
            })
          }
        />
      )}

      <SayMore key={prompt} prompt={prompt} isLoading={isLoading} onSend={send} />
      {error && <div className="journey-error">{error}</div>}
    </div>
  )
}
