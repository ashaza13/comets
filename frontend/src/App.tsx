import { lazy, Suspense, useState, useCallback } from 'react'
import { Scene } from './components/Scene'
import { ChatPanel } from './components/ChatPanel'
import { IntroFlow } from './components/IntroFlow'
import { JourneyPanel } from './components/journey/JourneyPanel'
import { isJourneyComplete } from './lib/journey'
import { useCometStore } from './store'

type AppPhase = 'intro' | 'main'

const DEBUG = new URLSearchParams(window.location.search).has('debug')
const DebugPanel = lazy(() => import('./components/DebugPanel'))

export default function App() {
  const entries      = useCometStore((s) => s.entries)
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
  // First-time visitors get the fly-in from deep space.
  const [flyIn] = useState(() => entries.length === 0 && !DEBUG)
  const [chatOpen, setChatOpen]         = useState(false)

  // The axes stay hidden until the journey is complete (always shown in ?debug).
  const complete = isJourneyComplete(entries)
  const revealed = DEBUG || complete

  const leaveIntro = useCallback(() => {
    setIntroExiting(true)
    setTimeout(() => setPhase('main'), 650)
  }, [])


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
          state={debugComet ?? entries.at(-1)?.state ?? null}
          entries={entries}
          exact={chartMode && revealed}
          isLoading={isLoading}
          error={error}
          onSend={(text) => send(text, null)}
          onReset={handleReset}
          onClose={() => setChatOpen(false)}
        />
      </div>

      {/* 3D scene — always rendered */}
      <div className="scene-container">
        <Scene
          entries={entries}
          debugState={debugComet}
          isLoading={isLoading}
          chartMode={chartMode}
          revealed={revealed}
          showControls={phase === 'main'}
          flyIn={flyIn}
        />
      </div>

      {/* Floating toggle button — visible in main phase when panel is closed */}
      {phase === 'main' && !chatOpen && (
        <button className="chat-open-btn" onClick={() => setChatOpen(true)}>
          Signals
        </button>
      )}

      {phase === 'main' && !complete && !DEBUG && <JourneyPanel entries={entries} isLoading={isLoading} error={error} />}

      {phase === 'main' && revealed && (
        <button className="chart-toggle-btn" onClick={toggleChart} aria-pressed={chartMode}>
          {chartMode ? 'Sky view' : 'Chart view'}
        </button>
      )}

      {/* Intro overlay */}
      {phase === 'intro' && (
        <IntroFlow exiting={introExiting} onDone={leaveIntro} />
      )}
    </div>
  )
}
