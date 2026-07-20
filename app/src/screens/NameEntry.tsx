import { useState } from 'react'
import { Card, RisoButton } from '../components/riso'
import { useGame } from '../game/context'
import { c, fonts } from '../theme'

/** First launch only: the one and only place the child types — and even here,
 * typing is optional (skip straight in with no name). */
export function NameEntry() {
  const { confirmName, play, state } = useGame()
  const [value, setValue] = useState(state.name ?? '')
  const [nudge, setNudge] = useState(false)

  const submit = (raw: string) => {
    if (!raw.trim()) {
      // never a silent dead end: shake + hint (or use "skip" to start unnamed)
      setNudge(false)
      requestAnimationFrame(() => setNudge(true))
      play('wrong')
      return
    }
    confirmName(raw)
  }

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Card spot={c.blue} offset={8} radius={10} style={{ width: 'min(440px, 92vw)', padding: '30px 28px 24px', textAlign: 'center', position: 'relative' }}>
        <div style={{ fontFamily: fonts.body, fontWeight: 800, fontSize: 12, letterSpacing: '.22em', textTransform: 'uppercase', color: c.pink }}>
          A print studio of your own
        </div>
        <div style={{ fontFamily: fonts.display, fontSize: 'clamp(38px, 11vw, 56px)', lineHeight: 0.92, textTransform: 'uppercase', margin: '10px 0 6px' }}>
          Make
          <br />&amp; Draw
        </div>
        <div style={{ fontFamily: fonts.body, fontWeight: 700, fontSize: 16, color: nudge ? c.pink : c.hint, margin: '14px 0 14px' }} aria-live="polite">
          {nudge ? 'type a name to start!' : 'Hello! What should we call you?'}
        </div>
        <input
          type="text"
          maxLength={14}
          placeholder="type here"
          autoComplete="off"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit(value)
          }}
          style={{
            width: '100%',
            maxWidth: 300,
            textAlign: 'center',
            fontFamily: fonts.body,
            fontWeight: 800,
            fontSize: 24,
            color: c.ink,
            background: '#fff',
            border: `2.5px solid ${nudge ? c.pink : c.ink}`,
            borderRadius: 6,
            padding: '12px 14px',
            boxShadow: 'inset 0 2px 0 rgba(22,19,15,.06)',
            animation: nudge ? 'shakeX .45s ease' : undefined,
          }}
        />
        <div style={{ marginTop: 18 }}>
          <RisoButton onClick={() => submit(value)} style={{ fontSize: 18, padding: '13px 28px' }}>
            That's me →
          </RisoButton>
        </div>
        <button
          onClick={() => confirmName('')}
          style={{
            fontFamily: fonts.body,
            fontWeight: 700,
            fontSize: 13,
            color: c.hint,
            background: 'none',
            border: 'none',
            textDecoration: 'underline',
            marginTop: 14,
            cursor: 'pointer',
            padding: 6,
          }}
        >
          skip — just start making
        </button>
        <div style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: 12, color: c.faint, marginTop: 8 }}>
          it goes on the cover of your collection · change it any time in settings
        </div>
      </Card>
    </div>
  )
}
