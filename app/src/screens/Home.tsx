import { useState } from 'react'
import { Halftone, IconButton } from '../components/riso'
import { KitEmblem } from '../components/KitEmblem'
import { KITS } from '../data/kits'
import { useGame } from '../game/context'
import { loadDraft } from '../game/draftStore'
import { SPOT, c, fonts } from '../theme'
import type { KitId } from '../types'
import { plural, poss } from '../utils'

/** Which kits hold real half-finished work (drafts with content). */
function resumableKits(): KitId[] {
  const out: KitId[] = []
  const gs = loadDraft<{ gs?: unknown[] }>('marble')
  if (gs?.gs?.length) out.push('marble')
  const cbn = loadDraft<{ fills?: unknown[]; strokes?: unknown[] }>('cbn')
  if ((cbn?.fills?.length ?? 0) + (cbn?.strokes?.length ?? 0) > 0) out.push('cbn')
  const pat = loadDraft<{ ops?: unknown[] }>('pattern')
  if (pat?.ops?.length) out.push('pattern')
  const prt = loadDraft<{ ops?: unknown[] }>('print')
  if (prt?.ops?.length) out.push('print')
  const dot = loadDraft<{ n?: number }>('dot')
  if ((dot?.n ?? 0) > 0) out.push('dot')
  const bf = loadDraft<{ committed?: unknown[]; fresh?: unknown[]; strokes?: unknown[] }>('butterfly')
  if ((bf?.committed?.length ?? 0) + (bf?.fresh?.length ?? 0) + (bf?.strokes?.length ?? 0) > 0) out.push('butterfly')
  const st = loadDraft<{ stickers?: unknown[] }>('sticker')
  if (st?.stickers?.length) out.push('sticker')
  const scr = loadDraft<{ strokes?: unknown[]; done?: boolean }>('scratch')
  if (scr?.strokes?.length || scr?.done) out.push('scratch')
  return out
}

