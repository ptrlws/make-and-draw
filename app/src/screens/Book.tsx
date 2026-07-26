import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Motif } from '../components/Motif'
import { IconButton, RisoButton } from '../components/riso'
import { Blot } from '../components/Blot'
import { useGame } from '../game/context'
import { sharePiece } from '../game/exporter'
import { useLandscape } from '../hooks/useLandscape'
import { c, shadows, text } from '../theme'
import type { GalleryItem, GalleryType, KitId } from '../types'
import { plural, poss } from '../utils'

const KICKER: Record<GalleryType, string> = {
  marble: 'you marbled',
  cbn: 'you coloured',
  pattern: 'you patterned',
  print: 'you printed',
  dot: 'you joined',
  jigsaw: 'you solved',
  sticker: 'you made',
  butterfly: 'you mirrored',
  scratch: 'you scratched',
}
const NOTE: Record<GalleryType, string> = {
  marble: 'dipped, one of a kind',
  cbn: 'every number in its place',
  pattern: 'tiled & mirrored',
  print: 'overprinted by hand',
  dot: 'every dot in order',
  jigsaw: 'from your own drawing',
  sticker: 'every sticker found its home',
  butterfly: 'painted in perfect mirror',
  scratch: 'scratched to reveal the rainbow',
}

/** A finished piece links back to the kit that made it. */
const TYPE_TO_KIT: Partial<Record<GalleryType, KitId>> = {
  marble: 'marble',
  cbn: 'cbn',
  pattern: 'pattern',
  print: 'print',
  dot: 'dot',
  sticker: 'sticker',
  butterfly: 'butterfly',
  scratch: 'scratch',
}

