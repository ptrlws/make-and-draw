import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { IconButton } from '../components/riso'
import { useGame } from '../game/context'
import { clearDraft, loadDraft, saveDraft } from '../game/draftStore'
import { saveStock } from '../game/stock'
import { INKS, c, fonts, shadows } from '../theme'

const STAMPS = ['Dot', 'Petal', 'Ring', 'Plus'] as const

const chip: CSSProperties = {
  fontFamily: fonts.display,
  fontWeight: 600,
  fontSize: 13,
  color: c.ink,
  background: c.card,
  border: 'none',
  borderRadius: 14,
  padding: '11px 16px',
  minHeight: 44,
  boxShadow: shadows.dropSm,
  cursor: 'pointer',
}

export function PatternLab() {
  const { go, play, startFinish } = useGame()
  const [ink, setInk] = useState(0)
  const [stamp, setStamp] = useState(0)
  const inkRef = useRef(ink)
  inkRef.current = ink
  const stampRef = useRef(stamp)
  stampRef.current = stamp

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const tileRef = useRef<HTMLCanvasElement | null>(null)
  const tileCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const dprRef = useRef(1)
  const TILE = useRef(160)
  /** Every stamp as [dx, dy, kind, ink] in tile coords — replayable, so undo
   * is one pop() and nothing can silently erase the pattern. */
  const opsRef = useRef<[number, number, number, number][]>([])
  const repaintRef = useRef<() => void>(() => {})

  const paper = '#f4f1e7'

  const drawStamp = (dx: number, dy: number, kind: number, inkIdx: number) => {
    const tctx = tileCtxRef.current
    if (!tctx) return
    const T = TILE.current
    const px = ((dx % T) + T) % T
    const py = ((dy % T) + T) % T
    const col = INKS[inkIdx].c
    const s = T * 0.16
    const mirrors: [number, number][] = [
      [px, py],
      [T - px, py],
      [px, T - py],
      [T - px, T - py],
    ]
    tctx.fillStyle = col
    tctx.strokeStyle = col
    for (const [mx, my] of mirrors) {
      for (const ox of [-T, 0, T]) {
        for (const oy of [-T, 0, T]) {
          const x = mx + ox
          const y = my + oy
          tctx.beginPath()
          if (kind === 0) {
            tctx.arc(x, y, s * 0.5, 0, 7)
            tctx.fill()
          } else if (kind === 1) {
            tctx.save()
            tctx.translate(x, y)
            tctx.rotate((mx + my) * 0.02)
            tctx.beginPath()
            tctx.ellipse(0, 0, s * 0.32, s * 0.62, 0, 0, 7)
            tctx.fill()
            tctx.restore()
          } else if (kind === 2) {
            tctx.lineWidth = s * 0.24
            tctx.arc(x, y, s * 0.44, 0, 7)
            tctx.stroke()
          } else {
            const w = s * 0.24
            tctx.fillRect(x - s * 0.5, y - w / 2, s, w)
            tctx.fillRect(x - w / 2, y - s * 0.5, w, s)
          }
        }
      }
    }
  }

  const render = () => {
    const cv = canvasRef.current
    const tile = tileRef.current
    if (!cv || !tile) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    // createPattern SNAPSHOTS the tile (it is not live) — rebuild per frame,
    // otherwise every stamp draws into an off-screen tile that never shows.
    const pat = ctx.createPattern(tile, 'repeat')
    if (!pat) return
    ctx.fillStyle = pat
    ctx.fillRect(0, 0, cv.width, cv.height)
  }

  const clearTile = () => {
    const tctx = tileCtxRef.current
    const tile = tileRef.current
    if (!tctx || !tile) return
    tctx.fillStyle = paper
    tctx.fillRect(0, 0, tile.width, tile.height)
  }

  useEffect(() => {
    const cv = canvasRef.current
    const wrap = wrapRef.current
    if (!cv || !wrap) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    dprRef.current = dpr
    const T = Math.round(150 * dpr)
    TILE.current = T

    const tile = document.createElement('canvas')
    tile.width = T
    tile.height = T
    tileRef.current = tile
    tileCtxRef.current = tile.getContext('2d')
    clearTile()

    const sizeDisplay = () => {
      const r = wrap.getBoundingClientRect()
      cv.width = Math.max(2, Math.round(r.width * dpr))
      cv.height = Math.max(2, Math.round(r.height * dpr))
      render()
    }
    sizeDisplay()

    // restore a draft (work survives reload/back), else seed a starter pattern
    if (opsRef.current.length === 0) {
      const draft = loadDraft<{ T: number; ops: [number, number, number, number][] }>('pattern')
      if (draft?.ops?.length) {
        const k = T / (draft.T || T) // tile size is dpr-dependent — rescale
        opsRef.current = draft.ops.map(([x, y, kk, ci]) => [x * k, y * k, kk, ci] as [number, number, number, number])
      } else {
        opsRef.current = [
          [T * 0.5, T * 0.5, 0, 0],
          [T * 0.22, T * 0.3, 1, 2],
          [T * 0.72, T * 0.24, 2, 1],
          [T * 0.34, T * 0.7, 3, 3],
        ]
      }
    }
    const repaint = () => {
      clearTile()
      for (const [x, y, k, ci] of opsRef.current) drawStamp(x, y, k, ci)
      render()
    }
    repaintRef.current = repaint
    repaint()

    const stamp2 = (dx: number, dy: number) => {
      opsRef.current.push([dx, dy, stampRef.current, inkRef.current])
      drawStamp(dx, dy, stampRef.current, inkRef.current)
      render()
      saveDraft('pattern', { T: TILE.current, ops: opsRef.current })
    }

    const toDev = (e: PointerEvent): [number, number] => {
      const r = cv.getBoundingClientRect()
      return [(e.clientX - r.left) * (cv.width / r.width), (e.clientY - r.top) * (cv.height / r.height)]
    }
    let down = false
    let last: [number, number] = [0, 0]
    const onDown = (e: PointerEvent) => {
      e.preventDefault()
      try {
        cv.setPointerCapture(e.pointerId)
      } catch {
        /* optional */
      }
      down = true
      last = toDev(e)
      stamp2(last[0], last[1])
      play('pop')
    }
    const onMove = (e: PointerEvent) => {
      if (!down) return
      const p = toDev(e)
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) < TILE.current * 0.12) return
      stamp2(p[0], p[1])
      last = p
    }
    const onUp = () => {
      down = false
    }
    cv.addEventListener('pointerdown', onDown)
    cv.addEventListener('pointermove', onMove)
    cv.addEventListener('pointerup', onUp)
    cv.addEventListener('pointercancel', onUp)
    window.addEventListener('resize', sizeDisplay)
    return () => {
      cv.removeEventListener('pointerdown', onDown)
      cv.removeEventListener('pointermove', onMove)
      cv.removeEventListener('pointerup', onUp)
      cv.removeEventListener('pointercancel', onUp)
      window.removeEventListener('resize', sizeDisplay)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const undo = () => {
    opsRef.current.pop()
    repaintRef.current()
    saveDraft('pattern', { T: TILE.current, ops: opsRef.current })
    play('select')
  }
  const clear = () => {
    opsRef.current = []
    clearTile()
    render()
    clearDraft('pattern')
    play('page')
  }
  const keep = () => {
    const cv = canvasRef.current
    if (!cv) return
    const img = cv.toDataURL('image/png')
    saveStock('pattern', img) // kept tiles become sticker-board paper
    clearDraft('pattern') // kept — next visit starts fresh
    startFinish({ type: 'pattern', title: 'Pattern', img, tint: INKS[ink].c })
  }

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px' }}>
        <IconButton onClick={() => go('home')} ariaLabel="back" size={52} style={{ fontFamily: fonts.display, fontSize: 25 }}>
          ‹
        </IconButton>
        <div style={{ fontFamily: fonts.display, fontSize: 25, fontWeight: 600, color: c.ink, flex: 1 }}>Pattern lab</div>
        <button onClick={undo} style={chip}>
          Undo
        </button>
        <button onClick={clear} style={chip}>
          Clear
        </button>
        <button onClick={keep} style={{ ...chip, background: c.ink, color: c.card, boxShadow: shadows.drop }}>
          Keep ✓
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ position: 'relative', background: c.card, border: 'none', borderRadius: 20, boxShadow: shadows.dropLg, padding: 12 }}>
          <div
            ref={wrapRef}
            style={{
              width: 'min(560px, 88vw, 74vh)',
              aspectRatio: '1 / 1',
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: `inset 0 0 0 1px ${c.line}`,
            }}
          >
            <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none', cursor: 'crosshair' }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', padding: '4px 16px 22px' }}>
        <div style={{ fontFamily: fonts.body, fontWeight: 700, fontSize: 13, color: c.hint }}>tap &amp; drag — it mirrors and repeats</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
          {INKS.map((k, i) => (
            <button
              key={i}
              aria-label={`ink ${i + 1}`}
              aria-pressed={ink === i}
              onClick={() => {
                setInk(i)
                play('select')
              }}
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: k.c,
                border: 'none',
                boxShadow:
                  ink === i ? `0 0 0 3px ${c.card}, 0 0 0 5px ${c.inkSoft}, ${shadows.dropSm}` : shadows.dropSm,
                transform: ink === i ? 'scale(1.12)' : undefined,
                transition: 'transform .12s',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: fonts.body, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.1em', fontSize: 11, color: c.faint }}>Stamp</span>
          {STAMPS.map((label, i) => (
            <button
              key={label}
              onClick={() => { setStamp(i); play('select') }}
              aria-pressed={i === stamp}
              style={
                i === stamp
                  ? { ...chip, background: c.ink, color: c.card, boxShadow: shadows.drop }
                  : chip
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
