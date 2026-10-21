import {
  DEPTH_LEVELS,
  JOURNEY_STEPS,
  answeredStatements,
  completedSteps,
  moodObservation,
  statementObservation,
  stepKind,
  topicsObservation,
} from '../../lib/journey'
import { describeEmotion } from '../../lib/describe'
import { RESPONSES, nextStatement, statementText } from '../../lib/statements'
import type { Entry } from '../../lib/schema'
import { useCometStore } from '../../store'
import { MoodWheel } from './MoodWheel'
import { SayMore } from './SayMore'
import { StatementRating } from './StatementRating'
import { TopicPicker } from './TopicPicker'

const MOOD_PROMPT = 'How are you, right now?'
const TOPICS_PROMPT = 'What lights you up?'

interface Props {
  entries: Entry[]
  isLoading: boolean
  error: string | null
}

/** The guided journey: a mood check, the personality statements, then interests. */
export function JourneyPanel({ entries, isLoading, error }: Props) {
  const answer = useCometStore((s) => s.answer)
  const send = useCometStore((s) => s.send)

  const done = completedSteps(entries)
  const kind = stepKind(done)
  if (!kind) return null

  const statement = kind === 'statement' ? nextStatement(answeredStatements(entries)) : null
  const prompt = kind === 'mood' ? MOOD_PROMPT : kind === 'topics' ? TOPICS_PROMPT : statement ? statementText(statement) : ''

  return (
    <div className="journey" role="region" aria-label="Journey">
      <div className="journey-progress">
        <div className="journey-progress-track" aria-hidden>
          <div className="journey-progress-fill" style={{ width: `${(done / JOURNEY_STEPS) * 100}%` }} />
        </div>
        <span>
          {done + 1} of {JOURNEY_STEPS}
        </span>
      </div>

      {kind === 'statement' && <div className="journey-hint">How well does this describe you, as you generally are?</div>}
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

      {kind === 'statement' && statement && (
        <StatementRating
          key={statement.id}
          onRate={(response) =>
            answer({
              kind: 'statement',
              observation: statementObservation(statement, response),
              text: response === null ? 'Skipped' : RESPONSES[response - 1],
              prompt,
              statementId: statement.id,
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
      {kind === 'statement' && (
        <div className="journey-credit">
          Statements from the <a href="https://ipip.ori.org" target="_blank" rel="noreferrer">International Personality Item Pool</a> (public domain)
        </div>
      )}
    </div>
  )
}
