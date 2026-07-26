import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type Konva from 'konva'
import { Layer, Line, Path, Rect, Stage } from 'react-konva'
import getStroke from 'perfect-freehand'
import { IconButton } from '../components/riso'
import { useGame } from '../game/context'
import { clearDraft, loadDraft, saveDraft } from '../game/draftStore'
import { INKS, c, fonts, shadows } from '../theme'

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
  fontFamily: fonts.display,
  fontWeight: 600,
  fontSize: 14,
  color: c.ink,
  background: c.card,
  border: 'none',
  borderRadius: 14,
  padding: '11px 16px',
  minHeight: 44,
  boxShadow: shadows.dropSm,
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
  /** snapshot of the painted sheet, shown ON the flap so the paint itself
   * travels over as the paper folds (the fold turns it face-out on top) */
  const [flapImg, setFlapImg] = useState<string | null>(null)

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
    // snapshot the painted sheet (guides hidden) so the paint rides on the
    // flap as it folds over — the child watches their colour travel across
    const guides = guideRef.current
    guides?.hide()
    setFlapImg(stageRef.current?.toDataURL({ pixelRatio: 1.5, mimeType: 'image/png' }) ?? null)
    guides?.show()
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
        <div style={{ fontFamily: fonts.display, fontSize: 24, fontWeight: 600, color: c.ink, flex: 1 }}>{quad ? 'Mandala' : 'Butterfly'}</div>
        <button onClick={undo} style={chip}>
          Undo
        </button>
        <button onClick={clear} style={chip}>
          Clear
        </button>
        <button
          onClick={keep}
          style={
            fresh.length === 0 && committed.length > 0
              ? { ...chip, background: c.ink, color: c.card, boxShadow: shadows.drop }
              : { ...chip, color: c.faint }
          }
        >
          Keep ✓
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div
          style={{
            position: 'relative',
            background: c.card,
            border: 'none',
            borderRadius: 20,
            boxShadow: shadows.dropLg,
            padding: 12,
            transform: ritual === 'pressing' ? 'scale(.965)' : undefined,
            transition: 'transform .25s ease',
          }}
        >
          <div
            ref={wrapRef}
            style={{
              width: 'min(560px, 88vw, 74vh)',
              aspectRatio: '1 / 1',
              borderRadius: 12,
              overflow: 'hidden',
              touchAction: 'none',
              position: 'relative',
              perspective: 1100,
              boxShadow: `inset 0 0 0 1px ${c.line}`,
            }}
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
                  <Line points={[cx, 8, cx, size.h - 8]} stroke="rgba(64,56,47,.16)" strokeWidth={1.5} dash={[5, 6]} />
                  {quad && <Line points={[8, cy, size.w - 8, cy]} stroke="rgba(64,56,47,.16)" strokeWidth={1.5} dash={[5, 6]} />}
                  {!quad &&
                    [1, -1].map((sx, i) => (
                      <Path key={i} data={wing} x={cx} y={cy} scaleX={sx * g} scaleY={g} stroke="rgba(64,56,47,.18)" strokeWidth={2} />
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
                  // the paint rides on the flap; CSS mirrors it as it turns over
                  backgroundColor: PAPER,
                  backgroundImage: flapImg ? `url(${flapImg})` : `linear-gradient(105deg, ${PAPER}, #ebe7d9)`,
                  backgroundSize: flapImg ? '200% 100%' : undefined,
                  backgroundPosition: 'left center',
                  backgroundRepeat: 'no-repeat',
                  borderRight: `2px dashed rgba(64,56,47,.25)`,
                  boxShadow: folded ? '-14px 0 22px rgba(64,56,47,.28)' : '2px 0 8px rgba(64,56,47,.12)',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  paddingBottom: 14,
                  boxSizing: 'border-box',
                  pointerEvents: 'none',
                }}
              >
                {folded && (
                  <span
                    style={{
                      fontFamily: fonts.display,
                      fontSize: 16,
                      fontWeight: 600,
                      color: c.ink,
                      opacity: 0.55,
                      transform: 'scaleX(-1)',
                      textShadow: '0 1px 4px rgba(244,241,231,.95), 0 0 3px rgba(244,241,231,.9)',
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
        <div style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: 13, color: ritual === 'folded' ? c.ink : c.hint }} aria-live="polite">
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
                border: 'none',
                boxShadow:
                  ink === i
                    ? `0 0 0 3px ${c.card}, 0 0 0 5px ${c.ink}, ${shadows.drop}`
                    : `inset 0 0 0 1px rgba(64,56,47,.12), ${shadows.dropSm}`,
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
              padding: '12px 22px',
              borderRadius: 16,
              background: fresh.length > 0 ? c.ink : c.card,
              color: fresh.length > 0 ? c.card : c.ink,
              boxShadow: fresh.length > 0 ? shadows.drop : shadows.dropSm,
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
            style={{ ...chip, background: quad ? c.ink : c.card, color: quad ? c.card : c.ink, boxShadow: quad ? shadows.drop : shadows.dropSm }}
          >
            {quad ? '✦ 4-way' : '❋ 2-way'}
          </button>
        </div>
      </div>
    </div>
  )
}
