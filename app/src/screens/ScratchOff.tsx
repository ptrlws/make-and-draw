import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPE } from 'react'
import { IconButton } from '../components/riso'
import { useGame } from '../game/context'
import { clearDraft, loadDraft, saveDraft } from '../game/draftStore'
import { SCRATCH_SVGS } from '../scratch/scratchSvgs'
import { c, shadows, text } from '../theme'

const COAT = '#151310'

/** one shape of a colouring page. `fill` is the "real picture" colour and marks
 * a closed object shape; fill 'none' is a detail line (drawn on top as line-art,
 * but NOT part of the object silhouette a child scratches into). */
interface PicPath {
  d: string
  fill: string
}
/** a colouring page loaded from a bundled SVG (viewBox 0 0 100 100) */
interface Pic {
  id: string
  name: string
  paths: PicPath[]
}

/** what a scratch uncovers: holographic foil, or the real coloured picture */
type RevealStyle = 'foil' | 'colour'

/** the tools a real scratch-art kit gives a child: a fine wooden pick for
 * detail, a flat edge that scrapes a wide band, and a comb/rake that cuts
 * several fine grooves at once. r = brush radius as a fraction of canvas width. */
type ToolId = 'pick' | 'flat' | 'comb'
interface Tool {
  id: ToolId
  name: string
  icon: string
  r: number
}
const TOOLS: Tool[] = [
  { id: 'pick', name: 'Pick', icon: '✎', r: 0.008 },
  { id: 'flat', name: 'Flat', icon: '▬', r: 0.032 },
  { id: 'comb', name: 'Comb', icon: '≡', r: 0.007 },
]
const COMB_TINES = 4

/** one committed scratch: which tool cut it + a flat [nx,ny,…] point list,
 * normalized 0..1 so undo / resize / rotate all replay to the right place. */
interface Stroke {
  t: ToolId
  p: number[]
}

/** unit normals per point (perpendicular to local travel), so the comb's
 * parallel tines follow the stroke rather than always pointing one way. */
function pointNormals(P: [number, number][]): [number, number][] {
  const m = P.length
  if (m < 2) return [[1, 0]]
  const out: [number, number][] = []
  for (let i = 0; i < m; i++) {
    const a = P[Math.max(0, i - 1)]
    const b = P[Math.min(m - 1, i + 1)]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len = Math.hypot(dx, dy) || 1
    out.push([-dy / len, dx / len])
  }
  return out
}

const chip: CSSProperties = {
  ...text.labelSm,
  color: c.ink,
  background: c.card,
  border: 'none',
  borderRadius: 14,
  padding: '11px 13px',
  minHeight: 44,
  boxShadow: shadows.dropSm,
  cursor: 'pointer',
}

/** tiny eyebrow above a group of chips — meta, so it stays uppercase and faint */
const eyebrow: CSSProperties = {
  ...text.eyebrow,
  color: c.faint,
}

interface ScratchDraft {
  pic: number
  seed: number
  /** index into TOOLS of the last-used scratch tool */
  tool?: number
  /** which reveal the child chose */
  style?: RevealStyle
  strokes: Stroke[]
}

