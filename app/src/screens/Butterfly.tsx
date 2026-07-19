import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type Konva from 'konva'
import { Layer, Line, Path, Rect, Stage } from 'react-konva'
import getStroke from 'perfect-freehand'
import { IconButton } from '../components/riso'
import { useGame } from '../game/context'
import { clearDraft, loadDraft, saveDraft } from '../game/draftStore'
import { INKS, c, fonts } from '../theme'

const PAPER = '#f4f1e7'

interface Stroke {
  pts: number[]
  color: string
}

/** The real butterfly-painting ritual: paint blobs on the open sheet, FOLD
 * the paper over, PRESS it down, peel it open — and gasp. The mirror never
 * shows early; the reveal is the whole point. */
type Ritual = 'paint' | 'folding' | 'folded' | 'pressing' | 'reveal'

function outline(points: number[][], size: number): number[] {
  const s = getStroke(points, { size, thinning: 0.6, smoothing: 0.62, streamline: 0.5 })
  const flat: number[] = []
  for (const p of s) flat.push(p[0], p[1])
  return flat
}

/** Mirror a flat [x,y,x,y,…] polygon across the vertical axis at cx. */
function mirrorX(pts: number[], cx: number): number[] {
  const out = new Array(pts.length)
  for (let i = 0; i < pts.length; i += 2) {
    out[i] = 2 * cx - pts[i]
    out[i + 1] = pts[i + 1]
  }
  return out
}
function mirrorY(pts: number[], cy: number): number[] {
  const out = new Array(pts.length)
  for (let i = 0; i < pts.length; i += 2) {
    out[i] = pts[i]
    out[i + 1] = 2 * cy - pts[i + 1]
  }
  return out
}

const chip: CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: 800,
  fontSize: 13,
  textTransform: 'uppercase',
  letterSpacing: '.04em',
  color: c.ink,
  background: '#fff',
  border: `2.5px solid ${c.ink}`,
  borderRadius: 6,
  padding: '11px 13px',
  minHeight: 44,
  boxShadow: '0 3px 0 #16130f',
  cursor: 'pointer',
}

interface BflyDraft {
  committed?: Stroke[]
  fresh?: Stroke[]
  /** legacy shape (pre-ritual drafts) */
  strokes?: Stroke[]
  quad: boolean
  ink: number
}

const PRESS_MS = 750

