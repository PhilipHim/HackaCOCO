import { useEffect, useRef, useState } from 'react'
import { CocoMark } from './CocoMark'

type Phrase = {
  de: string
  en: string
  keys: string[]
  audio: string
}

type View = 'home' | 'live' | 'practice'

const PHRASES: Phrase[] = [
  {
    de: 'gemütlich',
    en: 'cozy',
    keys: ['gemutlich', 'gemutlichkeit'],
    audio: '/whisper/cozy.m4a',
  },
  {
    de: 'erschöpft',
    en: 'exhausted',
    keys: ['erschopft', 'erschoepft'],
    audio: '/whisper/exhausted.m4a',
  },
  {
    de: 'unterbrechen',
    en: 'interrupt',
    keys: ['unterbrechen', 'unterbricht'],
    audio: '/whisper/interrupt.m4a',
  },
]

function fold(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
}

function matchPhrase(transcript: string) {
  const heard = fold(transcript)
  if (!heard.trim()) return null
  return (
    PHRASES.find((phrase) => phrase.keys.some((key) => heard.includes(key))) ??
    null
  )
}

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

export default function App() {
  const [view, setView] = useState<View>('home')
  const [holding, setHolding] = useState(false)
  const [latest, setLatest] = useState<Phrase | null>(null)
  const [saved, setSaved] = useState<Phrase[]>([])
  const holdingRef = useRef(false)
  const heardRef = useRef('')
  const recRef = useRef<BrowserRecognition | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const viewRef = useRef<View>('home')
  viewRef.current = view

  function play(src: string) {
    audioRef.current?.pause()
    const audio = new Audio(src)
    audio.volume = 1
    audioRef.current = audio
    void audio.play().catch(() => {})
  }

  function keep(next: Phrase) {
    setLatest(next)
    setSaved((current) =>
      current.some((item) => item.en === next.en) ? current : [next, ...current],
    )
    play(next.audio)
  }

  function finish(transcript: string) {
    const found = matchPhrase(transcript)
    if (found) keep(found)
    setHolding(false)
  }

  function ensureRecognition() {
    if (recRef.current) return recRef.current
    const Ctor = getRecognitionCtor()
    if (!Ctor) return null
    const rec = new Ctor()
    rec.lang = 'de-DE'
    rec.interimResults = true
    rec.continuous = true
    rec.onresult = (event: RecognitionResultEvent) => {
      let text = ''
      for (let i = 0; i < event.results.length; i++) {
        text += `${event.results[i][0]?.transcript ?? ''} `
      }
      heardRef.current = text
    }
    rec.onend = () => {
      if (holdingRef.current) {
        try {
          rec.start()
        } catch {
          /* Chrome throws if start overlaps stop. */
        }
        return
      }
      finish(heardRef.current)
    }
    rec.onerror = () => {
      if (!holdingRef.current) finish(heardRef.current)
    }
    recRef.current = rec
    return rec
  }

  function startHold() {
    if (viewRef.current !== 'live' || holdingRef.current) return
    holdingRef.current = true
    heardRef.current = ''
    setHolding(true)
    setLatest(null)
    const rec = ensureRecognition()
    if (!rec) {
      holdingRef.current = false
      setHolding(false)
      return
    }
    try {
      rec.start()
    } catch {
      /* already listening */
    }
  }

  function endHold() {
    if (!holdingRef.current) return
    holdingRef.current = false
    const rec = recRef.current
    if (!rec) {
      setHolding(false)
      return
    }
    try {
      rec.stop()
    } catch {
      finish(heardRef.current)
    }
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== 'Space' || event.repeat) return
      if (viewRef.current !== 'live') return
      event.preventDefault()
      startHold()
    }
    function onKeyUp(event: KeyboardEvent) {
      if (event.code !== 'Space') return
      event.preventDefault()
      endHold()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  return (
    <div className="shell">
      <header className="nav">
        <button type="button" className="brand" onClick={() => setView('home')}>
          <CocoMark className="mark" />
          <span>Conversation Copilot</span>
        </button>
        <nav className="tabs" aria-label="Sections">
          <button
            type="button"
            data-active={view === 'live'}
            onClick={() => setView('live')}
          >
            Live
          </button>
          <button
            type="button"
            data-active={view === 'practice'}
            onClick={() => setView('practice')}
          >
            Practice
          </button>
        </nav>
      </header>

      {view === 'home' ? (
        <Home
          onLive={() => setView('live')}
          onPractice={() => setView('practice')}
        />
      ) : null}

      {view === 'live' ? (
        <Live
          holding={holding}
          latest={latest}
          onHoldStart={startHold}
          onHoldEnd={endHold}
        />
      ) : null}

      {view === 'practice' ? (
        <Practice saved={saved} onHear={(item) => play(item.audio)} />
      ) : null}
    </div>
  )
}

