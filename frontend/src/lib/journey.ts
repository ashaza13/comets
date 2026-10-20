import type { Card, CardOption } from './cards'
import type { Entry, Observation } from './schema'

// The journey: one mood check, a run of this-or-that cards, then interests.
export const CARD_STEPS = 8
export const JOURNEY_STEPS = 1 + CARD_STEPS + 1

export type StepKind = 'mood' | 'card' | 'topics'

export function stepKind(completed: number): StepKind | null {
  if (completed === 0) return 'mood'
  if (completed <= CARD_STEPS) return 'card'
  if (completed === CARD_STEPS + 1) return 'topics'
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

export function cardObservation(card: Card, chosen: CardOption): Observation {
  const other = chosen === card.a ? card.b : card.a
  return {
    personality: {
      x: chosen.loadings.x ?? null,
      y: chosen.loadings.y ?? null,
      z: chosen.loadings.z ?? null,
    },
    emotion: NO_EMOTION,
    interests: [],
    // A single forced choice is a noisy measurement; the estimate firms up as they add up.
    confidence: 0.55,
    reasoning: `Picked “${chosen.label}” over “${other.label}”.`,
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

export function usedCards(entries: Entry[]): Set<string> {
  return new Set(entries.flatMap((e) => (e.cardId ? [e.cardId] : [])))
}