export function Book() {
  const { state, go, play, showToast, removeCreation, restoreCreation, openKit, reducedMotion } = useGame()
  const landscape = useLandscape()
  const pages = state.gallery
  // Arriving straight from the finishing ritual: skip the cover and land on
  // the brand-new piece (index 0) so the child witnesses the payoff.
  const [opened, setOpened] = useState(() => state.justAdded)
  const [idx, setIdx] = useState(0)
  const [confirmDel, setConfirmDel] = useState(false)
  // soft delete: the removed piece waits here for a few seconds so one more
  // tap brings it straight back — no removal is ever instantly final
  const [trash, setTrash] = useState<{ item: GalleryItem; index: number } | null>(null)
  const trashTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => clearTimeout(trashTimer.current), [])
  const justMade = state.justAdded
  const clamped = Math.max(0, Math.min(idx, pages.length - 1))
  const cur = pages[clamped] ?? { type: 'marble' as GalleryType, title: '—', tint: '#ccc', id: '_' }
  // marbled PAPER is a kept tray painting, not a dipped object — say so
  const note = cur.type === 'marble' && cur.title === 'Marbled paper' ? 'swirled ink, one of a kind' : NOTE[cur.type]

  const turn = (d: -1 | 1) => {
    const next = clamped + d
    if (next < 0 || next >= pages.length) return
    play('page')
    setIdx(next)
  }

  const root: CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: c.paperBook,
    backgroundImage: 'radial-gradient(rgba(64,56,47,.035) 0.5px, transparent 0.6px)',
    backgroundSize: '3px 3px',
  }
  const pane: CSSProperties = {
    flex: 1,
    background: c.card,
    border: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '22px 18px',
    position: 'relative',
    backfaceVisibility: 'hidden',
  }

  return (
    <div style={root}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px' }}>
        <IconButton onClick={() => go('home')} ariaLabel="back" style={{ ...text.display }}>
          ‹
        </IconButton>
        <div style={{ ...text.display, color: c.ink, flex: 1 }}>{poss(state.name)} collection</div>
        <IconButton
          onClick={() => {
            // real sharing: OS share sheet where available, PNG download otherwise
            if (!opened || pages.length === 0 || !cur.img) {
              showToast(pages.length === 0 ? 'make something first!' : 'open a piece to share it')
              return
            }
            play('select')
            void sharePiece(cur.title, cur.img).then((how) => {
              if (how === 'saved') showToast('picture saved!')
              else if (how === 'failed') showToast("couldn't export that one")
            })
          }}
          ariaLabel="share or save this piece"
        >
          <span style={{ width: 13, height: 13, border: `2px solid ${c.ink}`, borderBottom: 'none', borderRadius: '4px 4px 0 0', position: 'relative' }}>
            <span style={{ position: 'absolute', left: '50%', top: -7, transform: 'translateX(-50%)', width: 2, height: 9, borderRadius: 1, background: c.ink }} />
          </span>
        </IconButton>
      </div>

      {pages.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 28, textAlign: 'center' }}>
          {/* nobody likes an empty room — Blot waits here, dozing */}
          <Blot size={72} mood="sleepy" still={reducedMotion || state.calm} name={state.blotName} />
          <div style={{ ...text.hero, color: c.ink }}>Nothing here yet</div>
          <div style={{ ...text.meta, color: c.hint, maxWidth: 300 }}>
            {state.blotName || 'Blot'} is dozing until there's something to look at — go dip a marble or
            colour a print.
          </div>
          {trash && (
            <button
              onClick={() => {
                clearTimeout(trashTimer.current)
                restoreCreation(trash.item, 0)
                setIdx(0)
                setTrash(null)
                play('pop')
                showToast('back in the book!')
              }}
              style={{ ...text.labelSm, color: c.ink, background: c.card, border: 'none', borderRadius: 14, padding: '11px 18px', boxShadow: shadows.dropSm, cursor: 'pointer' }}
            >
              ↶ undo remove
            </button>
          )}
          <RisoButton onClick={() => go('home')}>← make something</RisoButton>
        </div>
      ) : !opened ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <button
            onClick={() => {
              play('page')
              setOpened(true)
            }}
            style={{
              position: 'relative',
              width: 'min(340px, 82vw)',
              aspectRatio: '3 / 3.7',
              background: c.card,
              border: 'none',
              borderRadius: '6px 18px 18px 6px',
              boxShadow: shadows.dropLg,
              overflow: 'hidden',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              color: c.ink,
            }}
          >
            <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 20, background: c.paperBody, boxShadow: `inset -1px 0 0 ${c.line}` }} />
            {/* the newest piece is mounted on the cover — the book is only ever
             * as colourful as the work inside it */}
            {pages[0]?.img && (
              <div
                style={{
                  width: '54%',
                  aspectRatio: '1 / 1',
                  borderRadius: 10,
                  overflow: 'hidden',
                  background: c.paperBody,
                  boxShadow: `0 0 0 1px ${c.line}, ${shadows.cardSoft}`,
                  marginBottom: 4,
                }}
              >
                <img src={pages[0].img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
            )}
            <div style={{ ...text.eyebrow, color: c.faint }}>{poss(state.name)}</div>
            <div style={{ ...text.heroFluid, textAlign: 'center' }}>
              Collection
            </div>
            <div style={{ ...text.meta, color: c.hint, marginTop: 6 }}>{plural(pages.length, 'piece')} · tap to open</div>
            {/* milestone ink stamps collect on the cover as the book fills */}
            {pages.length >= 1 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {[1, 3, 5, 10, 20, 50]
                  .filter((m) => m <= pages.length)
                  .map((m, i) => (
                    <span
                      key={m}
                      title={`${m} made`}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: '50%',
                        border: `1.5px dashed ${c.lineStrong}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        ...text.micro,
                        color: c.hint,
                        opacity: 0.9,
                        transform: `rotate(${(i % 2 ? -1 : 1) * (8 + i * 3)}deg)`,
                      }}
                    >
                      {m}
                    </span>
                  ))}
              </div>
            )}
          </button>
        </div>
      ) : (
        <>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 10px 14px', perspective: '1600px' }}>
            <div
              style={{
                display: 'flex',
                borderRadius: 16,
                boxShadow: shadows.dropLg,
                width: landscape ? 'min(720px, 94vw)' : 'min(96vw, 520px)',
                height: landscape ? 'min(76vh, 520px)' : 'min(64vh, 440px)',
              }}
            >
              {/* left caption page */}
              <div style={{ ...pane, borderRadius: '16px 0 0 16px', gap: 12, boxShadow: 'inset -12px 0 22px -18px rgba(64,56,47,.30)' }}>
                <div style={{ ...text.eyebrow, color: c.faint }}>{KICKER[cur.type]}</div>
                <div style={{ ...text.heroFluid, textAlign: 'center', color: c.ink }}>{cur.title}</div>
                <div style={{ ...text.meta, color: c.hint }}>{note}</div>
              </div>
              {/* right art page — flips in on each turn */}
              <div
                key={clamped}
                style={{ ...pane, borderRadius: '0 16px 16px 0', transformOrigin: 'left center', animation: 'pageturn .55s cubic-bezier(.3,.1,.2,1)', boxShadow: 'inset 12px 0 22px -18px rgba(64,56,47,.30)' }}
              >
                <div style={{ width: 'min(100%, 78%)', aspectRatio: '1 / 1', border: 'none', borderRadius: 12, overflow: 'hidden', background: c.paper, boxShadow: `0 0 0 1px ${c.line}, ${shadows.cardSoft}` }}>
                  <Motif item={cur} />
                </div>
                {justMade && clamped === 0 && (
                  <div
                    style={{
                      ...text.micro,
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      color: c.card,
                      background: c.ink,
                      border: 'none',
                      borderRadius: 999,
                      padding: '5px 11px',
                      transform: 'rotate(6deg)',
                      boxShadow: shadows.dropSm,
                    }}
                  >
                    just made ✓
                  </div>
                )}
                <div style={{ ...text.micro, position: 'absolute', bottom: 8, right: 12, color: c.faint }}>no. {clamped + 1}</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, paddingBottom: 18 }}>
            <IconButton onClick={() => turn(-1)} ariaLabel="previous" size={54} style={{ ...text.display }}>
              ‹
            </IconButton>
            <div style={{ ...text.meta, color: c.hint, minWidth: 90, textAlign: 'center' }}>
              {clamped + 1} of {pages.length}
            </div>
            <IconButton onClick={() => turn(1)} ariaLabel="next" size={54} style={{ ...text.display }}>
              ›
            </IconButton>
          </div>
          {confirmDel ? (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', paddingBottom: 18, flexWrap: 'wrap' }}>
              <span style={{ ...text.labelSm, color: c.ink }}>Remove this piece?</span>
              <button
                onClick={() => setConfirmDel(false)}
                style={{ ...text.labelSm, color: c.ink, background: c.card, border: 'none', borderRadius: 13, padding: '9px 16px', minHeight: 40, boxShadow: shadows.dropSm, cursor: 'pointer' }}
              >
                Keep it
              </button>
              <button
                onClick={() => {
                  // soft delete — keep the piece in hand for a 6s undo window
                  setTrash({ item: cur, index: clamped })
                  clearTimeout(trashTimer.current)
                  trashTimer.current = window.setTimeout(() => setTrash(null), 6000)
                  removeCreation(cur.id)
                  play('page')
                  setConfirmDel(false)
                  if (clamped >= pages.length - 1) setIdx(Math.max(0, clamped - 1))
                }}
                style={{ ...text.labelSm, color: c.card, background: c.ink, border: 'none', borderRadius: 13, padding: '9px 16px', minHeight: 40, boxShadow: shadows.drop, cursor: 'pointer' }}
              >
                Remove
              </button>
            </div>
          ) : trash ? (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', paddingBottom: 18, flexWrap: 'wrap' }}>
              <span style={{ ...text.meta, color: c.hint }}>removed “{trash.item.title}”</span>
              <button
                onClick={() => {
                  clearTimeout(trashTimer.current)
                  restoreCreation(trash.item, trash.index)
                  setIdx(trash.index)
                  setTrash(null)
                  play('pop')
                  showToast('back in the book!')
                }}
                style={{ ...text.labelSm, color: c.ink, background: c.card, border: 'none', borderRadius: 13, padding: '9px 16px', minHeight: 40, boxShadow: shadows.dropSm, cursor: 'pointer' }}
              >
                ↶ undo
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', paddingBottom: 18 }}>
              <RisoButton
                onClick={() => {
                  // straight back into the kit that made this piece
                  const kit = TYPE_TO_KIT[cur.type]
                  if (kit) openKit(kit)
                  else go('home')
                }}
                variant="confirm"
                style={{ ...text.meta }}
              >
                ← make another
              </RisoButton>
              <button
                onClick={() => {
                  if (!cur.img) {
                    showToast("this one can't be exported")
                    return
                  }
                  play('select')
                  void sharePiece(cur.title, cur.img).then((how) => {
                    if (how === 'saved') showToast('picture saved!')
                    else if (how === 'failed') showToast("couldn't export that one")
                  })
                }}
                aria-label="share or save this piece"
                style={{ ...text.labelSm, color: c.ink, background: 'transparent', border: 'none', padding: '9px 10px', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
              >
                share ↗
              </button>
              <button
                onClick={() => setConfirmDel(true)}
                aria-label="remove this piece"
                style={{ ...text.labelSm, color: c.hint, background: 'transparent', border: 'none', padding: '9px 10px', cursor: 'pointer' }}
              >
                remove
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
