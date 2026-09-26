import { useEffect, useRef, useState } from 'react'
import { CocoMark } from './CocoMark'

type Phrase = {
  de: string
  en: string
  keys: string[]
  audio: string
}

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

type Phase = 'idle' | 'holding' | 'hit' | 'miss' | 'empty' | 'nomike'

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
    PHRASES.find((phrase) =>
      phrase.keys.some((key) => heard.includes(key)),
    ) ?? null
  )
}

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [phrase, setPhrase] = useState<Phrase | null>(null)
  const [heard, setHeard] = useState('')
  const [practice, setPractice] = useState<string[]>([])
  const holdingRef = useRef(false)
  const heardRef = useRef('')
  const recRef = useRef<BrowserRecognition | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  function play(src: string) {
    audioRef.current?.pause()
    const audio = new Audio(src)
    audio.volume = 1
    audioRef.current = audio
    void audio.play().catch(() => {})
  }

  function reveal(next: Phrase) {
    setPhrase(next)
    setPhase('hit')
    setPractice((current) =>
      current.includes(next.en) ? current : [next.en, ...current],
    )
    play(next.audio)
  }

  function finish(transcript: string) {
    const cleaned = transcript.trim()
    setHeard(cleaned)
    if (!cleaned) {
      setPhrase(null)
      setPhase('empty')
      return
    }
    const found = matchPhrase(cleaned)
    if (!found) {
      setPhrase(null)
      setPhase('miss')
      return
    }
    reveal(found)
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
    if (holdingRef.current) return
    holdingRef.current = true
    heardRef.current = ''
    setHeard('')
    setPhase('holding')
    const rec = ensureRecognition()
    if (!rec) {
      holdingRef.current = false
      setPhase('nomike')
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
    if (!rec) return
    try {
      rec.stop()
    } catch {
      finish(heardRef.current)
    }
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== 'Space' || event.repeat) return
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

  const sentence =
    phase === 'hit' && phrase ? (
      <>
        It&apos;s really <em>{phrase.en}</em>.
      </>
    ) : (
      <>
        It&apos;s really <em>…</em>
      </>
    )

  return (
    <div className="app">
      <header className="top">
        <CocoMark className="mark" />
        <div>
          <div className="wordmark">Conversation Copilot</div>
          <div className="strokes" aria-hidden>
            <span />
            <span />
            <span />
          </div>
        </div>
      </header>

      <main className="stage">
        <section className="card" aria-live="polite">
          <p className="kicker">
            {phase === 'holding' ? 'Say it in German' : 'You are speaking'}
          </p>
          <h1 className="line">{sentence}</h1>
          {phase === 'hit' && phrase ? (
            <p className="word">{phrase.en}</p>
          ) : null}
          {phase === 'holding' ? (
            <p className="note">Hold, say the word, then let go.</p>
          ) : null}
          {phase === 'miss' ? (
            <p className="note">
              {heard ? `Heard “${heard}”. ` : ''}
              This demo only knows the pitch phrases.
            </p>
          ) : null}
          {phase === 'empty' ? (
            <p className="note">
              Hold a bit longer and say the German word.
            </p>
          ) : null}
          {phase === 'nomike' ? (
            <p className="note">
              This browser has no speech recognition. Tap a pitch phrase.
            </p>
          ) : null}
          {practice.length > 0 ? (
            <div className="practice">
              <p>To practice</p>
              {practice.map((word) => (
                <span className="chip" key={word}>
                  {word}
                </span>
              ))}
            </div>
          ) : null}
        </section>

        <div className="hold-row">
          <p className="hold-copy">
            Hold and say gemütlich, erschöpft, or unterbrechen.
            Space does the same.
          </p>
          <button
            type="button"
            className="hold"
            data-holding={phase === 'holding'}
            onPointerDown={(event) => {
              event.preventDefault()
              event.currentTarget.setPointerCapture(event.pointerId)
              startHold()
            }}
            onPointerUp={endHold}
            onPointerCancel={endHold}
            onContextMenu={(event) => event.preventDefault()}
          >
            {phase === 'holding' ? '…' : 'Hold'}
          </button>
        </div>

        <div className="fallbacks">
          <span>Or tap</span>
          {PHRASES.map((item) => (
            <button key={item.en} type="button" onClick={() => reveal(item)}>
              {item.de}
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}

type RecognitionAlternative = { transcript: string }

type RecognitionResult = {
  0?: RecognitionAlternative
  isFinal?: boolean
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
