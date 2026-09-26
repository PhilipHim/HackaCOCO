import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CocoMark } from './CocoMark'

type Phrase = {
  de: string
  en: string
  keys: string[]
  audio: string
  line: string
}

type View = 'home' | 'live' | 'practice' | 'spots' | 'glasses'

const PHRASES: Phrase[] = [
  {
    de: 'gemütlich',
    en: 'cozy',
    keys: ['gemutlich', 'gemutlichkeit'],
    audio: '/whisper/cozy.m4a',
    line: 'The café was really gemütlich.',
  },
  {
    de: 'erschöpft',
    en: 'exhausted',
    keys: ['erschopft', 'erschoepft'],
    audio: '/whisper/exhausted.m4a',
    line: 'After an hour I was erschöpft.',
  },
  {
    de: 'unterbrechen',
    en: 'interrupt',
    keys: ['unterbrechen', 'unterbricht'],
    audio: '/whisper/interrupt.m4a',
    line: 'Sorry, I have to unterbrechen.',
  },
]

const TABS: { id: Exclude<View, 'home'>; label: string }[] = [
  { id: 'live', label: 'Live' },
  { id: 'practice', label: 'Practice' },
  { id: 'spots', label: 'Spots' },
  { id: 'glasses', label: 'Glasses' },
]

