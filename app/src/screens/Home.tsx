import { useState } from 'react'
import { Blot } from '../components/Blot'
import { IconButton } from '../components/riso'
import { KitSurface } from '../components/KitSurface'
import { KITS } from '../data/kits'
import { useGame } from '../game/context'
import { loadDraft } from '../game/draftStore'
import { c, shadows, text } from '../theme'
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
  const scr = loadDraft<{ strokes?: unknown[] }>('scratch')
  if (scr?.strokes?.length) out.push('scratch')
  return out
}

export function Home() {
  const { state, openKit, openBook, openSettings, toggleMute, go, reducedMotion } = useGame()
  const name = state.name
  const [resume] = useState(resumableKits)

  /** the child's most recent piece from each kit — the tile IS their work */
  const latest = new Map<string, string>()
  for (const g of state.gallery) if (g.img && !latest.has(g.type)) latest.set(g.type, g.img)

  const maker = state.profiles.find((p) => p.id === state.profileId)

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', minHeight: '100%' }}>
        {/* header — quiet, lowercase, nothing shouting */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 6,
            background: c.headerWash,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            padding: '20px 20px 14px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
              {/* Blot wears the colour of the last thing made here */}
              <Blot size={44} color={state.gallery[0]?.tint} still={reducedMotion || state.calm} name={state.blotName} />
              <div style={{ minWidth: 0 }}>
                {/* Blot is the hero here, so the greeting sits a rung below it */}
                <div style={{ ...text.titleFluid, color: c.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {name ? `hello, ${name}` : 'hello'}
                </div>
                <div style={{ ...text.meta, color: c.hint, marginTop: 2 }}>
                  what shall we make?
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
              <button
                onClick={() => go('profiles')}
                aria-label="switch maker"
                style={{
                  ...text.title,
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: maker?.color ?? c.pink,
                  border: 'none',
                  color: '#fff',
                  boxShadow: shadows.dropSm,
                  cursor: 'pointer',
                }}
              >
                {(name && name.trim()[0]?.toUpperCase()) || '?'}
              </button>
              <IconButton
                onClick={toggleMute}
                ariaLabel={state.muted ? 'unmute sound' : 'mute sound'}
                size={40}
                style={{ position: 'relative', background: c.card, border: 'none', boxShadow: shadows.dropSm }}
              >
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ width: 5, height: 8, background: c.ink }} />
                  <span style={{ width: 0, height: 0, borderTop: '7px solid transparent', borderBottom: '7px solid transparent', borderLeft: `9px solid ${c.ink}`, marginLeft: -1 }} />
                </span>
                {state.muted && <span style={{ position: 'absolute', width: 26, height: 2.5, background: c.pink, transform: 'rotate(-32deg)', borderRadius: 2 }} />}
              </IconButton>
              <IconButton
                onClick={openSettings}
                ariaLabel="settings"
                size={40}
                style={{ gap: 3.5, background: c.card, border: 'none', boxShadow: shadows.dropSm }}
              >
                {[0, 1, 2].map((i) => (
                  <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: c.ink }} />
                ))}
              </IconButton>
            </div>
          </div>
        </div>

        {/* still on the bench — half-finished work */}
        {resume.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', padding: '4px 20px 0' }}>
            <span style={{ ...text.eyebrow, color: c.faint }}>
              still out
            </span>
            {resume.map((k) => {
              const kit = KITS.find((x) => x.id === k)
              if (!kit) return null
              return (
                <button
                  key={k}
                  onClick={() => openKit(k)}
                  style={{
                    ...text.meta,
                    color: c.ink,
                    background: c.card,
                    border: 'none',
                    borderRadius: 999,
                    padding: '6px 13px',
                    boxShadow: shadows.dropSm,
                    cursor: 'pointer',
                  }}
                >
                  {kit.label}
                </button>
              )
            })}
          </div>
        )}

        {/* the shelf — every tile is a real surface, not a swatch */}
        <div style={{ padding: '16px 16px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {KITS.map((kit, i) => {
            const mine = latest.get(kit.id)
            return (
              <button
                key={kit.id}
                onClick={() => openKit(kit.id)}
                style={{
                  position: 'relative',
                  textAlign: 'left',
                  background: c.card,
                  border: 'none',
                  borderRadius: 18,
                  boxShadow: shadows.card,
                  padding: 7,
                  cursor: 'pointer',
                  animation: 'popin .42s cubic-bezier(.3,1.2,.5,1) both',
                  animationDelay: `${i * 40}ms`,
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    aspectRatio: '1 / 1',
                    borderRadius: 12,
                    overflow: 'hidden',
                    background: c.paperBody,
                    boxShadow: 'inset 0 0 0 1px rgba(64,56,47,.06)',
                  }}
                >
                  {mine ? (
                    <img
                      src={mine}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <KitSurface id={kit.id} />
                  )}
                </div>
                <div style={{ padding: '9px 5px 4px' }}>
                  <div style={{ ...text.label, color: c.ink }}>
                    {kit.label}
                  </div>
                  <div style={{ ...text.micro, color: c.faint, marginTop: 1 }}>
                    {mine ? 'your latest' : kit.blurb}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* the collection */}
        <div style={{ padding: '8px 16px 8px' }}>
          <button
            onClick={openBook}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              textAlign: 'left',
              background: c.card,
              border: 'none',
              borderRadius: 18,
              boxShadow: shadows.cardSoft,
              padding: 13,
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 54,
                height: 66,
                flex: 'none',
                borderRadius: '3px 8px 8px 3px',
                position: 'relative',
                overflow: 'hidden',
                background: c.paperBody,
                boxShadow: 'inset 0 0 0 1px rgba(64,56,47,.08)',
              }}
            >
              {state.gallery[0]?.img ? (
                <img src={state.gallery[0].img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : null}
              <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 7, background: 'rgba(64,56,47,.10)' }} />
            </div>
            <div>
              <div style={{ ...text.title, color: c.ink }}>
                {poss(name)} collection
              </div>
              <div style={{ ...text.meta, color: c.hint, marginTop: 2 }}>
                {state.gallery.length ? `${plural(state.gallery.length, 'piece')} kept` : 'nothing kept yet'}
              </div>
            </div>
          </button>
        </div>

        {/* a quiet doorway for parents */}
        <div style={{ padding: '4px 16px 30px', textAlign: 'center' }}>
          <button
            onClick={() => go('grownups')}
            style={{
              ...text.micro,
              color: c.hint,
              background: 'none',
              border: 'none',
              borderRadius: 999,
              padding: '9px 14px',
              cursor: 'pointer',
              textDecoration: 'underline',
              textUnderlineOffset: 3,
              textDecorationColor: c.line,
            }}
          >
            for grown-ups
          </button>
          <div style={{ ...text.micro, color: c.faint, marginTop: 8 }}>
            an idea by Esther
          </div>
        </div>
      </div>
    </div>
  )
}
