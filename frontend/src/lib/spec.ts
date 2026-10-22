// The axis, domain and prompt vocabulary is owned by the backend so the
// renderer and the extractor can never disagree about what a signal means.
import spec from '../../../backend/app/spec.json'

export type Vec3Tuple = [number, number, number]

export interface Axis {
  key: 'x' | 'y' | 'z'
  name: string
  negative: string
  positive: string
  description: string
}

/** The map's axes are drawn in one pale starlight, like a printed star chart. */
export const GRID_COLOR = '#c8cfdc'

export interface Domain {
  id: string
  direction: Vec3Tuple
  color: string
}

export const AXES = spec.axes as Axis[]
export const DOMAINS = spec.domains as Domain[]
export const DOMAIN_BY_ID: Record<string, Domain> = Object.fromEntries(DOMAINS.map((d) => [d.id, d]))
export const PROMPTS: string[] = spec.stages.flatMap((s) => s.prompts)

// Personality coordinates (−1…1) are scaled by this to world units. Large
// enough that each answer is a real voyage relative to the comet's size.
export const SPACE_SCALE = 20

export function domainColor(id: string): string {
  return DOMAIN_BY_ID[id]?.color ?? '#999'
}
