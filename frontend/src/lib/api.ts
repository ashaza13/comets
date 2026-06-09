import type { MessageResponse, SessionState } from './types'

const BASE = '/api'

export async function createSession(): Promise<string> {
  const res = await fetch(`${BASE}/session`, { method: 'POST' })
  if (!res.ok) throw new Error(`Failed to create session: ${res.status}`)
  const data = await res.json()
  return data.session_id as string
}

export async function getSession(sessionId: string): Promise<SessionState> {
  const res = await fetch(`${BASE}/session/${sessionId}`)
  if (!res.ok) throw new Error(`Session not found: ${res.status}`)
  return res.json()
}

export async function sendMessage(sessionId: string, text: string): Promise<MessageResponse> {
  const res = await fetch(`${BASE}/session/${sessionId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error(`Message failed: ${res.status}`)
  return res.json()
}
