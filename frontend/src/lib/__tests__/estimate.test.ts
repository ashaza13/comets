import { describe, expect, it } from 'vitest'
import cases from '../../../../backend/tests/fixtures/apply_observation.json'
import { applyObservation } from '../estimate'
import type { CometState, Observation } from '../schema'

describe('applyObservation (TypeScript port)', () => {
  it('matches the Python implementation on the shared fixture', () => {
    for (const { state, observation, expected } of cases as { state: CometState; observation: Observation; expected: CometState }[]) {
      const actual = applyObservation(state, observation)
      for (const group of ['personality', 'uncertainty', 'emotion'] as const) {
        for (const [k, v] of Object.entries(expected[group])) {
          expect(actual[group][k as keyof (typeof actual)[typeof group]]).toBeCloseTo(v as number, 9)
        }
      }
      expect(Object.keys(actual.interests).sort()).toEqual(Object.keys(expected.interests).sort())
      for (const [d, v] of Object.entries(expected.interests)) expect(actual.interests[d]).toBeCloseTo(v, 9)
      expect(actual.message_count).toBe(expected.message_count)
    }
  })
})
