import { useState } from 'react'
import { Blot } from '../components/Blot'
import { Card, RisoButton } from '../components/riso'
import { useGame } from '../game/context'
import { c, shadows, text } from '../theme'

/** Ink-ish names to shuffle through, so naming never requires spelling. */
const IDEAS = ['Splodge', 'Inky', 'Dot', 'Puddle', 'Smudge', 'Bubble', 'Pip', 'Blob', 'Nib', 'Sploosh']

/** First launch only: the one and only place the child types — and even here,
 * typing is optional at both steps (skip straight in, or shuffle a name). */
export function NameEntry() {
  const { confirmName, nameBlot, play, state } = useGame()
  const [step, setStep] = useState<'me' | 'blot'>('me')
  const [value, setValue] = useState(state.name ?? '')
  const [blot, setBlot] = useState('')
  const [nudge, setNudge] = useState(false)

  const shake = () => {
    setNudge(false)
    requestAnimationFrame(() => setNudge(true))
    play('wrong')
  }

  const submitMe = (raw: string) => {
    if (!raw.trim()) {
      shake()
      return
    }
    setNudge(false)
    play('pop')
    // renaming from Settings shouldn't re-run the introduction
    if (state.blotName) confirmName(raw)
    else setStep('blot')
  }

  /** finish: their name, then the drop's. Blank keeps the default. */
  const finish = (blotRaw: string) => {
    confirmName(value)
    nameBlot(blotRaw)
  }

  const input = (
    v: string,
    set: (s: string) => void,
    placeholder: string,
    onEnter: () => void,
  ) => (
    <input
      type="text"
      maxLength={14}
      placeholder={placeholder}
      autoComplete="off"
      autoFocus
      value={v}
      onChange={(e) => set(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onEnter()
      }}
      style={{
        width: '100%',
        maxWidth: 300,
        textAlign: 'center',
        ...text.display,
        color: c.ink,
        background: '#fff',
        border: 'none',
        outline: nudge ? `2px solid ${c.pink}` : 'none',
        borderRadius: 14,
        padding: '13px 16px',
        boxShadow: `inset 0 0 0 1px ${c.line}, ${shadows.dropSm}`,
        animation: nudge ? 'shakeX .45s ease' : undefined,
      }}
    />
  )

  const quiet = {
    ...text.meta,
    color: c.hint,
    background: 'none',
    border: 'none',
    textDecoration: 'underline',
    textUnderlineOffset: 3,
    cursor: 'pointer',
    padding: 6,
  } as const

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Card radius={18} style={{ width: 'min(440px, 92vw)', padding: '30px 28px 24px', textAlign: 'center', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <Blot size={step === 'blot' ? 84 : 64} mood={step === 'blot' ? 'happy' : 'idle'} name={state.blotName} />
        </div>

        {step === 'me' ? (
          <>
            <div style={{ ...text.eyebrow, color: c.faint }}>A print studio of your own</div>
            <div style={{ ...text.hero, margin: '10px 0 0', color: c.ink }}>Make &amp; Draw</div>
            <div style={{ ...text.lede, color: nudge ? c.pink : c.hint, margin: '10px 0 16px' }} aria-live="polite">
              {nudge ? 'type a name to start!' : 'Hello! What should we call you?'}
            </div>
            {input(value, setValue, 'type here', () => submitMe(value))}
            <div style={{ marginTop: 18 }}>
              <RisoButton onClick={() => submitMe(value)} style={{ padding: '13px 28px' }}>
                That's me →
              </RisoButton>
            </div>
            <button onClick={() => (state.blotName ? confirmName('') : setStep('blot'))} style={quiet}>
              skip — just start making
            </button>
            <div style={{ ...text.meta, color: c.faint, marginTop: 6 }}>
              it goes on the cover of your collection · change it any time in settings
            </div>
          </>
        ) : (
          <>
            <div style={{ ...text.eyebrow, color: c.faint }}>Someone lives here</div>
            <div style={{ ...text.hero, margin: '10px 0 0', color: c.ink }}>Who's this?</div>
            <div style={{ ...text.lede, color: c.hint, margin: '10px 0 16px' }}>
              A drop of ink that got curious. What shall we call them?
            </div>
            {input(blot, setBlot, 'Blot', () => finish(blot))}
            <div style={{ marginTop: 10 }}>
              <button
                onClick={() => {
                  // shuffle, never repeating what's already in the box
                  const pick = IDEAS.filter((n) => n !== blot)
                  setBlot(pick[Math.floor(Math.random() * pick.length)])
                  play('select')
                }}
                style={{ ...quiet, textDecoration: 'none', color: c.ink }}
              >
                ↻ surprise me
              </button>
            </div>
            <div style={{ marginTop: 12 }}>
              <RisoButton onClick={() => finish(blot)} variant="confirm" style={{ padding: '13px 28px' }}>
                {blot.trim() ? `Hello, ${blot.trim()}! →` : 'Into the studio →'}
              </RisoButton>
            </div>
            <button onClick={() => finish('')} style={quiet}>
              skip — they can stay Blot
            </button>
          </>
        )}
      </Card>
    </div>
  )
}