export function Home() {
  const { state, openKit, openBook, openSettings, toggleMute, go } = useGame()
  const name = state.name
  const [resume] = useState(resumableKits)

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', minHeight: '100%' }}>
        {/* header */}
        <div style={{ position: 'sticky', top: 0, zIndex: 6, background: c.headerWash, backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', padding: '18px 18px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontFamily: fonts.body, fontWeight: 800, fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: c.pink }}>
                {poss(name)} print studio
              </div>
              <div style={{ fontFamily: fonts.display, fontSize: 'clamp(30px, 8vw, 42px)', lineHeight: 0.92, textTransform: 'uppercase', marginTop: 2 }}>
                Make &amp; Draw
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <IconButton onClick={toggleMute} ariaLabel={state.muted ? 'unmute sound' : 'mute sound'} style={{ position: 'relative' }}>
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ width: 6, height: 9, background: c.ink }} />
                  <span style={{ width: 0, height: 0, borderTop: '8px solid transparent', borderBottom: '8px solid transparent', borderLeft: `10px solid ${c.ink}`, marginLeft: -1 }} />
                </span>
                {state.muted && <span style={{ position: 'absolute', width: 32, height: 3, background: c.pink, transform: 'rotate(-32deg)', borderRadius: 2 }} />}
              </IconButton>
              <IconButton onClick={openSettings} ariaLabel="settings" style={{ gap: 4 }}>
                {[0, 1, 2].map((i) => (
                  <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: c.ink }} />
                ))}
              </IconButton>
            </div>
          </div>
          <div style={{ fontFamily: fonts.body, fontWeight: 700, fontSize: 15, color: c.hint, marginTop: 8 }}>
            {name ? `Hi ${name} — what are we making?` : 'What are we making today?'}
          </div>
        </div>

        {/* jump back in — kits holding half-finished work */}
        {resume.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 18px 0' }}>
            <span style={{ fontFamily: fonts.body, fontWeight: 800, fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: c.pink }}>
              Jump back in
            </span>
            {resume.map((k) => {
              const kit = KITS.find((x) => x.id === k)
              if (!kit) return null
              return (
                <button
                  key={k}
                  onClick={() => openKit(k)}
                  style={{
                    fontFamily: fonts.body,
                    fontWeight: 800,
                    fontSize: 12,
                    textTransform: 'uppercase',
                    letterSpacing: '.03em',
                    color: c.ink,
                    background: c.yellow,
                    border: `2px solid ${c.ink}`,
                    borderRadius: 999,
                    padding: '6px 12px',
                    boxShadow: '0 2px 0 #16130f',
                    cursor: 'pointer',
                  }}
                >
                  {kit.label} →
                </button>
              )
            })}
          </div>
        )}

        {/* the shelf — every tile is playable */}
        <div style={{ padding: '10px 15px 6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {KITS.map((kit, i) => {
            const spot = SPOT[i % SPOT.length]
            const spot2 = SPOT[(i + 2) % SPOT.length]
            return (
              <button
                key={kit.id}
                onClick={() => openKit(kit.id)}
                style={{
                  position: 'relative',
                  textAlign: 'left',
                  background: c.card,
                  border: `3px solid ${c.ink}`,
                  borderRadius: 8,
                  boxShadow: `5px 5px 0 ${spot}`,
                  padding: 10,
                  cursor: 'pointer',
                  animation: 'popin .4s cubic-bezier(.3,1.3,.5,1) both',
                  animationDelay: `${i * 45}ms`,
                }}
              >
                <div style={{ position: 'relative', height: 96, borderRadius: 4, background: spot, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span aria-hidden style={{ position: 'absolute', width: 130, height: 130, borderRadius: '50%', background: spot2, mixBlendMode: 'multiply', top: -34, right: -30 }} />
                  <Halftone opacity={0.16} />
                  <div style={{ position: 'relative', width: '78%', height: '74%' }}>
                    <KitEmblem id={kit.id} ink={c.paper} accent={c.ink} />
                  </div>
                </div>
                <div style={{ fontFamily: fonts.display, fontSize: 18, textTransform: 'uppercase', marginTop: 8, color: c.ink }}>{kit.label}</div>
                <div style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: 11.5, color: c.sub, marginTop: 1 }}>{kit.blurb}</div>
              </button>
            )
          })}
        </div>

        {/* collection card */}
        <div style={{ padding: '4px 15px 26px' }}>
          <button
            onClick={openBook}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              textAlign: 'left',
              background: c.card,
              border: `3px solid ${c.ink}`,
              borderRadius: 8,
              boxShadow: `5px 5px 0 ${c.yellow}`,
              padding: 14,
              cursor: 'pointer',
            }}
          >
            <div style={{ width: 66, height: 80, flex: 'none', background: c.pink, border: `2.5px solid ${c.ink}`, borderRadius: '3px 7px 7px 3px', position: 'relative', overflow: 'hidden' }}>
              <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 11, background: 'rgba(22,19,15,.28)' }} />
              <Halftone opacity={0.2} />
            </div>
            <div>
              <div style={{ fontFamily: fonts.display, fontSize: 24, textTransform: 'uppercase', lineHeight: 1 }}>{poss(name)} collection</div>
              <div style={{ fontFamily: fonts.body, fontWeight: 700, fontSize: 13, color: c.sub, marginTop: 4 }}>{plural(state.gallery.length, 'thing')} you've made →</div>
            </div>
          </button>
        </div>

        {/* a quiet doorway for parents — no ads, no tracking, nothing to buy */}
        <div style={{ padding: '0 15px 30px', textAlign: 'center' }}>
          <button
            onClick={() => go('grownups')}
            style={{
              fontFamily: fonts.body,
              fontWeight: 800,
              fontSize: 12,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              color: c.hint,
              background: 'none',
              border: '2px solid rgba(22,19,15,.18)',
              borderRadius: 999,
              padding: '9px 18px',
              cursor: 'pointer',
            }}
          >
            For grown-ups →
          </button>
          <div style={{ fontFamily: fonts.body, fontWeight: 700, fontSize: 11, letterSpacing: '.04em', color: c.faint, marginTop: 12 }}>
            An idea by Esther 💡
          </div>
        </div>
      </div>
    </div>
  )
}

