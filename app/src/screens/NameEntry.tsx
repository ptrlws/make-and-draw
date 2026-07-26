import { useState } from 'react'
import { Blot } from '../components/Blot'
import { Card, RisoButton } from '../components/riso'
import { useGame } from '../game/context'
import { c, shadows, text } from '../theme'

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
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <Blot size={64} />
        </div>
        <div style={{ ...text.eyebrow, color: c.faint }}>A print studio of your own</div>
        <div style={{ ...text.hero, margin: '10px 0 0', color: c.ink }}>Make &amp; Draw</div>
        <div style={{ ...text.lede, color: nudge ? c.pink : c.hint, margin: '10px 0 16px' }} aria-live="polite">
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
        <div style={{ marginTop: 18 }}>
          <RisoButton onClick={() => submit(value)} style={{ padding: '13px 28px' }}>
            That's me →
          </RisoButton>
        </div>
        <button
          onClick={() => confirmName('')}
          style={{
            ...text.meta,
            color: c.hint,
            background: 'none',
            border: 'none',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
            marginTop: 14,
            cursor: 'pointer',
            padding: 6,
          }}
        >
          skip — just start making
        </button>
        <div style={{ ...text.meta, color: c.faint, marginTop: 6 }}>
          it goes on the cover of your collection · change it any time in settings
        </div>
      </Card>
    </div>
  )
}
