import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { IconButton, RisoButton } from '../components/riso'
import { useGame } from '../game/context'
import { clearDraft, loadDraft, saveDraft } from '../game/draftStore'
import { loadStock } from '../game/stock'
import { INKS, c, fonts, shadows } from '../theme'

const STAMPS = ['Circle', 'Square', 'Triangle', 'Diamond', 'Bar'] as const
const PAPER = '#f4f1e7'

/** Draw one stamp onto any 2d context (shared by the live plate + the press). */
function drawStampOn(ctx: CanvasRenderingContext2D, W: number, H: number, nx: number, ny: number, k: number, ci: number) {
  const dx = nx * W
  const dy = ny * H
  const S = W * 0.17
  ctx.globalCompositeOperation = 'multiply' // overprint: overlapping inks blend
  ctx.fillStyle = INKS[ci].c
  ctx.beginPath()
  if (k === 0) {
    ctx.arc(dx, dy, S * 0.5, 0, 7)
  } else if (k === 1) {
    ctx.rect(dx - S * 0.45, dy - S * 0.45, S * 0.9, S * 0.9)
  } else if (k === 2) {
    ctx.moveTo(dx, dy - S * 0.55)
    ctx.lineTo(dx + S * 0.52, dy + S * 0.45)
    ctx.lineTo(dx - S * 0.52, dy + S * 0.45)
    ctx.closePath()
  } else if (k === 3) {
    ctx.moveTo(dx, dy - S * 0.58)
    ctx.lineTo(dx + S * 0.5, dy)
    ctx.lineTo(dx, dy + S * 0.58)
    ctx.lineTo(dx - S * 0.5, dy)
    ctx.closePath()
  } else {
    ctx.rect(dx - S * 0.62, dy - S * 0.17, S * 1.24, S * 0.34)
  }
  ctx.fill()
}

/** Tool chip: paper-white, borderless, lifted by a soft contact shadow. */
const chip: CSSProperties = {
  fontFamily: fonts.display,
  fontWeight: 600,
  fontSize: 13,
  letterSpacing: '-.005em',
  color: c.ink,
  background: c.card,
  border: 'none',
  borderRadius: 12,
  padding: '10px 15px',
  boxShadow: shadows.dropSm,
  cursor: 'pointer',
}

/** Header actions run at chip scale rather than full RisoButton size. */
const headerBtn: CSSProperties = { fontSize: 13, padding: '10px 16px', borderRadius: 12 }

