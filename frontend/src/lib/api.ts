import { ObserveResponseSchema, type CometState, type ObserveResponse } from './schema'

const BASE = '/api'

export async function observe(text: string, prompt: string | null, state: CometState | null): Promise<ObserveResponse> {
  let res: Response
  try {
    res = await fetch(`${BASE}/observe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, prompt, state }),
    })
  } catch {
    throw new Error('Could not reach the backend.')
  }
  if (!res.ok) {
    const detail = await res.json().then((b) => b?.detail).catch(() => null)
    throw new Error(typeof detail === 'string' ? detail : `Request failed (${res.status}).`)
  }
  return ObserveResponseSchema.parse(await res.json())
}
