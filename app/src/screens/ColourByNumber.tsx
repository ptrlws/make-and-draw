import { useEffect, useRef, useState, type ChangeEvent as RCE, type CSSProperties, type PointerEvent as RPE } from 'react'
import getStroke from 'perfect-freehand'
import { IconButton } from '../components/riso'
import { generatePbn, type PbnResult } from '../cbn/pbn'
import { PBN_SOURCES, preprocess, rasterize } from '../cbn/pbnSources'
import { useGame } from '../game/context'
import { clearDraft, loadDraft, saveDraft } from '../game/draftStore'
import { printHtml } from '../game/exporter'
import { c, fonts } from '../theme'
import { buildParticles } from '../utils'

const WK = { w: 150, h: 188 } // working raster resolution → viewBox
const DETAILS = [
  { k: 'Simple', colors: 10, minArea: 46 },
  { k: 'Medium', colors: 14, minArea: 22 },
  { k: 'Detailed', colors: 20, minArea: 11 },
]
// photo tune tables + labels (3 steps each)
const BRIGHT = [-40, 0, 40]
const CONTRAST = [0.82, 1, 1.32]
const SMOOTH = [0, 1, 2]
const T_BRIGHT = ['dim', 'bright', 'bright +']
const T_CONTRAST = ['soft', 'pop', 'pop +']
const T_SMOOTH = ['sharp', 'smooth', 'smoother']

const hexOf = (rgb: [number, number, number]) => '#' + rgb.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')
const isDark = (rgb: [number, number, number]) => 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2] < 140

/** min bbox extent of a path's coords (for numeral sizing) */
function pathMinExtent(d: string): number {
  const nums = d.match(/-?\d+\.?\d*/g)
  if (!nums) return 0
  let mnx = Infinity
  let mny = Infinity
  let mxx = -Infinity
  let mxy = -Infinity
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = +nums[i]
    const y = +nums[i + 1]
    mnx = Math.min(mnx, x)
    mxx = Math.max(mxx, x)
    mny = Math.min(mny, y)
    mxy = Math.max(mxy, y)
  }
  return Math.min(mxx - mnx, mxy - mny)
}

interface Stroke {
  pts: number[]
  color: string
}

/** One undoable step: a numbered fill or a free-paint stroke. */
type Act = { k: 'f'; i: number } | { k: 's' }

/** Everything needed to resume a half-finished picture after reload/back. */
interface CbnDraft {
  srcIdx: number
  detail: number
  tune: { b: number; c: number; s: number }
  fills: number[]
  strokes: Stroke[]
  pot: number | null
  photo?: string
}

function outline(points: number[][], size: number): number[] {
  const s = getStroke(points, { size, thinning: 0.55, smoothing: 0.62, streamline: 0.5 })
  const flat: number[] = []
  for (const p of s) flat.push(p[0], p[1])
  return flat
}

const chip: CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: 800,
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '.04em',
  color: c.ink,
  background: '#fff',
  border: `2.5px solid ${c.ink}`,
  borderRadius: 8,
  padding: '0 12px',
  minHeight: 40,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  boxShadow: '0 3px 0 #16130f',
  cursor: 'pointer',
}

