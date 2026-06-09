import { useState, useEffect, useCallback, useRef } from 'react'
import { Scene } from './components/Scene'
import { ChatPanel } from './components/ChatPanel'
import { IntroFlow, INTRO_COMPLETE_AT } from './components/IntroFlow'
import { createSession, sendMessage } from './lib/api'
import type { SessionState, SignalDeltas } from './lib/types'

interface Message {
  id: string
  text: string
  deltas: SignalDeltas
}

type AppPhase = 'intro' | 'main'

export default function App() {
  const [sessionId, setSessionId]               = useState<string | null>(null)
  const [state, setState]                       = useState<SessionState | null>(null)
  const [messages, setMessages]                 = useState<Message[]>([])
  const [promptSuggestion, setPromptSuggestion] = useState<string | null>(null)
  const [isLoading, setIsLoading]               = useState(false)
  const [error, setError]                       = useState<string | null>(null)
  const [phase, setPhase]                       = useState<AppPhase>('intro')
  const [introExiting, setIntroExiting]         = useState(false)
  const [chatOpen, setChatOpen]                 = useState(false)
  const idCounter                               = useRef(0)

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

  // Transition out of intro after enough questions answered
  useEffect(() => {
    if (phase === 'intro' && messages.length >= INTRO_COMPLETE_AT) {
      setIntroExiting(true)
      setTimeout(() => setPhase('main'), 650)
    }
  }, [messages.length, phase])

  const skipIntro = useCallback(() => {
    setIntroExiting(true)
    setTimeout(() => setPhase('main'), 650)
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

      {/* Chat panel — hidden until user opens it */}
      <div className={`chat-panel-wrapper ${chatOpen ? 'chat-panel-wrapper--open' : ''}`}>
        <ChatPanel
          state={state}
          connected={sessionId !== null}
          messages={messages}
          promptSuggestion={promptSuggestion}
          isLoading={isLoading}
          error={error}
          onSend={handleSend}
          onClose={() => setChatOpen(false)}
        />
      </div>

      {/* 3D scene — always rendered */}
      <div className="scene-container">
        <Scene
          state={state}
          isLoading={isLoading}
          demoMode={messages.length === 0}
        />
      </div>

      {/* Floating toggle button — visible in main phase when panel is closed */}
      {phase === 'main' && !chatOpen && (
        <button className="chat-open-btn" onClick={() => setChatOpen(true)}>
          ≡ signals
        </button>
      )}

      {/* Intro overlay */}
      {phase === 'intro' && (
        <IntroFlow
          exiting={introExiting}
          connected={sessionId !== null}
          promptSuggestion={promptSuggestion}
          isLoading={isLoading}
          error={error}
          onSend={handleSend}
          messageCount={messages.length}
          onSkip={skipIntro}
        />
      )}

    </div>
  )
}
