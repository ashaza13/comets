import { lazy, Suspense, useState, useCallback, useMemo } from 'react'
import { Scene } from './components/Scene'
import { ChatPanel } from './components/ChatPanel'
import { IntroFlow, INTRO_COMPLETE_AT } from './components/IntroFlow'
import { isMapRevealed } from './lib/spec'
import { useCometStore } from './store'

type AppPhase = 'intro' | 'main'

const DEBUG = new URLSearchParams(window.location.search).has('debug')
const DebugPanel = lazy(() => import('./components/DebugPanel'))

export default function App() {
  const entries      = useCometStore((s) => s.entries)
  const nextPrompt   = useCometStore((s) => s.nextPrompt)
  const isLoading    = useCometStore((s) => s.isLoading)
  const error        = useCometStore((s) => s.error)
  const debugComet   = useCometStore((s) => s.debugComet)
  const send         = useCometStore((s) => s.send)
  const reset        = useCometStore((s) => s.reset)
  const chartMode    = useCometStore((s) => s.chartMode)
  const toggleChart  = useCometStore((s) => s.toggleChartMode)

  // Returning visitors with a saved comet skip straight to the sky.
  const [phase, setPhase]               = useState<AppPhase>(() => (entries.length > 0 || DEBUG ? 'main' : 'intro'))
  const [introExiting, setIntroExiting] = useState(false)
  const [chatOpen, setChatOpen]         = useState(false)

  const history = useMemo(() => entries.map((e) => e.state), [entries])
  const state = debugComet ?? history.at(-1) ?? null
  const demo = state === null
  // The axes stay hidden until every question is answered (always shown in ?debug).
  const revealed = DEBUG || isMapRevealed(entries.length)

  const leaveIntro = useCallback(() => {
    setIntroExiting(true)
    setTimeout(() => setPhase('main'), 650)
  }, [])

  // Transition out of intro after enough questions answered
  const handleSend = useCallback(
    async (text: string) => {
      await send(text)
      if (phase === 'intro' && useCometStore.getState().entries.length >= INTRO_COMPLETE_AT) leaveIntro()
    },
    [send, phase, leaveIntro],
  )

  const handleReset = useCallback(() => {
    reset()
    setChatOpen(false)
    setIntroExiting(false)
    setPhase('intro')
  }, [reset])

  return (
    <div className="layout">
      {DEBUG && (
        <Suspense fallback={null}>
          <DebugPanel />
        </Suspense>
      )}

      {/* Chat panel — hidden until user opens it */}
      <div className={`chat-panel-wrapper ${chatOpen ? 'chat-panel-wrapper--open' : ''}`}>
        <ChatPanel
          state={state}
          entries={entries}
          promptSuggestion={nextPrompt}
          isLoading={isLoading}
          error={error}
          onSend={handleSend}
          onReset={handleReset}
          onClose={() => setChatOpen(false)}
        />
      </div>

      {/* 3D scene — always rendered */}
      <div className="scene-container">
        <Scene state={state} history={debugComet ? [] : history} isLoading={isLoading} demo={demo} chartMode={chartMode} revealed={revealed} />
      </div>

      {/* Floating toggle button — visible in main phase when panel is closed */}
      {phase === 'main' && !chatOpen && (
        <button className="chat-open-btn" onClick={() => setChatOpen(true)}>
          ≡ signals
        </button>
      )}

      {phase === 'main' && revealed && (
        <button className="chart-toggle-btn" onClick={toggleChart} aria-pressed={chartMode}>
          {chartMode ? '✦ sky' : '◎ chart'}
        </button>
      )}

      {/* Intro overlay */}
      {phase === 'intro' && (
        <IntroFlow
          exiting={introExiting}
          promptSuggestion={nextPrompt}
          isLoading={isLoading}
          error={error}
          onSend={handleSend}
          messageCount={entries.length}
          onSkip={leaveIntro}
        />
      )}
    </div>
  )
}