export function ColourByNumber() {
  const { go, play, showToast, startFinish, reducedMotion, state } = useGame()
  // a draft (if any) seeds the initial source/detail/tune; its fills/strokes
  // are applied after the first matching generate pass below
  const [draft] = useState(() => loadDraft<CbnDraft>('cbn'))
  // a photo draft without its photo can never generate — fall back to source 0
  const [srcIdx, setSrcIdx] = useState(() => (draft ? (draft.srcIdx >= 0 ? draft.srcIdx : draft.photo ? -1 : 0) : 0))
  const [detail, setDetail] = useState(() => draft?.detail ?? 1)
  const [pbn, setPbn] = useState<PbnResult | null>(null)

  const [pot, setPot] = useState<number | null>(null)
  const [filled, setFilled] = useState<Set<number>>(new Set())
  const [hist, setHist] = useState<Act[]>([])
  const [mode, setMode] = useState<'number' | 'paint'>('number')
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [wet, setWet] = useState<number[]>([])
  const [flash, setFlash] = useState<number | null>(null)

  const [photo, setPhoto] = useState<ImageData | null>(null)
  // photo tune: indices into the level tables below
  const [tune, setTune] = useState(() => draft?.tune ?? { b: 1, c: 1, s: 1 })

  const svgRef = useRef<SVGSVGElement>(null)
  const drawing = useRef<number[][] | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const restoreRef = useRef<CbnDraft | null>(draft)
  const photoUrlRef = useRef<string | null>(draft?.photo ?? null)
  const armedRef = useRef(0)

  // ---- pinch-zoom + pan: dense prints need fingers to get closer ----
  const [view, setView] = useState({ s: 1, tx: 0, ty: 0 })
  const viewRef = useRef(view)
  viewRef.current = view
  const ptrs = useRef(new Map<number, [number, number]>())
  const pinch0 = useRef<{ d: number; s: number; cx: number; cy: number; tx: number; ty: number } | null>(null)
  const pinchGuard = useRef(0)
  const clampView = (s: number, tx: number, ty: number, w: number, h: number) => ({
    s,
    tx: Math.min(0, Math.max(w * (1 - s), tx)),
    ty: Math.min(0, Math.max(h * (1 - s), ty)),
  })
  const onZoomDown = (e: RPE<HTMLDivElement>) => {
    if (mode !== 'number') return
    ptrs.current.set(e.pointerId, [e.clientX, e.clientY])
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()]
      const v = viewRef.current
      pinch0.current = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, s: v.s, cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2, tx: v.tx, ty: v.ty }
      pinchGuard.current = performance.now()
    }
  }
  const onZoomMove = (e: RPE<HTMLDivElement>) => {
    if (!ptrs.current.has(e.pointerId)) return
    ptrs.current.set(e.pointerId, [e.clientX, e.clientY])
    const p0 = pinch0.current
    if (!p0 || ptrs.current.size < 2) return
    pinchGuard.current = performance.now()
    const [a, b] = [...ptrs.current.values()]
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1
    const cx = (a[0] + b[0]) / 2
    const cy = (a[1] + b[1]) / 2
    const s = Math.min(4, Math.max(1, (p0.s * d) / p0.d))
    // keep the content point under the initial midpoint anchored to the fingers
    const tx = cx - (s / p0.s) * (p0.cx - p0.tx)
    const ty = cy - (s / p0.s) * (p0.cy - p0.ty)
    const el = e.currentTarget
    setView(clampView(s, tx, ty, el.clientWidth, el.clientHeight))
  }
  const onZoomUp = (e: RPE<HTMLDivElement>) => {
    ptrs.current.delete(e.pointerId)
    if (ptrs.current.size < 2) {
      pinch0.current = null
      // near-1× drifts snap back to a tidy full view
      if (viewRef.current.s < 1.04 && viewRef.current.s !== 1) setView({ s: 1, tx: 0, ty: 0 })
    }
  }

  // restore a draft photo (data-URL → ImageData) so photo pictures resume too
  useEffect(() => {
    const url = draft?.photo
    if (!url) return
    let cancelled = false
    const im = new Image()
    im.onload = () => {
      if (cancelled) return
      const cv = document.createElement('canvas')
      cv.width = WK.w
      cv.height = WK.h
      const ctx = cv.getContext('2d', { willReadFrequently: true })!
      ctx.drawImage(im, 0, 0, WK.w, WK.h)
      setPhoto(ctx.getImageData(0, 0, WK.w, WK.h))
    }
    im.src = url
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // srcIdx === -1 means "use the uploaded photo"
  const srcName = srcIdx < 0 ? 'My photo' : PBN_SOURCES[srcIdx].name

  // generate the paint-by-numbers facets whenever the source or detail changes
  useEffect(() => {
    setPbn(null)
    const id = window.setTimeout(() => {
      const det = DETAILS[detail]
      let img: { data: Uint8ClampedArray; width: number; height: number } | null = srcIdx < 0 ? photo : rasterize(PBN_SOURCES[srcIdx], WK.w, WK.h)
      if (!img) return
      // uploaded photos get the brightness/contrast + edge-aware smooth pre-pass
      if (srcIdx < 0) img = preprocess(img, { brightness: BRIGHT[tune.b], contrast: CONTRAST[tune.c], smooth: SMOOTH[tune.s] })
      const res = generatePbn(img, { colors: det.colors, minArea: det.minArea, simplify: 1.1 })
      setPbn(res)
      const d = restoreRef.current
      if (d) {
        // first generate after mount matches the draft's inputs — resume it
        restoreRef.current = null
        const fills = d.fills.filter((fi) => fi >= 0 && fi < res.regions.length)
        setFilled(new Set(fills))
        setStrokes(d.strokes)
        setHist([...fills.map((fi) => ({ k: 'f', i: fi }) as Act), ...d.strokes.map(() => ({ k: 's' }) as Act)])
        setPot(d.pot != null && d.pot <= res.palette.length ? d.pot : null)
      } else {
        setFilled(new Set())
        setStrokes([])
        setHist([])
        setPot(null)
      }
    }, 16)
    return () => clearTimeout(id)
  }, [srcIdx, detail, photo, tune])

  // persist the draft on every change — reload/back can never lose a picture
  useEffect(() => {
    if (!pbn || restoreRef.current) return
    const fills: number[] = []
    for (const a of hist) if (a.k === 'f') fills.push(a.i)
    saveDraft('cbn', {
      srcIdx,
      detail,
      tune,
      fills,
      strokes,
      pot,
      ...(srcIdx < 0 && photoUrlRef.current ? { photo: photoUrlRef.current } : {}),
    } satisfies CbnDraft)
  }, [pbn, hist, strokes, srcIdx, detail, tune, pot])

  // load a photo from the device, cover-fit it into the working canvas (all
  // local — nothing leaves the browser), then feed it to the generator.
  const onFile = (e: RCE<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const url = URL.createObjectURL(f)
    const im = new Image()
    im.onload = () => {
      const cv = document.createElement('canvas')
      cv.width = WK.w
      cv.height = WK.h
      const ctx = cv.getContext('2d', { willReadFrequently: true })!
      ctx.fillStyle = '#f4f1e7'
      ctx.fillRect(0, 0, WK.w, WK.h)
      const s = Math.max(WK.w / im.width, WK.h / im.height)
      const dw = im.width * s
      const dh = im.height * s
      ctx.drawImage(im, (WK.w - dw) / 2, (WK.h - dh) / 2, dw, dh)
      photoUrlRef.current = cv.toDataURL('image/jpeg', 0.82) // compact copy for the draft
      setPhoto(ctx.getImageData(0, 0, WK.w, WK.h))
      setSrcIdx(-1)
      URL.revokeObjectURL(url)
    }
    im.src = url
    e.target.value = ''
  }

  useEffect(() => {
    if (flash == null) return
    const t = window.setTimeout(() => setFlash(null), 650)
    return () => clearTimeout(t)
  }, [flash])

  const palette = pbn?.palette ?? []
  const regions = pbn?.regions ?? []
  const total = regions.length
  const filledCount = filled.size
  const done = total > 0 && filledCount >= total
  const potCount = palette.length
  const remaining = palette.map((_, i) => regions.reduce((a, r, ri) => a + (r.n === i + 1 && !filled.has(ri) ? 1 : 0), 0))

  const tap = (i: number) => {
    if (mode !== 'number' || filled.has(i)) return
    if (performance.now() - pinchGuard.current < 350) return // pinch, not a tap
    const r = regions[i]
    if (pot == null) {
      showToast('pick a colour first!')
      return
    }
    if (pot === r.n) {
      const next = new Set(filled)
      next.add(i)
      setFilled(next)
      setHist((h) => [...h, { k: 'f', i }])
      const pent = [1, 1.122, 1.26, 1.335, 1.498]
      play('pop', pent[next.size % pent.length])
      if (next.size >= total) {
        play('fw')
        showToast('all done — beautiful!')
      } else if (remaining[pot - 1] <= 1) {
        const nextPot = palette.findIndex((_, i2) => i2 + 1 !== pot && regions.some((rg, ri) => rg.n === i2 + 1 && !next.has(ri)))
        if (nextPot >= 0) setPot(nextPot + 1)
      }
    } else {
      play('wrong')
      setFlash(i)
    }
  }

  // ---- free paint (SVG-space perfect-freehand) ----
  const toView = (e: { clientX: number; clientY: number }): [number, number] => {
    const svg = svgRef.current
    if (!svg || !pbn) return [0, 0]
    const rect = svg.getBoundingClientRect()
    return [((e.clientX - rect.left) / rect.width) * pbn.w, ((e.clientY - rect.top) / rect.height) * pbn.h]
  }
  const brush = pbn ? pbn.w * 0.03 : 3
  const startDraw = (e: RPE) => {
    if (mode !== 'paint') return
    drawing.current = [toView(e)]
    setWet(outline(drawing.current, brush))
  }
  const lastSfx = useRef(0)
  const moveDraw = (e: RPE) => {
    if (mode !== 'paint' || !drawing.current) return
    drawing.current.push(toView(e))
    setWet(outline(drawing.current, brush))
    // painting is never silent — a soft wet drag under the brush
    const t = performance.now()
    if (t - lastSfx.current > 95) {
      lastSfx.current = t
      play('swirl', 0.85 + Math.random() * 0.4)
    }
  }
  const endDraw = () => {
    if (mode !== 'paint' || !drawing.current) return
    const o = outline(drawing.current, brush)
    drawing.current = null
    setWet([])
    if (o.length >= 6) {
      setStrokes((s) => [...s, { pts: o, color: pot != null ? hexOf(palette[pot - 1]) : hexOf(palette[0] ?? [255, 46, 126]) }])
      setHist((h) => [...h, { k: 's' }])
      play('pop', 0.9 + Math.random() * 0.2)
    }
  }

  // one step back — a fill or a paint stroke, whichever came last
  const undo = () => {
    const last = hist[hist.length - 1]
    if (!last) return
    setHist((h) => h.slice(0, -1))
    if (last.k === 's') {
      setStrokes((s) => s.slice(0, -1))
    } else {
      setFilled((f) => {
        const next = new Set(f)
        next.delete(last.i)
        return next
      })
    }
    play('select')
  }

  /** Destructive-switch guard: changing print/detail/tune mid-picture needs a
   * second tap within 3s, so one stray tap can't wipe the colouring. */
  const dirty = filled.size + strokes.length > 0
  const guard = (fn: () => void) => {
    if (!dirty || Date.now() - armedRef.current < 3000) {
      armedRef.current = 0
      fn()
      return
    }
    armedRef.current = Date.now()
    play('wrong')
    showToast('tap again — this starts a new picture')
  }

  /** Print the outlines + numbers on real paper — colour it with crayons. */
  const printPage = () => {
    if (!pbn) return
    play('page')
    const paths = regions
      .map((r) => `<path d="${r.d}" fill="#fff" stroke="#16130f" stroke-width="0.45" stroke-linejoin="round"/>`)
      .join('')
    const nums = regions
      .map((r) => {
        const ext = pathMinExtent(r.d)
        if (ext < 5) return ''
        const fs = Math.max(3, Math.min(6.5, ext * 0.4))
        return `<text x="${r.lx}" y="${r.ly}" text-anchor="middle" dominant-baseline="central" font-size="${fs}" font-family="sans-serif" font-weight="700" fill="#555">${r.n}</text>`
      })
      .join('')
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pbn.w} ${pbn.h}">${paths}${nums}</svg>`
    const legend = palette.map((rgb, i) => `<span class="swatch"><i style="background:${hexOf(rgb)}"></i>${i + 1}</span>`).join('')
    printHtml(
      `<h1>${srcName} — colour by number</h1><p class="sub">Make &amp; Draw print studio · match each number to its ink</p>${svg}<div class="legend">${legend}</div>`,
      `Make & Draw — ${srcName}`,
    )
  }

  const finish = () => {
    if (!pbn || (!done && strokes.length === 0)) {
      showToast('fill it in first!')
      return
    }
    const paths = regions
      .map((r, i) => `<path d="${r.d}" fill="${filled.has(i) ? hexOf(palette[r.n - 1]) : '#f4f1e7'}" stroke="#16130f" stroke-width="0.4" stroke-linejoin="round"/>`)
      .join('')
    const paint = strokes.map((s) => `<polygon points="${ptsToStr(s.pts)}" fill="${s.color}"/>`).join('')
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${pbn.w} ${pbn.h}'><rect width='${pbn.w}' height='${pbn.h}' fill='#f4f1e7'/>${paths}${paint}</svg>`
    clearDraft('cbn') // kept — next visit starts a fresh picture
    startFinish({ type: 'cbn', title: srcName, img: 'data:image/svg+xml;utf8,' + encodeURIComponent(svg), tint: hexOf(palette[0] ?? [255, 46, 126]) })
  }

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px' }}>
        <IconButton onClick={() => go('home')} ariaLabel="back" size={48} style={{ fontFamily: fonts.display, fontSize: 24 }}>
          ‹
        </IconButton>
        <div style={{ flex: 1, minWidth: 0, fontFamily: fonts.display, fontSize: 20, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Paint by number</div>
        <button onClick={() => guard(() => setDetail((d) => (d + 1) % DETAILS.length))} style={{ ...chip }} aria-label="detail level">
          {DETAILS[detail].k}
        </button>
        <button onClick={() => setMode((m) => (m === 'number' ? 'paint' : 'number'))} aria-pressed={mode === 'paint'} style={{ ...chip, background: mode === 'paint' ? c.ink : '#fff', color: mode === 'paint' ? c.paper : c.ink }}>
          {mode === 'paint' ? '✎' : '#'}
        </button>
        <button onClick={finish} aria-disabled={!done} style={{ ...chip, background: done ? c.teal : c.disabled, boxShadow: done ? '0 4px 0 #16130f' : 'none' }}>
          Keep ✓
        </button>
      </div>

      {/* stage */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ position: 'relative', background: '#fff', border: `3px solid ${c.ink}`, borderRadius: 6, boxShadow: `6px 6px 0 ${palette[0] ? hexOf(palette[0]) : c.pink}`, padding: 8 }}>
          <div
            style={{ width: 'min(420px, 86vw)', aspectRatio: `${WK.w} / ${WK.h}`, borderRadius: 3, overflow: 'hidden', background: '#f4f1e7', touchAction: 'none', animation: done ? 'wobble .8s ease-in-out .2s' : undefined, position: 'relative' }}
            onPointerDown={onZoomDown}
            onPointerMove={onZoomMove}
            onPointerUp={onZoomUp}
            onPointerCancel={onZoomUp}
            onPointerLeave={onZoomUp}
          >
            {pbn ? (
              <svg
                ref={svgRef}
                viewBox={`0 0 ${pbn.w} ${pbn.h}`}
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'block',
                  transform: view.s !== 1 ? `translate(${view.tx}px, ${view.ty}px) scale(${view.s})` : undefined,
                  transformOrigin: '0 0',
                }}
                onPointerDown={startDraw}
                onPointerMove={moveDraw}
                onPointerUp={endDraw}
                onPointerLeave={endDraw}
              >
                {regions.map((r, i) => {
                  const isFilled = filled.has(i)
                  const active = mode === 'number' && pot === r.n && !isFilled
                  const col = hexOf(palette[r.n - 1])
                  return (
                    <path
                      key={i}
                      d={r.d}
                      fill={isFilled ? col : '#f7f4ea'}
                      stroke={active ? col : flash === i ? c.pink : '#16130f'}
                      strokeWidth={active ? 1.3 : 0.4}
                      strokeLinejoin="round"
                      style={active ? { strokeDasharray: '2.4 2.4', animation: 'ants .5s linear infinite' } : undefined}
                      onClick={() => mode === 'number' && tap(i)}
                    />
                  )
                })}
                {mode === 'number' &&
                  regions.map((r, i) => {
                    if (filled.has(i)) return null
                    const ext = pathMinExtent(r.d)
                    if (ext < 6 && flash !== i) return null
                    const fs = flash === i ? 9 : Math.max(3.4, Math.min(7, ext * 0.42))
                    return (
                      <text
                        key={'t' + i}
                        x={r.lx}
                        y={r.ly}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontFamily={fonts.body}
                        fontWeight={800}
                        fontSize={fs}
                        fill={flash === i ? hexOf(palette[r.n - 1]) : '#6f675a'}
                        style={{ pointerEvents: 'none' }}
                      >
                        {r.n}
                      </text>
                    )
                  })}
                {strokes.map((s, i) => (
                  <polygon key={'s' + i} points={ptsToStr(s.pts)} fill={s.color} />
                ))}
                {wet.length >= 6 && <polygon points={ptsToStr(wet)} fill={pot != null ? hexOf(palette[pot - 1]) : hexOf(palette[0] ?? [255, 46, 126])} opacity={0.9} />}
              </svg>
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: fonts.body, fontWeight: 700, fontSize: 13, color: c.hint }}>printing…</div>
            )}
            {view.s > 1.04 && (
              <button
                onClick={() => setView({ s: 1, tx: 0, ty: 0 })}
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  fontFamily: fonts.body,
                  fontWeight: 800,
                  fontSize: 11,
                  textTransform: 'uppercase',
                  color: c.ink,
                  background: '#fff',
                  border: `2px solid ${c.ink}`,
                  borderRadius: 6,
                  padding: '5px 8px',
                  boxShadow: '0 2px 0 #16130f',
                  cursor: 'pointer',
                }}
              >
                ↺ 1×
              </button>
            )}
          </div>
          {done && (
            <div style={{ position: 'absolute', inset: 8, pointerEvents: 'none', overflow: 'hidden', borderRadius: 3 }}>
              <div style={{ position: 'absolute', top: 0, bottom: 0, width: 70, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.85),transparent)', animation: 'shim 1.1s ease-out' }} />
              {buildParticles(reducedMotion || state.calm).map((p, i) => (
                <span
                  key={i}
                  style={
                    {
                      position: 'absolute',
                      left: '50%',
                      top: '46%',
                      width: 8,
                      height: 12,
                      borderRadius: 2,
                      background: p.c,
                      '--tx': `${p.tx}px`,
                      '--ty': `${p.ty}px`,
                      animation: `${reducedMotion || state.calm ? 'conf' : 'fw'} ${p.d}s ease-out ${p.delay}s both`,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* tools */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', padding: '2px 16px 18px' }}>
        {mode === 'number' && total > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 'min(300px, 82vw)' }}>
            <div style={{ flex: 1, height: 8, background: c.toggleOff, borderRadius: 5, overflow: 'hidden', border: `1.5px solid ${c.ink}` }}>
              <div style={{ width: `${(filledCount / total) * 100}%`, height: '100%', background: c.teal, transition: 'width .2s' }} />
            </div>
            <span style={{ fontFamily: fonts.body, fontWeight: 800, fontSize: 12, color: c.hint, minWidth: 52, textAlign: 'right' }}>
              {filledCount}/{total}
            </span>
          </div>
        )}
        <div style={{ fontFamily: fonts.body, fontWeight: 700, fontSize: 13, color: c.hint }}>
          {!pbn ? 'printing…' : done ? 'finished! press keep →' : mode === 'paint' ? 'free paint — scribble anywhere' : pot == null ? 'pick a colour to begin' : 'tap the glowing shapes · pinch to zoom'}
        </div>
        {/* palette rail */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', maxWidth: 'min(440px, 94vw)' }}>
          {palette.map((rgb, i) => {
            const n = i + 1
            const rem = remaining[i]
            const potDone = mode === 'number' && rem === 0
            const col = hexOf(rgb)
            return (
              <button
                key={i}
                aria-label={`colour ${n}`}
                aria-pressed={pot === n}
                onClick={() => {
                  setPot(n)
                  play('select')
                }}
                style={{
                  position: 'relative',
                  width: 40,
                  height: 40,
                  borderRadius: 7,
                  background: col,
                  opacity: potDone ? 0.4 : 1,
                  border: pot === n ? `3.5px solid ${c.ink}` : '2.5px solid rgba(22,19,15,.35)',
                  transform: pot === n ? 'translateY(-2px)' : undefined,
                  fontFamily: fonts.display,
                  fontSize: 17,
                  color: isDark(rgb) ? '#fff' : c.ink,
                  cursor: 'pointer',
                  transition: 'transform .12s',
                }}
              >
                {n}
                {mode === 'number' && (
                  <span style={{ position: 'absolute', top: -6, right: -6, minWidth: 17, height: 17, padding: '0 3px', borderRadius: 9, background: potDone ? c.teal : '#fff', color: c.ink, border: `2px solid ${c.ink}`, fontFamily: fonts.body, fontWeight: 800, fontSize: 9, lineHeight: '13px', textAlign: 'center' }}>{potDone ? '✓' : rem}</span>
                )}
              </button>
            )
          })}
          {potCount === 0 && <span style={{ fontFamily: fonts.body, fontWeight: 700, fontSize: 13, color: c.hint }}>…</span>}
        </div>
        {(hist.length > 0 || strokes.length > 0) && (
          <div style={{ display: 'flex', gap: 8 }}>
            {hist.length > 0 && (
              <button onClick={undo} style={{ ...chip, minHeight: 34 }}>
                ↶ undo
              </button>
            )}
            {strokes.length > 0 && (
              <button
                onClick={() => {
                  setStrokes([])
                  setHist((h) => h.filter((a) => a.k !== 's'))
                }}
                style={{ ...chip, minHeight: 34 }}
              >
                clear paint
              </button>
            )}
          </div>
        )}
        {/* photo tune (only for uploaded photos) */}
        {srcIdx < 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em', fontSize: 12, opacity: 0.55 }}>Tune</span>
            <button onClick={() => guard(() => setTune((t) => ({ ...t, b: (t.b + 1) % 3 })))} style={{ ...chip, minHeight: 34 }}>
              ☀ {T_BRIGHT[tune.b]}
            </button>
            <button onClick={() => guard(() => setTune((t) => ({ ...t, c: (t.c + 1) % 3 })))} style={{ ...chip, minHeight: 34 }}>
              ◑ {T_CONTRAST[tune.c]}
            </button>
            <button onClick={() => guard(() => setTune((t) => ({ ...t, s: (t.s + 1) % 3 })))} style={{ ...chip, minHeight: 34 }}>
              ≈ {T_SMOOTH[tune.s]}
            </button>
          </div>
        )}
        {/* source picker */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em', fontSize: 12, opacity: 0.55 }}>Print</span>
          {PBN_SOURCES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => {
                if (i !== srcIdx) guard(() => setSrcIdx(i))
              }}
              style={{ ...chip, minHeight: 36, background: i === srcIdx ? c.ink : '#fff', color: i === srcIdx ? c.paper : c.ink }}
            >
              {s.name}
            </button>
          ))}
          {photo && (
            <button
              onClick={() => {
                if (srcIdx >= 0) guard(() => setSrcIdx(-1))
              }}
              style={{ ...chip, minHeight: 36, background: srcIdx < 0 ? c.ink : '#fff', color: srcIdx < 0 ? c.paper : c.ink }}
            >
              My photo
            </button>
          )}
          <button onClick={() => guard(() => fileRef.current?.click())} style={{ ...chip, minHeight: 36, background: c.pink, color: c.ink }}>
            ＋ Photo
          </button>
          <button onClick={printPage} style={{ ...chip, minHeight: 36 }} aria-label="print this page to colour on paper">
            ⎙ Print page
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
        </div>
      </div>
    </div>
  )
}

function ptsToStr(flat: number[]): string {
  let s = ''
  for (let i = 0; i + 1 < flat.length; i += 2) s += `${flat[i].toFixed(1)},${flat[i + 1].toFixed(1)} `
  return s.trim()
}
