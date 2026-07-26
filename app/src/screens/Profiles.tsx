import { useEffect, useState } from 'react'
import { IconButton } from '../components/riso'
import { useGame } from '../game/context'
import { c, shadows, text } from '../theme'

/** "Who's making today?" — pick a maker, add one, or (for grown-ups) remove one.
 * Each maker keeps their own name, collection, drafts and settings. */
export function Profiles() {
  const { state, go, play, switchProfile, addProfile, deleteProfile } = useGame()
  const [confirmId, setConfirmId] = useState<string | null>(null)

  useEffect(() => {
    if (!confirmId) return
    const t = window.setTimeout(() => setConfirmId(null), 3000)
    return () => clearTimeout(t)
  }, [confirmId])

  const initial = (name: string | null) => (name && name.trim() ? name.trim()[0].toUpperCase() : '?')

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto' }}>
      <div style={{ maxWidth: 620, margin: '0 auto', minHeight: '100%', padding: '0 18px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0 8px' }}>
          <IconButton onClick={() => go('home')} ariaLabel="back" size={44} style={{ ...text.display }}>
            ‹
          </IconButton>
          <div>
            <div style={{ ...text.eyebrow, color: c.faint }}>
              Make &amp; Draw
            </div>
            <div style={{ ...text.heroFluid, color: c.ink }}>
              Who&rsquo;s making?
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 14, marginTop: 10 }}>
          {state.profiles.map((p) => {
            const active = p.id === state.profileId
            const arming = confirmId === p.id
            return (
              <div key={p.id} style={{ position: 'relative' }}>
                <button
                  onClick={() => {
                    play('select')
                    switchProfile(p.id)
                  }}
                  aria-pressed={active}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: c.card,
                    border: 'none',
                    borderRadius: 16,
                    // the active maker is lifted, not outlined
                    boxShadow: active ? `0 0 0 2px ${p.color}, ${shadows.card}` : shadows.cardSoft,
                    padding: 0,
                    overflow: 'hidden',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ position: 'relative', height: 96, background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ ...text.hero, color: c.paper }}>{initial(p.name)}</span>
                    {active && (
                      <span style={{ ...text.micro, position: 'absolute', top: 7, left: 7, width: 22, height: 22, borderRadius: '50%', background: c.card, border: 'none', boxShadow: shadows.dropSm, textAlign: 'center', color: c.ink }}>✓</span>
                    )}
                  </div>
                  <div style={{ padding: '9px 12px' }}>
                    <div style={{ ...text.title, color: c.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name || 'Tap to name'}
                    </div>
                    <div style={{ ...text.micro, color: c.faint, marginTop: 1 }}>{active ? 'making now' : 'tap to switch'}</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    if (arming) {
                      deleteProfile(p.id)
                    } else {
                      setConfirmId(p.id)
                      play('wrong')
                    }
                  }}
                  aria-label={arming ? `tap again to delete ${p.name || 'this maker'}` : `delete ${p.name || 'this maker'}`}
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    minWidth: 24,
                    height: 24,
                    padding: arming ? '0 8px' : 0,
                    width: arming ? 'auto' : 24,
                    borderRadius: 12,
                    background: arming ? c.pink : c.card,
                    color: arming ? '#FCFBF7' : c.hint,
                    border: 'none',
                    boxShadow: shadows.dropSm,
                    ...text.micro,
                    // the armed label is longer, so it drops a rung to fit
                    fontSize: arming ? 11 : 13,
                    cursor: 'pointer',
                    lineHeight: 1,
                  }}
                >
                  {arming ? 'delete?' : '✕'}
                </button>
              </div>
            )
          })}

          {/* add a new maker */}
          <button
            onClick={() => {
              play('pop')
              addProfile()
            }}
            style={{
              minHeight: 150,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              background: 'transparent',
              border: `2px dashed ${c.lineStrong}`,
              borderRadius: 16,
              cursor: 'pointer',
            }}
          >
            <span style={{ ...text.hero, color: c.hint }}>＋</span>
            <span style={{ ...text.labelSm, color: c.hint }}>New maker</span>
          </button>
        </div>

        <div style={{ ...text.micro, color: c.faint, textAlign: 'center', margin: '20px 0 0' }}>
          Each maker keeps their own collection and works-in-progress, saved on this device.
        </div>
      </div>
    </div>
  )
}
