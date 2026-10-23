import { moodDoneToday, dailyStatement } from '../../lib/daily'
import { describeEmotion } from '../../lib/describe'
import { moodObservation, statementObservation } from '../../lib/journey'
import type { Entry } from '../../lib/schema'
import { RESPONSES, statementText } from '../../lib/statements'
import { useConstellation } from '../../groupStore'
import { useCometStore } from '../../store'
import { MoodWheel } from './MoodWheel'
import { StatementRating } from './StatementRating'

interface Props {
  entries: Entry[]
  today: number
  streak: number
}

/** Today's check-in: how you feel, then the statement everyone rates today. */
export function DailyPanel({ entries, today, streak }: Props) {
  const answer = useCometStore((s) => s.answer)
  const inCrew = useConstellation((s) => s.membership !== null && s.members.length > 1)
  const statement = dailyStatement(today)
  const moodDone = moodDoneToday(entries, today)
  const prompt = moodDone ? statementText(statement) : 'How are you today?'

  return (
    <div className="journey daily" role="region" aria-label="Today's check-in">
      <div className="daily-head">
        <span>Day {today}</span>
        <span className="daily-step">{moodDone ? '2 of 2' : '1 of 2'}</span>
        {streak > 0 && <span className="daily-streak">🔥 {streak}</span>}
      </div>

      {moodDone && <div className="journey-hint">{inCrew ? 'Today’s statement. Your friends will guess your answer' : 'Today’s statement, the same for everyone'}</div>}
      <h2 className="journey-prompt">{prompt}</h2>

      {!moodDone ? (
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
      ) : (
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
    </div>
  )
}
