import { useEffect, useRef, useState } from 'react'

// Minimal typing for the Web Speech API (not in TypeScript's DOM lib everywhere).
interface Recognition {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
}
type RecognitionCtor = new () => Recognition

function speechRecognition(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

interface Props {
  prompt: string
  isLoading: boolean
  onSend: (text: string, prompt: string) => void
}

/** Optional: add a few words, typed or spoken, for a richer reading. */
export function SayMore({ prompt, isLoading, onSend }: Props) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const recognition = useRef<Recognition | null>(null)
  const Speech = speechRecognition()

  useEffect(() => () => recognition.current?.stop(), [])

  const toggleListening = () => {
    if (!Speech) return
    if (listening) {
      recognition.current?.stop()
      return
    }
    const r = new Speech()
    r.lang = navigator.language
    r.interimResults = false
    r.continuous = false
    r.onresult = (e) => {
      const said = Array.from(e.results)
        .map((result) => result[0].transcript)
        .join(' ')
      setText((t) => (t ? `${t} ${said}` : said))
    }
    r.onend = () => setListening(false)
    recognition.current = r
    setListening(true)
    r.start()
  }

  const submit = () => {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return
    onSend(trimmed, prompt)
    setText('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button className="journey-link" onClick={() => setOpen(true)}>
        ✎ say more
      </button>
    )
  }

  return (
    <div className="saymore">
      <textarea
        className="saymore-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
        }}
        placeholder={Speech ? 'A sentence or two — type or tap the mic' : 'A sentence or two'}
        rows={2}
        autoFocus
      />
      <div className="saymore-actions">
        {Speech && (
          <button className={`saymore-mic ${listening ? 'saymore-mic--on' : ''}`} onClick={toggleListening} aria-pressed={listening}>
            {listening ? '● listening' : '🎙 speak'}
          </button>
        )}
        <button className="journey-link" onClick={() => setOpen(false)}>
          cancel
        </button>
        <button className="journey-primary journey-primary--small" disabled={!text.trim() || isLoading} onClick={submit}>
          {isLoading ? 'reading…' : 'add'}
        </button>
      </div>
    </div>
  )
}