export function PrintShop() {
  const { go, play, startFinish } = useGame()
  const [ink, setInk] = useState(0)
  const [stamp, setStamp] = useState(0)
  const inkRef = useRef(ink)
  inkRef.current = ink
  const stampRef = useRef(stamp)
  stampRef.current = stamp

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  /** Every stamp as [nx, ny, kind, ink] in normalized coords — the artwork is
   * replayable, so resizes/rotation never erase it and undo is one pop(). */
  const opsRef = useRef<[number, number, number, number][]>([])
  const repaintRef = useRef<() => void>(() => {})

  // marbled paper from the Marble kit — print onto your own stock
  const paperImg = useRef<HTMLImageElement | null>(null)
  const [hasMarblePaper, setHasMarblePaper] = useState(false)
  const [onMarble, setOnMarble] = useState(false)
  const onMarbleRef = useRef(onMarble)
  onMarbleRef.current = onMarble
  useEffect(() => {
    const url = loadStock('marble')
    if (!url) return
    const im = new Image()
    im.onload = () => {
      paperImg.current = im
      setHasMarblePaper(true)
    }
    im.src = url
  }, [])

  const drawPaper = (ctx: CanvasRenderingContext2D, W: number, H: number) => {
    ctx.globalCompositeOperation = 'source-over'
    if (onMarbleRef.current && paperImg.current) {
      ctx.drawImage(paperImg.current, 0, 0, W, H)
    } else {
      ctx.fillStyle = PAPER
      ctx.fillRect(0, 0, W, H)
    }
  }

  const fillBase = () => {
    const cv = canvasRef.current
    const ctx = ctxRef.current
    if (!cv || !ctx) return
    drawPaper(ctx, cv.width, cv.height)
  }

  useEffect(() => {
    const cv = canvasRef.current
    const wrap = wrapRef.current
    if (!cv || !wrap) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const ctx = cv.getContext('2d')!
    ctxRef.current = ctx

    const repaint = () => {
      fillBase()
      for (const [nx, ny, k, ci] of opsRef.current) drawStampOn(ctx, cv.width, cv.height, nx, ny, k, ci)
    }
    repaintRef.current = repaint

    const stampAt = (nx: number, ny: number) => {
      opsRef.current.push([nx, ny, stampRef.current, inkRef.current])
      drawStampOn(ctx, cv.width, cv.height, nx, ny, stampRef.current, inkRef.current)
      saveDraft('print', { ops: opsRef.current })
    }

    const size = () => {
      const r = wrap.getBoundingClientRect()
      cv.width = Math.max(2, Math.round(r.width * dpr))
      cv.height = Math.max(2, Math.round(r.height * dpr))
      repaint() // a resize re-lays every stamp — it never erases the artwork
    }

    // restore a draft (work survives reload/back), else seed a starter composition
    if (opsRef.current.length === 0) {
      const draft = loadDraft<{ ops: [number, number, number, number][] }>('print')
      opsRef.current = draft?.ops?.length
        ? draft.ops
        : [
            [0.44, 0.42, 0, 0],
            [0.6, 0.44, 0, 1],
            [0.52, 0.6, 3, 2],
            [0.36, 0.58, 2, 1],
            [0.66, 0.64, 1, 0],
            [0.5, 0.5, 4, 3],
          ]
    }
    size()

    const toNorm = (e: PointerEvent): [number, number] => {
      const r = cv.getBoundingClientRect()
      return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]
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
      last = toNorm(e)
      stampAt(last[0], last[1])
      play('pop')
    }
    const onMove = (e: PointerEvent) => {
      if (!down) return
      const p = toNorm(e)
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.06) return
      stampAt(p[0], p[1])
      last = p
    }
    const onUp = () => {
      down = false
    }
    cv.addEventListener('pointerdown', onDown)
    cv.addEventListener('pointermove', onMove)
    cv.addEventListener('pointerup', onUp)
    cv.addEventListener('pointercancel', onUp)
    window.addEventListener('resize', size)
    return () => {
      cv.removeEventListener('pointerdown', onDown)
      cv.removeEventListener('pointermove', onMove)
      cv.removeEventListener('pointerup', onUp)
      cv.removeEventListener('pointercancel', onUp)
      window.removeEventListener('resize', size)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const undo = () => {
    opsRef.current.pop()
    repaintRef.current()
    saveDraft('print', { ops: opsRef.current })
    play('select')
  }

  const clear = () => {
    opsRef.current = []
    fillBase()
    clearDraft('print')
    play('page')
  }

  /** The actual PRESS: each ink plate lands a touch off-register and the
   * paper keeps its grain — the kept print looks printed, not drawn. */
  const pressPlate = (W: number, H: number): string => {
    const off = document.createElement('canvas')
    off.width = W
    off.height = H
    const ctx = off.getContext('2d')!
    drawPaper(ctx, W, H)
    const jitter = INKS.map(() => [(Math.random() * 2 - 1) * 0.008, (Math.random() * 2 - 1) * 0.008] as [number, number])
    for (const [nx, ny, k, ci] of opsRef.current) {
      const [jx, jy] = jitter[ci]
      drawStampOn(ctx, W, H, nx + jx, ny + jy, k, ci)
    }
    // paper grain, multiplied in gently
    const g = document.createElement('canvas')
    g.width = 90
    g.height = 90
    const gc = g.getContext('2d')!
    const id = gc.createImageData(90, 90)
    for (let i = 0; i < id.data.length; i += 4) {
      const v = 232 + Math.random() * 23
      id.data[i] = v
      id.data[i + 1] = v
      id.data[i + 2] = v
      id.data[i + 3] = 255
    }
    gc.putImageData(id, 0, 0)
    ctx.globalCompositeOperation = 'multiply'
    ctx.globalAlpha = 0.45
    ctx.drawImage(g, 0, 0, W, H)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    return off.toDataURL('image/png')
  }

  const [pressing, setPressing] = useState(false)
  const keep = () => {
    const cv = canvasRef.current
    if (!cv || pressing) return
    // crank the press: roller sweep + squash, then the misregistered print
    setPressing(true)
    play('press')
    window.setTimeout(() => {
      const img = pressPlate(cv.width, cv.height)
      setPressing(false)
      clearDraft('print') // kept — next visit starts fresh
      startFinish({ type: 'print', title: 'Print', img, tint: INKS[ink].c })
    }, 780)
  }

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px' }}>
        <IconButton onClick={() => go('home')} ariaLabel="back" size={52} style={{ fontFamily: fonts.display, fontSize: 25 }}>
          ‹
        </IconButton>
        <div style={{ fontFamily: fonts.display, fontSize: 20, fontWeight: 600, letterSpacing: '-.015em', color: c.ink, flex: 1 }}>Print shop</div>
        <RisoButton onClick={undo} variant="plain" style={headerBtn}>
          Undo
        </RisoButton>
        <RisoButton onClick={clear} variant="plain" style={headerBtn}>
          Clear
        </RisoButton>
        <RisoButton onClick={keep} variant="confirm" style={headerBtn}>
          Print it ✓
        </RisoButton>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div
          style={{
            position: 'relative',
            background: c.card,
            border: 'none',
            borderRadius: 20,
            boxShadow: shadows.dropLg,
            padding: 10,
            transform: pressing ? 'scaleY(.98)' : undefined,
            transition: 'transform .2s ease',
          }}
        >
          <div ref={wrapRef} style={{ width: 'min(560px, 88vw, 74vh)', aspectRatio: '1 / 1', borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
            <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none', cursor: 'crosshair' }} />
            {/* hairline seat for the sheet — the only boundary in the chrome */}
            <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 12, boxShadow: `inset 0 0 0 1px ${c.line}`, pointerEvents: 'none' }} />
            {pressing && (
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  left: -6,
                  right: -6,
                  top: 0,
                  height: 44,
                  background: `linear-gradient(180deg, ${c.inkSoft}, ${c.ink})`,
                  borderRadius: 22,
                  boxShadow: shadows.dropLg,
                  animation: 'pressSweep .74s cubic-bezier(.5,.05,.5,1) both',
                }}
              />
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', padding: '4px 16px 22px' }}>
        <div style={{ fontFamily: fonts.body, fontWeight: 500, fontSize: 13, color: c.hint }}>stamp shapes — overlaps overprint into new colours</div>
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
                // the pot itself is pigment; selection is a soft paper-gapped ring
                boxShadow: ink === i ? `0 0 0 3px ${c.paper}, 0 0 0 5px ${c.ink}, ${shadows.dropSm}` : shadows.dropSm,
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
            <button key={label} onClick={() => { setStamp(i); play('select') }} aria-pressed={i === stamp} style={{ ...chip, background: i === stamp ? c.ink : c.card, color: i === stamp ? c.card : c.ink }}>
              {label}
            </button>
          ))}
          {hasMarblePaper && (
            <button
              onClick={() => {
                const nv = !onMarble
                setOnMarble(nv)
                onMarbleRef.current = nv
                repaintRef.current()
                play('page')
              }}
              aria-pressed={onMarble}
              style={{ ...chip, background: onMarble ? c.ink : c.card, color: onMarble ? c.card : c.ink }}
            >
              ❖ marbled paper
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
