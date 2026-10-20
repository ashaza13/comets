import { z } from 'zod'

// Mirrors backend/app/signals/models.py. Responses and persisted state are
// parsed through these so a malformed payload fails loudly at the boundary.

const Vec3 = z.object({ x: z.number(), y: z.number(), z: z.number() })

export const CometStateSchema = z.object({
  personality: Vec3,
  uncertainty: Vec3,
  emotion: z.object({ hue: z.number(), saturation: z.number(), lightness: z.number() }),
  interests: z.record(z.string(), z.number()),
  message_count: z.number().int(),
})

export const ObservationSchema = z.object({
  personality: z.object({ x: z.number().nullable(), y: z.number().nullable(), z: z.number().nullable() }),
  emotion: z.object({
    hue: z.number().nullable(),
    saturation: z.number().nullable(),
    lightness: z.number().nullable(),
  }),
  interests: z.array(z.object({ domain: z.string(), depth: z.number() })),
  confidence: z.number(),
  reasoning: z.string(),
})

export const ObserveResponseSchema = z.object({
  observation: ObservationSchema,
  state: CometStateSchema,
  next_prompt: z.string().nullable(),
})

export const EntryKindSchema = z.enum(['mood', 'card', 'topics', 'text'])

export const EntrySchema = z.object({
  id: z.string(),
  /** What happened, in words: the free text, or a summary of the tap. */
  text: z.string(),
  prompt: z.string().nullable(),
  observation: ObservationSchema,
  state: CometStateSchema,
  /** Journey step this answered; 'text' is optional free writing ("say more"). */
  kind: EntryKindSchema,
  cardId: z.string().optional(),
})

export type CometState = z.infer<typeof CometStateSchema>
export type Observation = z.infer<typeof ObservationSchema>
export type ObserveResponse = z.infer<typeof ObserveResponseSchema>
export type Entry = z.infer<typeof EntrySchema>
export type EntryKind = z.infer<typeof EntryKindSchema>

export const INITIAL_STATE: CometState = {
  personality: { x: 0, y: 0, z: 0 },
  uncertainty: { x: 1, y: 1, z: 1 },
  emotion: { hue: 200, saturation: 0.3, lightness: 0.5 },
  interests: {},
  message_count: 0,
}