export function Butterfly() {
  const { go, play, showToast, startFinish } = useGame()
  const [ink, setInk] = useState(0)
  const [quad, setQuad] = useState(false) // 4-fold mandala vs 2-fold butterfly
  /** already pressed — mirrors baked in as real strokes */
  const [committed, setCommitted] = useState<Stroke[]>([])
  /** painted since the last press — shown unmirrored (no spoilers) */
  const [fresh, setFresh] = useState<Stroke[]>([])
  const [wet, setWet] = useState<number[]>([])
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [ritual, setRitual] = useState<Ritual>('paint')

  const wrapRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const guideRef = useRef<Konva.Layer>(null)
  const drawing = useRef<number[][] | null>(null)
  const pressTimer = useRef<number | undefined>(undefined)
  const draftRef = useRef(loadDraft<BflyDraft>('butterfly'))
  const canSave = useRef(draftRef.current == null)

  useEffect(() => {
    const measure = () => {
      const el = wrapRef.current
      if (!el) return
      setSize({ w: el.clientWidth, h: el.clientHeight })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
      clearTimeout(pressTimer.current)
    }
  }, [])

  // restore the draft once the board is measured (work survives reload/back)
  useEffect(() => {
    if (size.w < 2 || !draftRef.current) return
    const d = draftRef.current
    draftRef.current = null
    canSave.current = true
    const scale = (list: Stroke[] | undefined) =>
      (list ?? []).map((s) => ({ color: s.color, pts: s.pts.map((v) => v * size.w) }))
    setQuad(!!d.quad)
    if (d.ink >= 0 && d.ink < INKS.length) setInk(d.ink)
    setCommitted(scale(d.committed))
    // legacy drafts stored everything in `strokes` — treat as unpressed paint
    setFresh(scale(d.fresh ?? d.strokes))
  }, [size])

  // persist on every committed change
  useEffect(() => {
    if (!canSave.current || size.w < 2) return
    const norm = (list: Stroke[]) => list.map((s) => ({ color: s.color, pts: s.pts.map((v) => v / size.w) }))
    saveDraft('butterfly', { committed: norm(committed), fresh: norm(fresh), quad, ink })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committed, fresh, quad])

  const cx = size.w / 2
  const cy = size.h / 2
  const brush = Math.max(9, size.w * 0.03)

  const start = () => {
    if (ritual !== 'paint') return
    const p = stageRef.current?.getPointerPosition()
    if (!p) return
    drawing.current = [[p.x, p.y]]
    setWet(outline(drawing.current, brush))
  }
  const lastSfx = useRef(0)
  const move = () => {
    if (!drawing.current) return
    const p = stageRef.current?.getPointerPosition()
    if (!p) return
    drawing.current.push([p.x, p.y])
    setWet(outline(drawing.current, brush))
    // the brush is never silent — a soft wet drag while painting
    const t = performance.now()
    if (t - lastSfx.current > 95) {
      lastSfx.current = t
      play('swirl', 0.85 + Math.random() * 0.4)
    }
  }
  const end = () => {
    if (!drawing.current) return
    const o = outline(drawing.current, brush)
    drawing.current = null
    setWet([])
    if (o.length >= 6) {
      setFresh((s) => [...s, { pts: o, color: INKS[ink].c }])
      play('pop', 0.9 + Math.random() * 0.25)
    }
  }

  // ---- the fold-and-press ritual ----
  const fold = () => {
    if (fresh.length === 0) {
      play('wrong')
      showToast('paint something first!')
      return
    }
    play('fold')
    setRitual('folding')
    window.setTimeout(() => setRitual('folded'), 700)
  }
  const pressDown = () => {
    if (ritual !== 'folded') return
    setRitual('pressing')
    play('press')
    pressTimer.current = window.setTimeout(() => {
      // commit: bake the mirrors in as real strokes with a soft pressed bleed
      setCommitted((prev) => {
        const out = [...prev]
        for (const s of fresh) {
          out.push(s)
          out.push({ pts: mirrorX(s.pts, cx), color: s.color })
          if (quad) {
            out.push({ pts: mirrorY(s.pts, cy), color: s.color })
            out.push({ pts: mirrorY(mirrorX(s.pts, cx), cy), color: s.color })
          }
        }
        return out
      })
      setFresh([])
      setRitual('reveal')
      play('peel')
      window.setTimeout(() => {
        setRitual('paint')
        play('fw', 1.1)
      }, 650)
    }, PRESS_MS)
  }
  const pressUp = () => {
    if (ritual !== 'pressing') return
    // let go too soon — the paper stays folded, ready for another press
    clearTimeout(pressTimer.current)
    setRitual('folded')
    play('wrong')
  }

  const undo = () => {
    if (ritual !== 'paint') return
    if (fresh.length > 0) {
      setFresh((s) => s.slice(0, -1))
      play('select')
    } else if (committed.length > 0) {
      // undo a whole pressed set is confusing — pop one baked stroke instead
      setCommitted((s) => s.slice(0, -1))
      play('select')
    }
  }
  const clear = () => {
    if (ritual !== 'paint') return
    setCommitted([])
    setFresh([])
    clearDraft('butterfly')
    play('page')
  }
  const keep = () => {
    if (ritual !== 'paint') return
    if (fresh.length > 0) {
      play('wrong')
      showToast('fold & press it first!')
      return
    }
    if (committed.length === 0) {
      play('wrong')
      return
    }
    // hide the guide layer so the saved art is clean paint on paper
    const guides = guideRef.current
    guides?.hide()
    const url = stageRef.current?.toDataURL({ pixelRatio: 2, mimeType: 'image/png' })
    guides?.show()
    clearDraft('butterfly')
    startFinish({ type: 'butterfly', title: quad ? 'Mandala' : 'Butterfly', img: url, tint: INKS[ink].c })
  }

  // faint butterfly guide (two mirrored wings + body), scaled to the stage
  const g = size.w / 118
  const wing = 'M2 0 C 26 -30 58 -24 46 -2 C 58 4 54 22 32 19 C 18 16 8 8 2 0 Z'

  const folded = ritual === 'folded' || ritual === 'pressing'
  const flapAnim =
    ritual === 'folding'
      ? 'foldOver .68s cubic-bezier(.6,.05,.3,1) forwards'
      : ritual === 'reveal'
        ? 'foldBack .6s cubic-bezier(.55,.06,.35,1) forwards'
        : undefined
  const hint =
    ritual === 'paint'
      ? fresh.length > 0
        ? 'now fold & press it!'
        : committed.length > 0
          ? 'add more paint — or keep it'
          : quad
            ? 'paint anywhere — then fold & press'
            : 'paint one wing — then fold & press'
      : ritual === 'folding'
        ? 'folding…'
        : ritual === 'pressing'
          ? 'keep pressing…'
          : ritual === 'folded'
            ? 'now PRESS down — hold it!'
            : 'peel it open…'

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px' }}>
        <IconButton onClick={() => go('home')} ariaLabel="back" size={52} style={{ fontFamily: fonts.display, fontSize: 26 }}>
          ‹
        </IconButton>
        <div style={{ fontFamily: fonts.display, fontSize: 24, textTransform: 'uppercase', flex: 1 }}>{quad ? 'Mandala' : 'Butterfly'}</div>
        <button onClick={undo} style={chip}>
          Undo
        </button>
        <button onClick={clear} style={chip}>
          Clear
        </button>
        <button onClick={keep} style={{ ...chip, background: fresh.length === 0 && committed.length > 0 ? c.teal : c.disabled, color: c.ink }}>
          Keep ✓
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div
          style={{
            position: 'relative',
            background: '#fff',
            border: `3px solid ${c.ink}`,
            borderRadius: 6,
            boxShadow: `6px 6px 0 ${INKS[ink].c}`,
            padding: 10,
            transform: ritual === 'pressing' ? 'scale(.965)' : undefined,
            transition: 'transform .25s ease',
          }}
        >
          <div
            ref={wrapRef}
            style={{ width: 'min(460px, 88vw)', aspectRatio: '1 / 1', borderRadius: 3, overflow: 'hidden', touchAction: 'none', position: 'relative', perspective: 1100 }}
            onPointerDown={pressDown}
            onPointerUp={pressUp}
            onPointerCancel={pressUp}
          >
            {size.w > 0 && (
              <Stage
                ref={stageRef}
                width={size.w}
                height={size.h}
                onMouseDown={start}
                onMouseMove={move}
                onMouseUp={end}
                onMouseLeave={end}
                onTouchStart={start}
                onTouchMove={move}
                onTouchEnd={end}
              >
                <Layer listening={false}>
                  <Rect x={0} y={0} width={size.w} height={size.h} fill={PAPER} />
                </Layer>
                {/* guides live on their own layer so exports can hide them */}
                <Layer ref={guideRef} listening={false}>
                  <Line points={[cx, 8, cx, size.h - 8]} stroke="rgba(22,19,15,.14)" strokeWidth={1.5} dash={[5, 6]} />
                  {quad && <Line points={[8, cy, size.w - 8, cy]} stroke="rgba(22,19,15,.14)" strokeWidth={1.5} dash={[5, 6]} />}
                  {!quad &&
                    [1, -1].map((sx, i) => (
                      <Path key={i} data={wing} x={cx} y={cy} scaleX={sx * g} scaleY={g} stroke="rgba(22,19,15,.16)" strokeWidth={2} />
                    ))}
                </Layer>
                <Layer listening={false}>
                  {/* pressed strokes — mirrors already baked in, soft bleed */}
                  {committed.map((s, i) => (
                    <Line key={`c${i}`} points={s.pts} closed fill={s.color} lineJoin="round" shadowColor={s.color} shadowBlur={4} shadowOpacity={0.35} />
                  ))}
                  {/* fresh paint — one side only; the mirror stays a surprise */}
                  {fresh.map((s, i) => (
                    <Line key={`f${i}`} points={s.pts} closed fill={s.color} lineJoin="round" />
                  ))}
                  {wet.length >= 6 && <Line points={wet} closed fill={INKS[ink].c} opacity={0.9} />}
                </Layer>
              </Stage>
            )}
            {/* the folding flap — the left page swings over onto the right */}
            {ritual !== 'paint' && (
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 0,
                  width: '50%',
                  transformOrigin: 'right center',
                  transformStyle: 'preserve-3d',
                  transform: folded ? 'rotateY(-180deg)' : undefined,
                  animation: flapAnim,
                  background: `linear-gradient(105deg, ${PAPER}, #ebe7d9)`,
                  borderRight: `2px dashed rgba(22,19,15,.25)`,
                  boxShadow: folded ? '-14px 0 22px rgba(22,19,15,.28)' : '2px 0 8px rgba(22,19,15,.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                {folded && (
                  <span
                    style={{
                      fontFamily: fonts.display,
                      fontSize: 22,
                      textTransform: 'uppercase',
                      color: c.ink,
                      opacity: 0.65,
                      transform: 'scaleX(-1)',
                      animation: ritual === 'folded' ? 'ping 1.2s ease-out infinite' : undefined,
                    }}
                  >
                    press!
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', padding: '4px 16px 22px' }}>
        <div style={{ fontFamily: fonts.body, fontWeight: 700, fontSize: 13, color: ritual === 'folded' ? c.pink : c.hint }} aria-live="polite">
          {hint}
        </div>
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
                border: ink === i ? `4px solid ${c.ink}` : '3px solid rgba(22,19,15,.3)',
                boxShadow: `0 4px 0 ${k.d}`,
                transform: ink === i ? 'scale(1.12)' : undefined,
                transition: 'transform .12s',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center' }}>
          <button
            onClick={fold}
            disabled={ritual !== 'paint'}
            style={{
              ...chip,
              fontSize: 15,
              padding: '12px 20px',
              background: fresh.length > 0 ? c.pink : '#fff',
              color: c.ink,
              animation: fresh.length > 0 && ritual === 'paint' ? 'popin .4s ease-out' : undefined,
              opacity: ritual === 'paint' ? 1 : 0.5,
            }}
          >
            ⧉ Fold &amp; press
          </button>
          <button
            onClick={() => {
              if (ritual !== 'paint') return
              setQuad((v) => !v)
              play('select')
            }}
            aria-pressed={quad}
            style={{ ...chip, background: quad ? c.ink : '#fff', color: quad ? c.paper : c.ink }}
          >
            {quad ? '✦ 4-way' : '❋ 2-way'}
          </button>
        </div>
      </div>
    </div>
  )
}
