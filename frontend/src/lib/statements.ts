// Self-report statements from the International Personality Item Pool (IPIP,
// https://ipip.ori.org), which is in the public domain. The wording and keys are
// the published ones; don't edit an item's text, since the wording is the
// measurement. Each axis gets four items, two keyed each way, so agreeing with
// everything doesn't push the comet anywhere.
//
// - x introvert → extrovert: Extraversion, Mini-IPIP (Donnellan et al., 2006).
// - y concrete → abstract: Intellect, from the Mini-IPIP, the 50-item IPIP
//   Big-Five factor markers and the IPIP-NEO Intellect facet.
// - z practical → imaginative: imagination and aesthetics, from the Mini-IPIP
//   and the Openness aspect of the Big Five Aspect Scales (DeYoung et al., 2007).

export type AxisKey = 'x' | 'y' | 'z'

export interface Statement {
  id: string
  /** The IPIP item, exactly as published (first person, without the "I"). */
  item: string
  axis: AxisKey
  /** +1 if agreeing moves towards the axis's positive pole, −1 if away from it. */
  key: 1 | -1
  source: string
}

// Interleaved across axes and keys, so neighbouring statements don't pull the same way.
export const STATEMENTS: Statement[] = [
  { id: 'life-of-party', item: 'Am the life of the party.', axis: 'x', key: 1, source: 'Mini-IPIP' },
  { id: 'vivid-imagination', item: 'Have a vivid imagination.', axis: 'z', key: 1, source: 'Mini-IPIP' },
  { id: 'abstract-interest', item: 'Am not interested in abstract ideas.', axis: 'y', key: -1, source: 'Mini-IPIP' },
  { id: 'talk-a-lot', item: 'Don’t talk a lot.', axis: 'x', key: -1, source: 'Mini-IPIP' },
  { id: 'vocabulary', item: 'Have a rich vocabulary.', axis: 'y', key: 1, source: 'IPIP Big-Five factor markers' },
  { id: 'daydream', item: 'Seldom daydream.', axis: 'z', key: -1, source: 'BFAS Openness' },
  { id: 'parties', item: 'Talk to a lot of different people at parties.', axis: 'x', key: 1, source: 'Mini-IPIP' },
  { id: 'complex-problems', item: 'Like to solve complex problems.', axis: 'y', key: 1, source: 'IPIP-NEO Intellect' },
  { id: 'art', item: 'Believe in the importance of art.', axis: 'z', key: 1, source: 'BFAS Openness' },
  { id: 'background', item: 'Keep in the background.', axis: 'x', key: -1, source: 'Mini-IPIP' },
  { id: 'good-imagination', item: 'Do not have a good imagination.', axis: 'z', key: -1, source: 'Mini-IPIP' },
  { id: 'abstract-difficulty', item: 'Have difficulty understanding abstract ideas.', axis: 'y', key: -1, source: 'Mini-IPIP' },
]

/** The standard IPIP response scale, 1–5. */
export const RESPONSES = ['Very inaccurate', 'Moderately inaccurate', 'Neither accurate nor inaccurate', 'Moderately accurate', 'Very accurate'] as const

/** The statement as shown: "Am the life of the party." → "I am the life of the party." */
export function statementText(s: Statement): string {
  return `I ${s.item.charAt(0).toLowerCase()}${s.item.slice(1)}`
}

/** Where a response places you on the statement's axis: −1…1, 0 for "neither". */
export function statementReading(s: Statement, response: number): number {
  return (s.key * (response - 3)) / 2
}

/** The next statement not yet answered, in bank order; null once all are done. */
export function nextStatement(answered: Set<string>): Statement | null {
  return STATEMENTS.find((s) => !answered.has(s.id)) ?? null
}
