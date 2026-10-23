import { z } from 'zod'
import type { CometState } from './schema'

// Constellations: a shared link where friends compare where they landed.
// Mirrors backend/app/groups.py. Only a name and the final reading are shared,
// never the answers.

const BASE = '/api'
const Vec3 = z.object({ x: z.number(), y: z.number(), z: z.number() })

export const MemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  personality: Vec3,
  uncertainty: Vec3,
  emotion: z.object({ hue: z.number(), saturation: z.number(), lightness: z.number() }),
  interests: z.record(z.string(), z.number()),
  updated_at: z.number(),
})

export const GroupSchema = z.object({ id: z.string(), members: z.array(MemberSchema) })

export type Member = z.infer<typeof MemberSchema>
export type Group = z.infer<typeof GroupSchema>

export const MAX_NAME_LENGTH = 24
const GROUP_ID = /^[A-Za-z0-9]{10}$/

/** The constellation a link points to (`?c=…`), or null. */
export function groupIdFromSearch(search: string): string | null {
  const id = new URLSearchParams(search).get('c')
  return id && GROUP_ID.test(id) ? id : null
}

export function shareUrl(groupId: string, origin = window.location.origin): string {
  return `${origin}/?c=${groupId}`
}

/** A per-device secret for writing your own entry; never shown to anyone. */
export function newMemberSecret(): string {
  return crypto.randomUUID().replaceAll('-', '')
}

// Opposite corners of the personality cube are this far apart.
const MAX_DISTANCE = 2 * Math.sqrt(3)

/** How alike two readings are, 0 (opposite corners) to 1 (the same place). */
export function likeness(a: CometState['personality'], b: CometState['personality']): number {
  const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
  return Math.max(0, 1 - d / MAX_DISTANCE)
}

/** Interests both people hold, strongest first. */
export function sharedInterests(a: Record<string, number>, b: Record<string, number>, min = 0.05): string[] {
  return Object.keys(a)
    .filter((d) => a[d] > min && (b[d] ?? 0) > min)
    .sort((x, y) => a[y] + b[y] - (a[x] + b[x]))
}

export class SharingError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

export async function request<T>(path: string, schema: z.ZodType<T> | null, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } })
  } catch {
    throw new SharingError('Could not reach the server.', 0)
  }
  if (!res.ok) {
    const detail = await res.json().then((b) => b?.detail).catch(() => null)
    throw new SharingError(typeof detail === 'string' ? detail : `Request failed (${res.status}).`, res.status)
  }
  return schema ? schema.parse(await res.json()) : (undefined as T)
}

export const api = {
  enabled: () => request('/sharing', z.object({ enabled: z.boolean() })).then((r) => r.enabled),
  create: () => request('/groups', z.object({ id: z.string() }), { method: 'POST' }).then((r) => r.id),
  get: (id: string) => request(`/groups/${id}`, GroupSchema),
  join: (id: string, secret: string, name: string, state: CometState) =>
    request(`/groups/${id}/members/${secret}`, MemberSchema, { method: 'PUT', body: JSON.stringify({ name, state }) }),
  leave: (id: string, secret: string) => request(`/groups/${id}/members/${secret}`, null, { method: 'DELETE' }),
}