function Home({
  onLive,
  onPractice,
}: {
  onLive: () => void
  onPractice: () => void
}) {
  return (
    <main className="home">
      <CocoMark className="home-mark" />
      <h1>Conversation Copilot</h1>
      <p className="lede">
        You know the word. Under pressure it&apos;s gone. The English word
        comes back, and you say it yourself.
      </p>
      <div className="clips">
        <video
          src="/clips/outside.mp4"
          poster="/clips/outside.jpg"
          controls
          playsInline
          preload="metadata"
        />
        <video
          src="/clips/ear.mp4"
          poster="/clips/ear.jpg"
          controls
          playsInline
          preload="metadata"
        />
      </div>
      <div className="paths">
        <button type="button" onClick={onLive}>
          <strong>Live</strong>
          <span>Hold the microphone when a word is missing.</span>
        </button>
        <button type="button" onClick={onPractice}>
          <strong>Practice</strong>
          <span>The words from that moment, so you can say them again.</span>
        </button>
      </div>
    </main>
  )
}

function Live({
  holding,
  latest,
  onHoldStart,
  onHoldEnd,
}: {
  holding: boolean
  latest: Phrase | null
  onHoldStart: () => void
  onHoldEnd: () => void
}) {
  return (
    <main className="live">
      <section className="mic-card">
        <div className="live-copy">
          <h1>{holding ? 'Listening.' : 'When the word is gone.'}</h1>
          <p>
            {holding
              ? 'Say it in German, then let go.'
              : 'Hold the microphone and say the missing word in German.'}
          </p>
        </div>
        {latest ? <p className="word">{latest.en}</p> : null}
        <div className="mic-wrap">
          {holding ? (
            <div className="rec-pulse" aria-hidden>
              <span />
              <span />
              <span />
            </div>
          ) : null}
          <button
            type="button"
            className="mic"
            data-holding={holding}
            aria-label="Hold to say the missing word"
            onPointerDown={(event) => {
              event.preventDefault()
              event.currentTarget.setPointerCapture(event.pointerId)
              onHoldStart()
            }}
            onPointerUp={onHoldEnd}
            onPointerCancel={onHoldEnd}
            onContextMenu={(event) => event.preventDefault()}
          >
            <MicIcon />
          </button>
        </div>
        <p className="mic-label">{holding ? 'Release' : 'Hold'}</p>
      </section>
    </main>
  )
}

function Practice({
  saved,
  onHear,
}: {
  saved: Phrase[]
  onHear: (item: Phrase) => void
}) {
  return (
    <main className="practice">
      <h1>Practice</h1>
      {saved.length === 0 ? (
        <p className="empty">Words from a conversation land here.</p>
      ) : (
        <ul>
          {saved.map((item) => (
            <li key={item.en}>
              <div>
                <strong>{item.en}</strong>
                <span>{item.de}</span>
              </div>
              <button type="button" onClick={() => onHear(item)}>
                Hear it
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="mic-icon">
      <path
        fill="currentColor"
        d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"
      />
    </svg>
  )
}

type RecognitionAlternative = { transcript: string }

type RecognitionResult = {
  0?: RecognitionAlternative
}

type RecognitionResultEvent = {
  results: ArrayLike<RecognitionResult>
}

type BrowserRecognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: RecognitionResultEvent) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}

type RecognitionCtor = new () => BrowserRecognition

declare global {
  interface Window {
    SpeechRecognition?: RecognitionCtor
    webkitSpeechRecognition?: RecognitionCtor
  }
}
