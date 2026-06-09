import { useState, useEffect, useCallback, useRef } from 'react'
import { Scene } from './components/Scene'
import { ChatPanel } from './components/ChatPanel'
import { createSession, sendMessage } from './lib/api'
import type { SessionState, SignalDeltas } from './lib/types'

interface Message {
  id: string
  text: string
  deltas: SignalDeltas
}

export default function App() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [state, setState] = useState<SessionState | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [promptSuggestion, setPromptSuggestion] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const idCounter = useRef(0)

  useEffect(() => {
    createSession()
      .then((id) => {
        setSessionId(id)
        setPromptSuggestion(
          "What's been on your mind lately? Could be anything — work, something you saw, a feeling you can't shake.",
        )
      })
      .catch(() => setError('Could not connect to backend. Is it running on port 8000?'))
  }, [])

  const handleSend = useCallback(
    async (text: string) => {
      if (!sessionId) return
      setIsLoading(true)
      setError(null)
      try {
        const response = await sendMessage(sessionId, text)
        idCounter.current += 1
        setMessages((prev) => [
          ...prev,
          { id: String(idCounter.current), text, deltas: response.deltas },
        ])
        setState(response.state)
        setPromptSuggestion(response.prompt_suggestion)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    },
    [sessionId],
  )

  return (
    <div className="layout">
      <ChatPanel
        state={state}
        connected={sessionId !== null}
        messages={messages}
        promptSuggestion={promptSuggestion}
        isLoading={isLoading}
        error={error}
        onSend={handleSend}
      />
      <div className="scene-container">
        <Scene state={state} isLoading={isLoading} />
      </div>
    </div>
  )
}
