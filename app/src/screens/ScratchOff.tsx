import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPE } from 'react'
import { IconButton } from '../components/riso'
import { useGame } from '../game/context'
import { clearDraft, loadDraft, saveDraft } from '../game/draftStore'
import { SCRATCH_SVGS } from '../scratch/scratchSvgs'
import { c, fonts } from '../theme'
import { buildParticles } from '../utils'

const COAT = '#151310'
const REVEAL_AT = 0.3 // scratch this much and the rest peels away on its own

/** a colouring page loaded from a bundled SVG (viewBox 0 0 100 100) */
interface Pic {
  id: string
  name: string
  paths: string[]
}

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

interface ScratchDraft {
  pic: number
  seed: number
  /** index into TOOLS of the last-used scratch tool */
  tool?: number
  strokes: Stroke[]
  done?: boolean
}

export function ScratchOff() {
  const { go, play, showToast, startFinish, reducedMotion, state } = useGame()
  const draft = useRef(loadDraft<ScratchDraft>('scratch'))
  // colouring pages are pulled from public/scratch/ (scratchSvgs.ts), not inline
  const [pics, setPics] = useState<Pic[]>([])
  const [picIdx, setPicIdx] = useState(() => Math.max(0, draft.current?.pic ?? 0))
  const [seed, setSeed] = useState(() => draft.current?.seed ?? Math.floor(Math.random() * 360))
  const [toolIdx, setToolIdx] = useState(() => Math.max(0, Math.min(TOOLS.length - 1, draft.current?.tool ?? 0)))
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [scratched, setScratched] = useState(0)
  const [done, setDone] = useState(() => !!draft.current?.done)

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
  const doneRef = useRef(done)
  doneRef.current = done
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
          const paths = [...doc.querySelectorAll('path')].map((p) => p.getAttribute('d') || '').filter(Boolean)
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

  // ---- painters ----
  // holographic rainbow foil (what a scratch reveals), with the colouring-page
  // outline printed dark on top so the picture stays readable on the foil.
  const paintHolo = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.globalCompositeOperation = 'source-over'
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
    // the colouring-page outline, printed dark so the picture reads on the foil
    const m = picMatrix(w, h)
    ctx.strokeStyle = 'rgba(18,14,10,.62)'
    ctx.lineWidth = Math.max(1.5, m.a * 2.2)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    for (const d of pic?.paths ?? []) {
      const sp = new Path2D()
      sp.addPath(new Path2D(d), m)
      ctx.stroke(sp)
    }
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
    const m = picMatrix(w, h)
    ctx.strokeStyle = 'rgba(255,255,255,.28)'
    ctx.lineWidth = Math.max(1.4, m.a * 1.8)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    for (const d of pic?.paths ?? []) {
      const sp = new Path2D()
      sp.addPath(new Path2D(d), m)
      ctx.stroke(sp)
    }
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
      ctx.globalCompositeOperation = 'source-over'
      return
    }

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
    ctx.globalCompositeOperation = 'source-over'
  }

  /** repaint both layers from scratch-stroke history (undo / resize / restore) */
  const repaint = () => {
    const rc = neonRef.current
    const cc = coatRef.current
    if (!rc || !cc) return
    paintHolo(rc.getContext('2d')!, rc.width, rc.height)
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
    saveDraft('scratch', { pic: picIdx, seed, tool: toolIdx, done: doneRef.current, strokes: strokes.current } satisfies ScratchDraft)
  }

  const finishReveal = () => {
    const cc = coatRef.current
    if (cc) cc.getContext('2d')!.clearRect(0, 0, cc.width, cc.height)
    setScratched(1)
    setDone(true)
    doneRef.current = true
    play('fw')
    persist()
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

  // build canvases whenever size / picture / seed changes
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
    if (doneRef.current) {
      cc.getContext('2d')!.clearRect(0, 0, cc.width, cc.height)
      setScratched(1)
    } else {
      setScratched(measure())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, picIdx, seed, pics])

  // ---- pointer scratching ----
  const toNorm = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = coatRef.current!.getBoundingClientRect()
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]
  }
  const down = (e: RPE) => {
    // left button / primary touch only, one finger at a time (a right-click or
    // a second finger must not punch a stray scratch)
    if (doneRef.current || e.button !== 0 || activePtr.current !== null) return
    activePtr.current = e.pointerId
    curTool.current = tool.id
    e.currentTarget.setPointerCapture?.(e.pointerId)
    cur.current = [...toNorm(e)]
    scratchAlong(coatRef.current!.getContext('2d')!, cur.current, curTool.current)
    play('scratch', 0.9 + Math.random() * 0.3)
  }
  const maybeReveal = () => {
    if (doneRef.current) return
    const frac = measure()
    setScratched(frac)
    if (frac >= REVEAL_AT) {
      showToast('ta-daa! 🌈')
      finishReveal()
    }
  }
  const move = (e: RPE) => {
    if (!cur.current || doneRef.current || e.pointerId !== activePtr.current) return
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
    if (t - lastMeasure.current > 220) {
      lastMeasure.current = t
      maybeReveal()
    }
  }
  const up = (e: RPE) => {
    if (e.pointerId !== activePtr.current) return
    activePtr.current = null
    if (!cur.current) return
    if (cur.current.length >= 2) strokes.current.push({ t: curTool.current, p: cur.current })
    cur.current = null
    // a fast swipe can cross the threshold between throttled measures — catch it
    if (doneRef.current) return
    maybeReveal()
    if (!doneRef.current) persist()
  }

  const undo = () => {
    if (done || !strokes.current.length) return
    strokes.current.pop()
    repaint()
    setScratched(measure())
    persist()
    play('select')
  }
  const recover = () => {
    // a brand-new surprise: a different picture + fresh neon colours. Changing
    // picIdx guarantees the build effect reruns and repaints.
    strokes.current = []
    setDone(false)
    doneRef.current = false
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
    startFinish({ type: 'scratch', title: `Holographic ${(pic?.name ?? 'picture').toLowerCase()}`, img: out.toDataURL('image/png'), tint: `hsl(${seed}, 92%, 58%)` })
  }

  const pickPic = (i: number) => {
    if (i === picIdx) return
    strokes.current = []
    setDone(false)
    doneRef.current = false
    setScratched(0)
    setPicIdx(i)
    // persist the new choice now (setPicIdx's value isn't in this closure yet)
    // so a reload before the next scratch keeps the freshly-picked picture
    saveDraft('scratch', { pic: i, seed, tool: toolIdx, strokes: [], done: false })
    play('select')
  }

  const pickTool = (i: number) => {
    if (i === toolIdx) return
    setToolIdx(i)
    // remember the tool choice without disturbing the artwork in progress
    saveDraft('scratch', { pic: picIdx, seed, tool: i, done: doneRef.current, strokes: strokes.current })
    play('select')
  }

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px' }}>
        <IconButton onClick={() => go('home')} ariaLabel="back" size={52} style={{ fontFamily: fonts.display, fontSize: 26 }}>
          ‹
        </IconButton>
        <div style={{ fontFamily: fonts.display, fontSize: 'clamp(15px, 4.6vw, 24px)', textTransform: 'uppercase', flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          Scratch art
        </div>
        <button onClick={undo} style={{ ...chip, padding: '9px 11px' }}>
          Undo
        </button>
        <button onClick={recover} style={{ ...chip, padding: '9px 11px' }}>
          New
        </button>
        <button onClick={keep} style={{ ...chip, padding: '9px 11px', background: scratched > 0.02 ? c.teal : c.disabled, color: c.ink }}>
          Keep ✓
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ position: 'relative', background: '#fff', border: `3px solid ${c.ink}`, borderRadius: 6, boxShadow: `6px 6px 0 ${c.pink}`, padding: 10 }}>
          <div
            ref={wrapRef}
            style={{ position: 'relative', width: 'min(560px, 88vw, 74vh)', aspectRatio: '1 / 1', borderRadius: 3, overflow: 'hidden', touchAction: 'none' }}
          >
            <canvas
              ref={neonRef}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                display: 'block',
                animation: calm ? undefined : 'hueShift 12s linear infinite',
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
            {done && (
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', borderRadius: 3 }}>
                <div style={{ position: 'absolute', top: 0, bottom: 0, width: 80, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.85),transparent)', animation: 'shim 1.1s ease-out' }} />
                {buildParticles(calm).map((p, i) => (
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
                        animation: `${calm ? 'conf' : 'fw'} ${p.d}s ease-out ${p.delay}s both`,
                      } as CSSProperties
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', padding: '2px 16px 20px' }}>
        {!done && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 'min(300px, 82vw)' }}>
            <div style={{ flex: 1, height: 8, background: c.toggleOff, borderRadius: 5, overflow: 'hidden', border: `1.5px solid ${c.ink}` }}>
              <div style={{ width: `${Math.min(100, (scratched / REVEAL_AT) * 100)}%`, height: '100%', background: c.teal, transition: 'width .2s' }} />
            </div>
          </div>
        )}
        <div style={{ fontFamily: fonts.body, fontWeight: 700, fontSize: 13, color: c.hint }}>
          {done ? 'holographic! press keep →' : scratched > 0.02 ? 'keep scratching…' : 'scratch out the picture — it comes up holographic!'}
        </div>
        {!done && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', maxWidth: 'min(460px, 94vw)' }}>
            <span style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em', fontSize: 12, opacity: 0.55 }}>Tool</span>
            {TOOLS.map((t, i) => (
              <button
                key={t.id}
                onClick={() => pickTool(i)}
                aria-pressed={i === toolIdx}
                title={t.name}
                style={{ ...chip, minHeight: 38, padding: '8px 12px', background: i === toolIdx ? c.ink : '#fff', color: i === toolIdx ? c.paper : c.ink }}
              >
                <span aria-hidden style={{ marginRight: 6 }}>{t.icon}</span>
                {t.name}
              </button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', maxWidth: 'min(460px, 94vw)' }}>
          <span style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em', fontSize: 12, opacity: 0.55 }}>Picture</span>
          {pics.map((p, i) => (
            <button
              key={p.id}
              onClick={() => pickPic(i)}
              aria-pressed={i === picIdx}
              style={{ ...chip, minHeight: 38, padding: '8px 11px', background: i === picIdx ? c.ink : '#fff', color: i === picIdx ? c.paper : c.ink }}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
