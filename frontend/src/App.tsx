import { lazy, Suspense, useState, useCallback, useEffect } from 'react'
import { ChatPanel } from './components/ChatPanel'
import { IntroFlow } from './components/IntroFlow'
import { DailyPanel } from './components/journey/DailyPanel'
import { JourneyPanel } from './components/journey/JourneyPanel'
import { useCrewSync } from './hooks/useCrewSync'
import { useDailySync } from './hooks/useDailySync'
import { canCheckIn, checkInDays, dayNumber, streak } from './lib/daily'
import { useConstellation } from './groupStore'
import { useConstellationSync } from './hooks/useConstellationSync'
import { isJourneyComplete } from './lib/journey'
import { useCometStore } from './store'

type AppPhase = 'intro' | 'main'

const DEBUG = new URLSearchParams(window.location.search).has('debug')
const DebugPanel = lazy(() => import('./components/DebugPanel'))

// The 3D scene (three.js, R3F, postprocessing) is most of the code, so it ships
// as its own chunk. The download starts straight away, in parallel with the
// intro, rather than when the scene first renders.
const sceneModule = import('./components/Scene')
const Scene = lazy(() => sceneModule.then((m) => ({ default: m.Scene })))

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
  const finalState = entries.at(-1)?.state ?? null
  useConstellationSync(finalState, complete)
  const invited = useConstellation((s) => s.invite !== null && s.enabled === true)

  // Today's day number, refreshed each minute so a session left open over
  // midnight offers the next check-in.
  const [today, setToday] = useState(() => dayNumber(new Date()))
  useEffect(() => {
    const id = window.setInterval(() => setToday(dayNumber(new Date())), 60_000)
    return () => window.clearInterval(id)
  }, [])
  // After the first journey, a short check-in once a day.
  const checkingIn = phase === 'main' && complete && !DEBUG && canCheckIn(entries, today)
  const checkedIn = complete && !canCheckIn(entries, today)
  useDailySync(entries, today, checkedIn)
  useCrewSync(entries, today, checkedIn)

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

      {/* 3D scene — always rendered (loaded as its own chunk) */}
      <div className="scene-container">
        <Suspense fallback={<div className="scene-fallback" />}>
          <Scene
            entries={entries}
            debugState={debugComet}
            isLoading={isLoading}
            chartMode={chartMode}
            revealed={revealed}
            showControls={phase === 'main'}
            flyIn={flyIn}
            today={today}
            checkingIn={checkingIn}
          />
        </Suspense>
      </div>

      {/* Floating toggle button — visible in main phase when panel is closed */}
      {phase === 'main' && !chatOpen && (
        <button
          className={`chat-open-btn ${(!complete || checkingIn) && !DEBUG ? 'chat-open-btn--journey' : ''}`}
          onClick={() => setChatOpen(true)}
        >
          Signals
        </button>
      )}

      {phase === 'main' && !complete && !DEBUG && <JourneyPanel entries={entries} isLoading={isLoading} error={error} />}
      {checkingIn && <DailyPanel entries={entries} today={today} streak={streak(checkInDays(entries), today)} />}

      {phase === 'main' && revealed && !checkingIn && (
        <button className="chart-toggle-btn" onClick={toggleChart} aria-pressed={chartMode}>
          {chartMode ? 'Sky view' : 'Chart view'}
        </button>
      )}

      {/* Intro overlay */}
      {phase === 'intro' && (
        <IntroFlow exiting={introExiting} onDone={leaveIntro} invited={invited} />
      )}
    </div>
  )
}
