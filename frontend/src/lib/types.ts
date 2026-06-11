export interface PersonalityDelta {
  x: number
  y: number
  z: number
}

export interface EmotionTarget {
  hue: number | null
  saturation: number | null
  lightness: number | null
}

export interface InterestDelta {
  domain: string
  depth_delta: number
}

export interface SignalDeltas {
  personality: PersonalityDelta
  emotion: EmotionTarget
  interests: InterestDelta[]
  confidence: number
  reasoning: string
}

export interface PersonalityPosition {
  x: number
  y: number
  z: number
}

export interface EmotionState {
  hue: number
  saturation: number
  lightness: number
}

export interface HistoryEntry {
  input_text: string
  deltas: SignalDeltas
}

export interface SessionState {
  session_id: string
  personality: PersonalityPosition
  emotion: EmotionState
  interests: Record<string, number>
  history: HistoryEntry[]
  message_count: number
}

export interface MessageResponse {
  deltas: SignalDeltas
  state: SessionState
  prompt_suggestion: string | null
}

export interface SelectedInterest {
  id: string
  label: string
  path: string[]
  depth: number
}