export function ScratchOff() {
  const { go, play, showToast, startFinish, reducedMotion, state } = useGame()
  const draft = useRef(loadDraft<ScratchDraft>('scratch'))
  // colouring pages are pulled from public/scratch/ (scratchSvgs.ts), not inline
  const [pics, setPics] = useState<Pic[]>([])
  const [picIdx, setPicIdx] = useState(() => Math.max(0, draft.current?.pic ?? 0))
  const [seed, setSeed] = useState(() => draft.current?.seed ?? Math.floor(Math.random() * 360))
  const [toolIdx, setToolIdx] = useState(() => Math.max(0, Math.min(TOOLS.length - 1, draft.current?.tool ?? 0)))
  const [style, setStyle] = useState<RevealStyle>(() => draft.current?.style ?? 'foil')
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [scratched, setScratched] = useState(0)

  const wrapRef = useRef<HTMLDivElement>(null)
  const neonRef = useRef<HTMLCanvasElement>(null)
  const coatRef = useRef<HTMLCanvasElement>(null)
  const dpr = useRef(1)
  /** committed scratches (tool + normalized points) — resolution-free, so
   * undo, resize and rotation all replay to the right place with the right tool. */
  const strokes = useRef<Stroke[]>([])
  const cur = useRef<number[] | null>(null)
  const curTool = useRef<ToolId>('pick') // the tool that cut the in-progress stroke
  const activePtr = useRef<number | null>(null) // one finger at a time
  const lastMeasure = useRef(0)
  const lastSfx = useRef(0)

  const pic = pics.length ? pics[Math.min(picIdx, pics.length - 1)] : undefined
  const tool = TOOLS[toolIdx]
  const calm = reducedMotion || state.calm

  // load the colouring pages from public/scratch/ once on mount
  useEffect(() => {
    let live = true
    Promise.all(
      SCRATCH_SVGS.map(async (s) => {
        try {
          const txt = await (await fetch(s.src)).text()
          const doc = new DOMParser().parseFromString(txt, 'image/svg+xml')
          const paths: PicPath[] = [...doc.querySelectorAll('path')]
            .map((p) => ({ d: p.getAttribute('d') || '', fill: p.getAttribute('fill') || 'none' }))
            .filter((p) => p.d)
          return paths.length ? ({ id: s.id, name: s.name, paths } as Pic) : null
        } catch {
          return null
        }
      }),
    ).then((loaded) => {
      if (live) setPics(loaded.filter((p): p is Pic => !!p))
    })
    return () => {
      live = false
    }
  }, [])

  // maps the 100x100 drawing box to a centred square inside the canvas
  const picMatrix = (w: number, h: number) => {
    const side = Math.min(w, h)
    const s = (side * 0.76) / 100
    return new DOMMatrix([s, 0, 0, s, (w - 100 * s) / 2, (h - 100 * s) / 2])
  }

  /** the object silhouette (union of the page's FILLED shapes) in canvas px —
   * scratches are clipped to it, so going over the lines is forgiven: you can
   * only ever uncover inside the picture. null if the page is pure line-art. */
  const silhouette = (w: number, h: number): Path2D | null => {
    const filled = (pic?.paths ?? []).filter((p) => p.fill && p.fill !== 'none')
    if (!filled.length) return null
    const m = picMatrix(w, h)
    const sp = new Path2D()
    for (const p of filled) sp.addPath(new Path2D(p.d), m)
    return sp
  }

  /** stroke every path as the dark line-art, sitting on top of whatever's below */
  const strokeOutline = (ctx: CanvasRenderingContext2D, w: number, h: number, colour: string, mul = 2.2) => {
    const m = picMatrix(w, h)
    ctx.strokeStyle = colour
    ctx.lineWidth = Math.max(1.4, m.a * mul)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    for (const p of pic?.paths ?? []) {
      const sp = new Path2D()
      sp.addPath(new Path2D(p.d), m)
      ctx.stroke(sp)
    }
  }

  // ---- painters ----
  // the reveal layer (bottom): holographic foil, or the real coloured picture,
  // with the line-art printed dark on top so the picture always reads cleanly.
  const paintReveal = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, w, h)
    if (style === 'colour') {
      const m = picMatrix(w, h)
      for (const p of pic?.paths ?? []) {
        if (!p.fill || p.fill === 'none') continue
        ctx.fillStyle = p.fill
        const sp = new Path2D()
        sp.addPath(new Path2D(p.d), m)
        ctx.fill(sp)
      }
    } else {
      // holographic rainbow foil
      const N = 12
      const base = ctx.createLinearGradient(0, 0, w, h)
      for (let i = 0; i <= N; i++) base.addColorStop(i / N, `hsl(${Math.round((seed + (i * 360) / N) % 360)}, 92%, 58%)`)
      ctx.fillStyle = base
      ctx.fillRect(0, 0, w, h)
      // a second rainbow the other way, blended, for the iridescent interference
      const cross = ctx.createLinearGradient(0, h, w, 0)
      for (let i = 0; i <= N; i++) cross.addColorStop(i / N, `hsla(${Math.round((seed + 140 + (i * 360) / N) % 360)}, 95%, 60%, 0.5)`)
      ctx.globalCompositeOperation = 'overlay'
      ctx.fillStyle = cross
      ctx.fillRect(0, 0, w, h)
      // bright diagonal foil streaks
      ctx.globalCompositeOperation = 'soft-light'
      for (const off of [0.22, 0.55, 0.84]) {
        const sg = ctx.createLinearGradient(w * (off - 0.13), 0, w * (off + 0.13), h)
        sg.addColorStop(0, 'rgba(255,255,255,0)')
        sg.addColorStop(0.5, 'rgba(255,255,255,.65)')
        sg.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = sg
        ctx.fillRect(0, 0, w, h)
      }
      // fine glints
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = 'rgba(255,255,255,.55)'
      const px = Math.max(1, dpr.current)
      for (let i = 0; i < 80; i++) {
        const x = (((i * 61) % 100) / 100) * w
        const y = (((i * 37) % 100) / 100) * h
        ctx.fillRect(x, y, px, px)
      }
    }
    // line-art on top, so overshoot at boundaries reads as framed, not messy
    ctx.globalCompositeOperation = 'source-over'
    strokeOutline(ctx, w, h, 'rgba(18,14,10,.7)', 2.2)
  }

  const paintCoat = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = COAT
    ctx.fillRect(0, 0, w, h)
    // brushed-foil sheen
    const g = ctx.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, 'rgba(255,255,255,.12)')
    g.addColorStop(0.5, 'rgba(255,255,255,.02)')
    g.addColorStop(1, 'rgba(255,255,255,.14)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    // sparkle flecks
    ctx.fillStyle = 'rgba(255,255,255,.16)'
    const px = Math.max(1, dpr.current)
    for (let i = 0; i < 150; i++) {
      const x = (((i * 61) % 100) / 100) * w
      const y = (((i * 97) % 100) / 100) * h
      ctx.fillRect(x, y, px, px)
    }
    // faint picture guide so kids can see what they're uncovering + trace it
    strokeOutline(ctx, w, h, 'rgba(255,255,255,.28)', 1.8)
    // hint, tucked at the bottom so it doesn't fight the drawing
    ctx.fillStyle = 'rgba(255,255,255,.4)'
    ctx.font = `700 ${Math.round(w * 0.04)}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('scratch ✨', w / 2, h * 0.92)
  }

  const scratchAlong = (ctx: CanvasRenderingContext2D, norm: number[], toolId: ToolId) => {
    if (norm.length < 2) return
    const W = ctx.canvas.width
    const H = ctx.canvas.height
    const t = TOOLS.find((x) => x.id === toolId) ?? TOOLS[0]
    const r = W * t.r
    const P: [number, number][] = []
    for (let i = 0; i + 1 < norm.length; i += 2) P.push([norm[i] * W, norm[i + 1] * H])

    ctx.save()
    // forgiveness: you can only scratch inside the object, so going over the
    // lines never spills the reveal outside the shape
    const sil = silhouette(W, H)
    if (sil) ctx.clip(sil)
    ctx.globalCompositeOperation = 'destination-out'
    ctx.strokeStyle = '#000'
    ctx.fillStyle = '#000'
    ctx.lineJoin = 'round'

    if (toolId === 'comb') {
      // a rake: COMB_TINES fine grooves, offset along the local normal so they
      // stay parallel as the stroke curves
      ctx.lineCap = 'round'
      ctx.lineWidth = r * 2
      const gap = r * 2.8
      const nrm = pointNormals(P)
      for (let k = 0; k < COMB_TINES; k++) {
        const off = (k - (COMB_TINES - 1) / 2) * gap
        if (P.length < 2) {
          const [nx, ny] = nrm[0]
          ctx.beginPath()
          ctx.arc(P[0][0] + nx * off, P[0][1] + ny * off, r, 0, 7)
          ctx.fill()
          continue
        }
        ctx.beginPath()
        for (let i = 0; i < P.length; i++) {
          const [nx, ny] = nrm[i]
          const x = P[i][0] + nx * off
          const y = P[i][1] + ny * off
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
    } else {
      // pick = a fine round point; flat = a wide square-edged scraper
      ctx.lineCap = toolId === 'flat' ? 'square' : 'round'
      ctx.lineWidth = r * 2
      ctx.beginPath()
      ctx.moveTo(P[0][0], P[0][1])
      for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1])
      ctx.stroke()
      // cap at the head so a single tap still scratches
      const [hx, hy] = P[P.length - 1]
      if (toolId === 'flat') ctx.fillRect(hx - r, hy - r, r * 2, r * 2)
      else {
        ctx.beginPath()
        ctx.arc(hx, hy, r, 0, 7)
        ctx.fill()
      }
    }
    ctx.restore()
  }

  /** repaint both layers from scratch-stroke history (undo / resize / restore) */
  const repaint = () => {
    const rc = neonRef.current
    const cc = coatRef.current
    if (!rc || !cc) return
    paintReveal(rc.getContext('2d')!, rc.width, rc.height)
    const cctx = cc.getContext('2d')!
    paintCoat(cctx, cc.width, cc.height)
    for (const s of strokes.current) scratchAlong(cctx, s.p, s.t)
  }

  const measure = () => {
    const cc = coatRef.current
    if (!cc) return 0
    const s = document.createElement('canvas')
    s.width = 64
    s.height = 64
    const g = s.getContext('2d')!
    g.drawImage(cc, 0, 0, 64, 64)
    const d = g.getImageData(0, 0, 64, 64).data
    let clear = 0
    for (let i = 3; i < d.length; i += 4) if (d[i] < 20) clear++
    return clear / (64 * 64)
  }

  const persist = () => {
    // strokes are already normalized 0..1 — store as-is
    saveDraft('scratch', { pic: picIdx, seed, tool: toolIdx, style, strokes: strokes.current } satisfies ScratchDraft)
  }

  // ---- sizing + (re)build ----
  useEffect(() => {
    const measureSize = () => {
      const el = wrapRef.current
      if (!el) return
      setSize({ w: el.clientWidth, h: el.clientHeight })
    }
    measureSize()
    window.addEventListener('resize', measureSize)
    return () => window.removeEventListener('resize', measureSize)
  }, [])

  // build canvases whenever size / picture / seed / reveal-style changes
  useEffect(() => {
    if (size.w < 2) return
    const rc = neonRef.current
    const cc = coatRef.current
    if (!rc || !cc) return
    const d = Math.min(2, window.devicePixelRatio || 1)
    dpr.current = d
    for (const cv of [rc, cc]) {
      cv.width = Math.round(size.w * d)
      cv.height = Math.round(size.h * d)
    }
    // restore scratch strokes from the draft (normalized — no scaling needed);
    // because strokes are resolution-free, a live resize/rotate just repaints
    // them to the right place with no rescale step.
    const dr = draft.current
    // migrate: older drafts stored strokes as bare number[][] (pick only)
    const raw = dr?.strokes as unknown as (Stroke | number[])[] | undefined
    if (raw?.length) {
      strokes.current = raw.map((s) => (Array.isArray(s) ? { t: 'pick' as ToolId, p: s.slice() } : { t: s.t, p: s.p.slice() }))
    }
    draft.current = null
    repaint()
    setScratched(measure())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, picIdx, seed, style, pics])

  // ---- pointer scratching ----
  const toNorm = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = coatRef.current!.getBoundingClientRect()
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]
  }
  const down = (e: RPE) => {
    // left button / primary touch only, one finger at a time (a right-click or
    // a second finger must not punch a stray scratch)
    if (e.button !== 0 || activePtr.current !== null) return
    activePtr.current = e.pointerId
    curTool.current = tool.id
    e.currentTarget.setPointerCapture?.(e.pointerId)
    cur.current = [...toNorm(e)]
    scratchAlong(coatRef.current!.getContext('2d')!, cur.current, curTool.current)
    play('scratch', 0.9 + Math.random() * 0.3)
  }
  const move = (e: RPE) => {
    if (!cur.current || e.pointerId !== activePtr.current) return
    const p = toNorm(e)
    const last = cur.current
    const px = last[last.length - 2]
    const py = last[last.length - 1]
    if (Math.hypot(p[0] - px, p[1] - py) < 0.0025) return
    cur.current.push(p[0], p[1])
    // erase just the newest segment (cheap) rather than the whole stroke
    scratchAlong(coatRef.current!.getContext('2d')!, [px, py, p[0], p[1]], curTool.current)
    const t = performance.now()
    if (t - lastSfx.current > 65) {
      lastSfx.current = t
      play('scratch', 0.9 + Math.random() * 0.4)
    }
    // track how much is uncovered only to enable Keep — never to auto-finish;
    // the child decides when the picture is done.
    if (t - lastMeasure.current > 220) {
      lastMeasure.current = t
      setScratched(measure())
    }
  }
  const up = (e: RPE) => {
    if (e.pointerId !== activePtr.current) return
    activePtr.current = null
    if (!cur.current) return
    if (cur.current.length >= 2) strokes.current.push({ t: curTool.current, p: cur.current })
    cur.current = null
    setScratched(measure())
    persist()
  }

  const undo = () => {
    if (!strokes.current.length) return
    strokes.current.pop()
    repaint()
    setScratched(measure())
    persist()
    play('select')
  }
  const recover = () => {
    // a brand-new surprise: a different picture + fresh foil colours. Changing
    // picIdx guarantees the build effect reruns and repaints.
    strokes.current = []
    setPicIdx((p) => (pics.length ? (p + 1 + Math.floor(Math.random() * (pics.length - 1))) % pics.length : 0))
    setSeed(Math.floor(Math.random() * 360))
    setScratched(0)
    clearDraft('scratch')
    play('page')
  }
  const keep = () => {
    const rc = neonRef.current
    const cc = coatRef.current
    if (!rc || !cc) return
    if (scratched < 0.02) {
      play('wrong')
      showToast('scratch some off first!')
      return
    }
    const out = document.createElement('canvas')
    out.width = rc.width
    out.height = rc.height
    const g = out.getContext('2d')!
    g.drawImage(rc, 0, 0)
    g.drawImage(cc, 0, 0)
    clearDraft('scratch')
    const name = (pic?.name ?? 'picture').toLowerCase()
    startFinish({
      type: 'scratch',
      title: style === 'colour' ? `Scratched ${name}` : `Holographic ${name}`,
      img: out.toDataURL('image/png'),
      tint: style === 'colour' ? c.pink : `hsl(${seed}, 92%, 58%)`,
    })
  }

  const pickPic = (i: number) => {
    if (i === picIdx) return
    strokes.current = []
    setScratched(0)
    setPicIdx(i)
    // persist the new choice now (setPicIdx's value isn't in this closure yet)
    // so a reload before the next scratch keeps the freshly-picked picture
    saveDraft('scratch', { pic: i, seed, tool: toolIdx, style, strokes: [] })
    play('select')
  }

  const pickTool = (i: number) => {
    if (i === toolIdx) return
    setToolIdx(i)
    // remember the tool choice without disturbing the artwork in progress
    saveDraft('scratch', { pic: picIdx, seed, tool: i, style, strokes: strokes.current })
    play('select')
  }

  const pickStyle = (s: RevealStyle) => {
    if (s === style) return
    setStyle(s)
    // strokes are kept — only the layer being uncovered changes
    saveDraft('scratch', { pic: picIdx, seed, tool: toolIdx, style: s, strokes: strokes.current })
    play('select')
  }

  const STYLES: { id: RevealStyle; name: string; icon: string }[] = [
    { id: 'foil', name: 'Foil', icon: '✨' },
    { id: 'colour', name: 'Colour', icon: '🎨' },
  ]

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px' }}>
        <IconButton onClick={() => go('home')} ariaLabel="back" size={44} style={{ ...text.display }}>
          ‹
        </IconButton>
        <div style={{ ...text.titleFluid, color: c.ink, flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          Scratch art
        </div>
        <IconButton onClick={undo} ariaLabel="undo" size={44} style={{ ...text.title }}>
          ↶
        </IconButton>
        <IconButton onClick={recover} ariaLabel="new picture" size={44} style={{ ...text.title }}>
          ↻
        </IconButton>
        <button
          onClick={keep}
          style={{
            ...chip,
            padding: '9px 11px',
            background: scratched > 0.02 ? c.teal : c.disabled,
            color: scratched > 0.02 ? c.card : c.hint,
            boxShadow: scratched > 0.02 ? shadows.drop : 'none',
          }}
        >
          Keep ✓
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ position: 'relative', background: c.card, border: 'none', borderRadius: 22, boxShadow: shadows.card, padding: 10 }}>
          <div
            ref={wrapRef}
            style={{ position: 'relative', width: 'min(560px, 88vw, 74vh)', aspectRatio: '1 / 1', borderRadius: 13, overflow: 'hidden', touchAction: 'none' }}
          >
            <canvas
              ref={neonRef}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                display: 'block',
                animation: !calm && style === 'foil' ? 'hueShift 12s linear infinite' : undefined,
              }}
            />
            <canvas
              ref={coatRef}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
              onContextMenu={(e) => e.preventDefault()}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', padding: '2px 16px 20px' }}>
        <div style={{ ...text.meta, color: c.hint }}>
          {scratched > 0.02 ? "keep going — press Keep ✓ when you're happy with it" : 'scratch to reveal — it stays inside the lines!'}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', maxWidth: 'min(460px, 94vw)' }}>
          <span style={eyebrow}>Reveal</span>
          {STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => pickStyle(s.id)}
              aria-pressed={s.id === style}
              title={s.name}
              style={{ ...chip, minHeight: 38, padding: '8px 12px', background: s.id === style ? c.ink : c.card, color: s.id === style ? c.card : c.ink }}
            >
              <span aria-hidden style={{ marginRight: 6 }}>{s.icon}</span>
              {s.name}
            </button>
          ))}
          <span style={{ ...eyebrow, marginLeft: 6 }}>Tool</span>
          {TOOLS.map((t, i) => (
            <button
              key={t.id}
              onClick={() => pickTool(i)}
              aria-pressed={i === toolIdx}
              title={t.name}
              style={{ ...chip, minHeight: 38, padding: '8px 12px', background: i === toolIdx ? c.ink : c.card, color: i === toolIdx ? c.card : c.ink }}
            >
              <span aria-hidden style={{ marginRight: 6 }}>{t.icon}</span>
              {t.name}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', maxWidth: 'min(460px, 94vw)' }}>
          <span style={eyebrow}>Picture</span>
          {pics.map((p, i) => (
            <button
              key={p.id}
              onClick={() => pickPic(i)}
              aria-pressed={i === picIdx}
              style={{ ...chip, minHeight: 38, padding: '8px 11px', background: i === picIdx ? c.ink : c.card, color: i === picIdx ? c.card : c.ink }}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
