import type { Entry, Observation } from './schema'
import { RESPONSES, STATEMENTS, statementReading, statementText, type Statement } from './statements'

// The journey: one mood check, the personality statements, then interests.
export const STATEMENT_STEPS = STATEMENTS.length
export const JOURNEY_STEPS = 1 + STATEMENT_STEPS + 1

export type StepKind = 'mood' | 'statement' | 'topics'

export function stepKind(completed: number): StepKind | null {
  if (completed === 0) return 'mood'
  if (completed <= STATEMENT_STEPS) return 'statement'
  if (completed === STATEMENT_STEPS + 1) return 'topics'
  return null
}

// Interest levels offered when picking topics, and the depth each one reports.
export const DEPTH_LEVELS = [
  { label: 'curious', depth: 0.35 },
  { label: 'into it', depth: 0.65 },
  { label: 'obsessed', depth: 0.95 },
] as const

const NO_PERSONALITY = { x: null, y: null, z: null }
const NO_EMOTION = { hue: null, saturation: null, lightness: null }

export function moodObservation(hue: number, intensity: number, energy: number): Observation {
  return {
    personality: NO_PERSONALITY,
    emotion: { hue, saturation: intensity, lightness: energy },
    interests: [],
    // A direct report of how you feel is about as clear a signal as we get.
    confidence: 0.9,
    reasoning: 'Your own read on how you feel right now.',
  }
}

// One rating is a noisy measurement; four per axis add up to a fair estimate.
const STATEMENT_CONFIDENCE = 0.7

/** A 1–5 rating of a statement, or null when it was skipped (counts as a step, tells us nothing). */
export function statementObservation(statement: Statement, response: number | null): Observation {
  const personality: Observation['personality'] = { x: null, y: null, z: null }
  if (response !== null) personality[statement.axis] = statementReading(statement, response)
  return {
    personality,
    emotion: NO_EMOTION,
    interests: [],
    confidence: response === null ? 0 : STATEMENT_CONFIDENCE,
    reasoning:
      response === null
        ? 'Skipped.'
        : `Rated “${statementText(statement)}” as ${RESPONSES[response - 1].toLowerCase()}.`,
  }
}

export function topicsObservation(picks: Record<string, number>): Observation {
  const interests = Object.entries(picks).map(([domain, level]) => ({ domain, depth: DEPTH_LEVELS[level].depth }))
  return {
    personality: NO_PERSONALITY,
    emotion: NO_EMOTION,
    interests,
    confidence: 1,
    reasoning: interests.length ? `Lit up by ${interests.map((i) => i.domain).join(', ')}.` : 'No topics picked.',
  }
}

/** Journey steps answered so far (free writing doesn't count). */
export function completedSteps(entries: Entry[]): number {
  return entries.filter((e) => e.kind !== 'text').length
}

/** The map is revealed once every journey step has been answered. */
export function isJourneyComplete(entries: Entry[]): boolean {
  return completedSteps(entries) >= JOURNEY_STEPS
}

export function answeredStatements(entries: Entry[]): Set<string> {
  return new Set(entries.flatMap((e) => (e.statementId ? [e.statementId] : [])))
}