function fold(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[''`´]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function matchPhrase(transcript: string) {
  const heard = fold(transcript)
  if (!heard) return null
  return (
    PHRASES.find((phrase) => phrase.keys.some((key) => heard.includes(key))) ??
    null
  )
}

function answersMatch(typed: string, expected: string) {
  return fold(typed) === fold(expected)
}

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

export default function App() {
  const [view, setView] = useState<View>('home')
  const [holding, setHolding] = useState(false)
  const [latest, setLatest] = useState<Phrase | null>(null)
  const [saved, setSaved] = useState<string[]>([])
  const [passed, setPassed] = useState<string[]>([])
  const [suggesting, setSuggesting] = useState(false)
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
      current.includes(next.en) ? current : [next.en, ...current],
    )
    setSuggesting(false)
    play(next.audio)
  }

  function pass(next: Phrase) {
    setPassed((current) =>
      current.includes(next.en) ? current : [...current, next.en],
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
    setSuggesting(false)
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
      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      ) {
        return
      }
      event.preventDefault()
      startHold()
    }
    function onKeyUp(event: KeyboardEvent) {
      if (event.code !== 'Space') return
      if (viewRef.current !== 'live') return
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
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              data-active={view === tab.id}
              onClick={() => setView(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {view === 'home' ? (
        <Home onOpen={setView} />
      ) : null}

      {view === 'live' ? (
        <Live
          holding={holding}
          latest={latest}
          suggesting={suggesting}
          onHoldStart={startHold}
          onHoldEnd={endHold}
          onSuggest={() => setSuggesting(true)}
          onUseSuggestion={() => keep(PHRASES[0])}
        />
      ) : null}

      {view === 'practice' ? (
        <Practice
          focus={latest}
          passed={passed}
          onPass={pass}
          onHear={(item) => play(item.audio)}
          onReset={() => setPassed([])}
        />
      ) : null}

      {view === 'spots' ? (
        <Spots
          saved={saved}
          passed={passed}
          onPractice={() => setView('practice')}
        />
      ) : null}

      {view === 'glasses' ? (
        <Glasses onPlay={(item) => play(item.audio)} />
      ) : null}
    </div>
  )
}

function Home({ onOpen }: { onOpen: (view: View) => void }) {
  return (
    <main className="home">
      <CocoMark className="home-mark" />
      <h1>Conversation Copilot</h1>
      <p className="lede">
        You know the word. Under pressure it&apos;s gone. The English word
        comes back, and you say it yourself.
      </p>
      <p className="known">On Live, hold and say one of these.</p>
      <ul className="pairs">
        {PHRASES.map((item) => (
          <li key={item.en}>
            <span>{item.de}</span>
            <strong>{item.en}</strong>
          </li>
        ))}
      </ul>
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
        <button type="button" onClick={() => onOpen('live')}>
          <strong>Live</strong>
          <span>Hold the microphone when a word is missing.</span>
        </button>
        <button type="button" onClick={() => onOpen('practice')}>
          <strong>Practice</strong>
          <span>The German word stays. You write the English one.</span>
        </button>
        <button type="button" onClick={() => onOpen('spots')}>
          <strong>Spots</strong>
          <span>Words from that moment, until you can write them.</span>
        </button>
        <button type="button" onClick={() => onOpen('glasses')}>
          <strong>Glasses</strong>
          <span>The same word, in the lens. You still say it.</span>
        </button>
      </div>
    </main>
  )
}

function Live({
  holding,
  latest,
  suggesting,
  onHoldStart,
  onHoldEnd,
  onSuggest,
  onUseSuggestion,
}: {
  holding: boolean
  latest: Phrase | null
  suggesting: boolean
  onHoldStart: () => void
  onHoldEnd: () => void
  onSuggest: () => void
  onUseSuggestion: () => void
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
        {suggesting && !holding ? (
          <div className="suggest">
            <p>It was really</p>
            <button type="button" className="chip" onClick={onUseSuggestion}>
              cozy
            </button>
          </div>
        ) : (
          <button type="button" className="text-btn" onClick={onSuggest}>
            Next word from the conversation
          </button>
        )}
      </section>
    </main>
  )
}

function Practice({
  focus,
  passed,
  onPass,
  onHear,
  onReset,
}: {
  focus: Phrase | null
  passed: string[]
  onPass: (item: Phrase) => void
  onHear: (item: Phrase) => void
  onReset: () => void
}) {
  const ordered = focus
    ? [focus, ...PHRASES.filter((item) => item.en !== focus.en)]
    : PHRASES
  const queue = ordered.filter((item) => !passed.includes(item.en))
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState<'idle' | 'ok' | 'bad'>('idle')
  const [revealed, setRevealed] = useState(false)
  const [holdingCard, setHoldingCard] = useState<Phrase | null>(null)
  const current = holdingCard ?? queue[0] ?? null
  const done = !current && passed.length >= PHRASES.length

  function check(event?: FormEvent) {
    event?.preventDefault()
    if (!current || feedback === 'ok') return
    if (answersMatch(answer, current.en)) {
      setFeedback('ok')
      setHoldingCard(current)
      onPass(current)
      window.setTimeout(() => {
        setHoldingCard(null)
        setAnswer('')
        setFeedback('idle')
        setRevealed(false)
      }, 700)
      return
    }
    setFeedback('bad')
  }

  return (
    <main className="screen">
      <h1>{done ? 'You can say them.' : 'Write the English word.'}</h1>
      <p className="screen-lede">
        {done
          ? 'These three came back in the conversation. They stay with you.'
          : 'The German word stays on the card. You type the English one.'}
      </p>
      {current ? (
        <form className="quiz" onSubmit={check}>
          <p className="progress">
            {(holdingCard ? passed.length : passed.length + 1)} / {PHRASES.length}
          </p>
          <p className="quiz-word">{current.de}</p>
          <label className="quiz-label" htmlFor="english-word">
            English
          </label>
          <input
            id="english-word"
            value={answer}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Type it"
            data-state={feedback}
            onChange={(event) => {
              setAnswer(event.target.value)
              setFeedback('idle')
            }}
          />
          {feedback === 'ok' ? <p className="quiz-note">That one.</p> : null}
          {feedback === 'bad' ? (
            <p className="quiz-note">Not that spelling.</p>
          ) : null}
          {revealed ? <p className="quiz-reveal">{current.en}</p> : null}
          <div className="quiz-actions">
            <button type="submit" className="solid">
              Check
            </button>
            <button type="button" className="ghost" onClick={() => onHear(current)}>
              Hear it
            </button>
            <button
              type="button"
              className="text-btn"
              onClick={() => setRevealed(true)}
            >
              Show the English word
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="solid retry" onClick={onReset}>
          Practice again
        </button>
      )}
    </main>
  )
}

function Spots({
  saved,
  passed,
  onPractice,
}: {
  saved: string[]
  passed: string[]
  onPractice: () => void
}) {
  const open = PHRASES.filter((item) => !passed.includes(item.en))
  const cleared = PHRASES.filter((item) => passed.includes(item.en))

  return (
    <main className="screen">
      <h1>What to practice.</h1>
      <p className="screen-lede">
        Words from the moment you froze. Write them in Practice, and they
        clear.
      </p>
      <p className="counts">
        <strong>{open.length}</strong> open
        <strong>{cleared.length}</strong> cleared
      </p>
      <ul className="word-list">
        {PHRASES.map((item) => {
          const clear = passed.includes(item.en)
          return (
            <li key={item.en} data-clear={clear}>
              <div>
                <strong>{item.de}</strong>
                <span>
                  {clear ? item.en : 'Still open'}
                  {saved.includes(item.en) ? ' · from this talk' : ''}
                </span>
              </div>
              <em>{clear ? 'Clear' : 'Open'}</em>
            </li>
          )
        })}
      </ul>
      <button type="button" className="solid" onClick={onPractice}>
        Write them
      </button>
    </main>
  )
}

function Glasses({ onPlay }: { onPlay: (item: Phrase) => void }) {
  const [active, setActive] = useState<Phrase | null>(null)

  return (
    <main className="screen">
      <h1>In the lens.</h1>
      <p className="screen-lede">
        The missing word shows up where you are looking. You still say it.
      </p>
      <div className="frames" aria-hidden={active ? undefined : true}>
        <div className="lens">
          <span>{active?.en ?? ''}</span>
        </div>
        <div className="bridge" />
        <div className="lens" />
      </div>
      <div className="moments">
        {PHRASES.map((item) => (
          <button
            key={item.en}
            type="button"
            data-active={active?.en === item.en}
            onClick={() => {
              setActive(item)
              onPlay(item)
            }}
          >
            <strong>{item.de}</strong>
            <span>{item.line}</span>
          </button>
        ))}
      </div>
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
