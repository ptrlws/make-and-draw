import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPE } from 'react'
import { IconButton } from '../components/riso'
import { DOT_SVGS } from '../dots/dotSvgs'
import { useGame } from '../game/context'
import { clearDraft, loadDraft, saveDraft } from '../game/draftStore'
import { c, fonts, shadows } from '../theme'
import { buildParticles } from '../utils'

const PAPER = '#f4f1e7'
const VW = 320
const VH = 400

type Pt = [number, number]
type Gen = (cx: number, cy: number, R: number) => Pt[]

/* ------------------------------------------------------------------ *
 * Shape generators — each samples a SMOOTH CLOSED curve at 24–32 pts so
 * the joined straight chords read as a curve (no crude polygons). All
 * pure Math, deterministic. Vetted for recognisability + no self-cross.
 * ------------------------------------------------------------------ */
const G = (a: number, b: number, w: number) => Math.exp(-Math.pow(Math.atan2(Math.sin(a - b), Math.cos(a - b)) / w, 2))

const flower: Gen = (cx, cy, R) => {
  const P: Pt[] = []
  for (let i = 0; i < 30; i++) {
    const t = (i / 30) * 2 * Math.PI
    const r = R * (0.72 + 0.26 * Math.cos(6 * t))
    P.push([cx + r * Math.cos(t), cy + r * Math.sin(t)])
  }
  return P
}
const sun: Gen = (cx, cy, R) => {
  const P: Pt[] = []
  for (let i = 0; i < 32; i++) {
    const t = (i / 32) * 2 * Math.PI
    const r = R * (0.82 + 0.18 * Math.cos(12 * t))
    P.push([cx + r * Math.cos(t), cy + r * Math.sin(t)])
  }
  return P
}
const fish: Gen = (cx, cy, R) => {
  const P: Pt[] = []
  const a = 0.72 * R
  const b = 0.46 * R
  for (let i = 0; i < 28; i++) {
    const t = (i / 28) * 2 * Math.PI
    let r = (a * b) / Math.sqrt((b * Math.cos(t)) ** 2 + (a * Math.sin(t)) ** 2)
    r += R * 0.46 * G(t, Math.PI - 0.55, 0.3)
    r += R * 0.46 * G(t, Math.PI + 0.55, 0.3)
    r -= R * 0.4 * G(t, Math.PI, 0.24)
    r += R * 0.08 * G(t, -Math.PI / 2, 0.5)
    P.push([cx + r * Math.cos(t), cy + r * Math.sin(t)])
  }
  return P
}
const butterfly: Gen = (cx, cy, R) => {
  const N = 15
  const right: Pt[] = []
  for (let i = 0; i <= N; i++) {
    const th = -Math.PI / 2 + (i / N) * Math.PI
    const r = R * (0.3 + 0.62 * Math.exp(-Math.pow((th + 0.75) / 0.42, 2)) + 0.5 * Math.exp(-Math.pow((th - 0.85) / 0.55, 2)) - 0.2 * Math.exp(-Math.pow(th / 0.3, 2)))
    right.push([cx + r * Math.cos(th), cy + r * Math.sin(th)])
  }
  const left: Pt[] = []
  for (let i = N - 1; i >= 1; i--) left.push([2 * cx - right[i][0], right[i][1]])
  return right.concat(left)
}
const catface: Gen = (cx, cy, R) => {
  const P: Pt[] = []
  for (let i = 0; i < 28; i++) {
    const t = (i / 28) * 2 * Math.PI
    let r = R * 0.62
    r += R * 0.42 * G(t, -Math.PI / 2 - 0.62, 0.2)
    r += R * 0.42 * G(t, -Math.PI / 2 + 0.62, 0.2)
    r -= R * 0.14 * G(t, -Math.PI / 2, 0.26)
    r += R * 0.06 * G(t, Math.PI / 2, 0.5)
    P.push([cx + r * Math.cos(t), cy + r * Math.sin(t)])
  }
  return P
}
const snail: Gen = (cx, cy, R) => {
  const Sc: Pt = [cx - 4, cy - 34]
  const phiMax = 4 * Math.PI
  const rInner = 0.07 * R
  const pitch = 0.26 * R
  const tube = 0.14 * R
  const rA = (p: number) => rInner + pitch * (p / (2 * Math.PI))
  const base = Math.PI / 2
  const A: Pt[] = []
  const B: Pt[] = []
  for (let i = 0; i <= 13; i++) {
    const p = (phiMax * i) / 13
    const ang = base + p
    const r = rA(p)
    A.push([Sc[0] + r * Math.cos(ang), Sc[1] + r * Math.sin(ang)])
  }
  for (let i = 10; i >= 1; i--) {
    const p = (phiMax * i) / 10
    const ang = base + p
    const r = Math.max(0.03 * R, rA(p) - tube)
    B.push([Sc[0] + r * Math.cos(ang), Sc[1] + r * Math.sin(ang)])
  }
  const foot: Pt[] = [
    [cx + 58, cy + 30], [cx + 90, cy + 42], [cx + 86, cy + 62], [cx + 40, cy + 76],
    [cx - 18, cy + 78], [cx - 72, cy + 70], [cx - 98, cy + 46], [cx - 84, cy + 28],
  ]
  return A.concat(foot, B)
}
// shared bbox-fit for the "math-up" shapes below
const fit = (raw: Pt[], cx: number, cy: number, R: number): Pt[] => {
  const xs = raw.map((p) => p[0])
  const ys = raw.map((p) => p[1])
  const mnX = Math.min(...xs)
  const mxX = Math.max(...xs)
  const mnY = Math.min(...ys)
  const mxY = Math.max(...ys)
  const w = mxX - mnX || 1
  const h = mxY - mnY || 1
  const s = Math.min((2 * R * 0.95) / w, (2 * R * 1.14) / h)
  const ox = (mnX + mxX) / 2
  const oy = (mnY + mxY) / 2
  return raw.map((p) => [cx + (p[0] - ox) * s, cy + (p[1] - oy) * s])
}
const heart: Gen = (cx, cy, R) => {
  const r: Pt[] = []
  for (let i = 0; i < 30; i++) {
    const t = (Math.PI * 2 * i) / 30
    r.push([16 * Math.pow(Math.sin(t), 3), -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))])
  }
  return fit(r, cx, cy, R)
}
const star: Gen = (cx, cy, R) => {
  const r: Pt[] = []
  for (let i = 0; i < 30; i++) {
    const t = (Math.PI * 2 * i) / 30
    const k = 0.6 + 0.4 * Math.cos(5 * t)
    r.push([k * Math.sin(t), -k * Math.cos(t)])
  }
  return fit(r, cx, cy, R)
}
const apple: Gen = (cx, cy, R) => {
  const A = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))
  const r: Pt[] = []
  const g = 0.17
  const M = 24
  for (let i = 0; i <= M; i++) {
    const t = g + ((Math.PI * 2 - 2 * g) * i) / M
    const wd = 1 - 0.06 * Math.cos(2 * t)
    const cl = 0.32 * Math.exp(-Math.pow(A(t, 0) / 0.4, 2))
    const dp = 0.12 * Math.exp(-Math.pow(A(t, Math.PI) / 0.6, 2))
    const k = wd - cl - dp
    r.push([k * Math.sin(t), -k * Math.cos(t)])
  }
  r.push([-0.06, -0.82], [-0.06, -1.16], [0.06, -1.16], [0.06, -0.82])
  return fit(r, cx, cy, R)
}
const sailboat: Gen = (cx, cy, R) => {
  const r: Pt[] = []
  const P = (x: number, y: number) => r.push([x, -y])
  const MB: Pt = [-0.48, 0.22]
  const S: Pt = [-0.48, 1.92]
  const D: Pt = [1.2, 0.26]
  for (let i = 0; i < 4; i++) {
    const u = i / 4
    P(MB[0] + (S[0] - MB[0]) * u, MB[1] + (S[1] - MB[1]) * u)
  }
  for (let i = 0; i <= 6; i++) {
    const u = i / 6
    P(S[0] + (D[0] - S[0]) * u + Math.sin(Math.PI * u) * 0.12, S[1] + (D[1] - S[1]) * u)
  }
  P(1.36, 0.06)
  for (let i = 1; i < 10; i++) {
    const u = i / 10
    const xx = 1.36 - 2.72 * u
    const yy = 0.06 - 0.6 * Math.sqrt(Math.max(0, 1 - Math.pow(xx / 1.36, 2)))
    P(xx, yy)
  }
  P(-1.36, 0.06)
  P(-1.2, 0.22)
  P(-0.84, 0.22)
  return fit(r, cx, cy, R)
}
const balloon: Gen = (cx, cy, R) => {
  const A = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))
  const r: Pt[] = []
  for (let i = 0; i < 28; i++) {
    const t = (Math.PI * 2 * i) / 28
    const d = A(t, Math.PI)
    const xs = 1 - 0.55 * Math.exp(-Math.pow(d / 0.6, 2))
    const yd = 0.3 * Math.exp(-Math.pow(d / 0.5, 2))
    r.push([0.86 * Math.sin(t) * xs, -(Math.cos(t) - yd)])
  }
  return fit(r, cx, cy, R)
}
const rocket: Gen = (cx, cy, R) => {
  const r: Pt[] = []
  const P = (x: number, y: number) => r.push([x, -y])
  const q: Pt[] = [
    [0, 1.92], [0.15, 1.6], [0.28, 1.22], [0.42, 0.85], [0.49, 0.35], [0.49, -0.2],
    [0.45, -0.55], [0.55, -0.62], [0.98, -1], [0.42, -0.95], [0.3, -1.08], [0, -1.22],
  ]
  for (const p of q) P(p[0], p[1])
  for (let i = q.length - 2; i >= 1; i--) P(-q[i][0], q[i][1])
  return fit(r, cx, cy, R)
}

interface Puzzle {
  id: string
  name: string
  color: string
  dots: Pt[]
  path: string // smooth closed reveal path
}

/** uniform-fit the raw points into a safe area so every shape fills the frame */
function normalize(pts: Pt[], W: number, H: number, cx: number, cy: number): Pt[] {
  let mnx = Infinity
  let mny = Infinity
  let mxx = -Infinity
  let mxy = -Infinity
  for (const [x, y] of pts) {
    mnx = Math.min(mnx, x)
    mny = Math.min(mny, y)
    mxx = Math.max(mxx, x)
    mxy = Math.max(mxy, y)
  }
  const w = mxx - mnx || 1
  const h = mxy - mny || 1
  const s = Math.min(W / w, H / h)
  const ox = (mnx + mxx) / 2
  const oy = (mny + mxy) / 2
  return pts.map(([x, y]) => [cx + (x - ox) * s, cy + (y - oy) * s])
}

/** Resample a closed polyline to N points evenly spaced BY ARC LENGTH, so dots
 * never bunch up where the parametric curve turns sharply (cusps, petals). */
function resample(pts: Pt[], N: number): Pt[] {
  const n = pts.length
  const cum = [0]
  for (let i = 0; i < n; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % n]
    cum.push(cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1]))
  }
  const total = cum[n] || 1
  const out: Pt[] = []
  let si = 0
  for (let k = 0; k < N; k++) {
    const t = (k / N) * total
    while (si < n - 1 && cum[si + 1] < t) si++
    const segLen = cum[si + 1] - cum[si] || 1
    const f = (t - cum[si]) / segLen
    const a = pts[si]
    const b = pts[(si + 1) % n]
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f])
  }
  return out
}

/** Catmull-Rom through the points → smooth closed cubic-bezier path */
function smoothPath(pts: Pt[]): string {
  const n = pts.length
  if (n < 3) return ''
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)} `
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += `C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)} `
  }
  return d + 'Z'
}

function build(id: string, name: string, color: string, gen: Gen, dotCount = 24): Puzzle {
  const raw = normalize(gen(0, 0, 100), 232, 300, VW / 2, VH / 2)
  const dots = resample(raw, dotCount) // evenly spaced → no bunching at cusps
  return { id, name, color, dots, path: smoothPath(dots) }
}

const PUZZLES: Puzzle[] = [
  build('heart', 'Heart', '#ff2e7e', heart),
  build('flower', 'Flower', '#ff2e7e', flower),
  build('butterfly', 'Butterfly', '#00a58a', butterfly),
  build('catface', 'Cat', '#ffb800', catface),
  build('fish', 'Fish', '#0a5af5', fish),
  build('sun', 'Sun', '#ffb800', sun),
  build('star', 'Star', '#ffb800', star),
  build('apple', 'Apple', '#00a58a', apple),
  build('snail', 'Snail', '#0a5af5', snail),
  build('sailboat', 'Boat', '#0a5af5', sailboat),
  build('balloon', 'Balloon', '#ff2e7e', balloon),
  build('rocket', 'Rocket', '#00a58a', rocket),
]

/* ------------------------------------------------------------------ *
 * SVG import → dots. Sample the LONGEST geometry in an uploaded SVG at
 * even arc-length, fit it into the frame, and auto-place numbered dots.
 * Element transforms are ignored (fine for flat line-art exports) —
 * normalize() re-centres and scales, so absolute position never matters.
 * ------------------------------------------------------------------ */
function svgToPoints(svgText: string, dense = 400): Pt[] | null {
  try {
    const clean = svgText.replace(/<\?xml[\s\S]*?\?>/i, '').replace(/<!DOCTYPE[\s\S]*?>/i, '')
    const holder = document.createElement('div')
    holder.setAttribute('style', 'position:absolute;left:-9999px;top:0;width:1px;height:1px;overflow:hidden')
    holder.innerHTML = clean
    const svg = holder.querySelector('svg')
    if (!svg) return null
    document.body.appendChild(holder)
    const geoms = svg.querySelectorAll('path,polygon,polyline,ellipse,circle,rect,line')
    let best: SVGGeometryElement | null = null
    let bestLen = 0
    for (let i = 0; i < geoms.length; i++) {
      const g = geoms[i] as SVGGeometryElement
      let len = 0
      try {
        len = g.getTotalLength()
      } catch {
        len = 0
      }
      if (len > bestLen) {
        bestLen = len
        best = g
      }
    }
    let pts: Pt[] | null = null
    if (best && bestLen > 1) {
      const g = best
      pts = []
      for (let i = 0; i < dense; i++) {
        const p = g.getPointAtLength((i / dense) * bestLen)
        pts.push([p.x, p.y])
      }
    }
    document.body.removeChild(holder)
    return pts
  } catch {
    return null
  }
}

const SVG_COLORS = ['#ff2e7e', '#0a5af5', '#00a58a', '#ffb800']
/** A faithful reveal path straight from the sampled outline — a dense polyline
 * that keeps every leg, ear and tail (unlike smoothing a handful of dots). */
function densePath(pts: Pt[]): string {
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 1; i < pts.length; i++) d += ` L ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`
  return d + ' Z'
}
/** Turn a bundled SVG drawing into a joinable puzzle. */
function svgToPuzzle(svgText: string, name: string, id: string): Puzzle | null {
  const raw = svgToPoints(svgText)
  if (!raw || raw.length < 12) return null
  const fitted = normalize(raw, 244, 320, VW / 2, VH / 2)
  // dot count scales with how detailed the outline is (its perimeter), with a
  // higher ceiling so a real drawing (legs, ears, tail) stays recognisable
  let per = 0
  for (let i = 0; i < fitted.length; i++) {
    const a = fitted[i]
    const b = fitted[(i + 1) % fitted.length]
    per += Math.hypot(b[0] - a[0], b[1] - a[1])
  }
  const count = Math.max(20, Math.min(46, Math.round(per / 42)))
  const dots = resample(fitted, count)
  // the REVEAL is the real outline (dense), not a smoothed few-dot blob
  const color = SVG_COLORS[Math.abs([...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7)) % SVG_COLORS.length]
  return { id, name: name || 'Yours', color, dots, path: densePath(fitted) }
}

const centroid = (pts: Pt[]): Pt => {
  let x = 0
  let y = 0
  for (const p of pts) {
    x += p[0]
    y += p[1]
  }
  return [x / pts.length, y / pts.length]
}

const chip: CSSProperties = {
  fontFamily: fonts.display,
  fontWeight: 600,
  fontSize: 15,
  letterSpacing: '-.005em',
  color: c.ink,
  background: c.card,
  border: 'none',
  borderRadius: 14,
  padding: '0 16px',
  height: 44,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  boxShadow: shadows.dropSm,
  cursor: 'pointer',
}

/** Small silhouette teaser drawn on each picker card. */
function Preview({ p, spot }: { p: Puzzle; spot: string }) {
  const marks = [0, 1, 2, 3, 4].map((k) => p.dots[Math.floor((k / 5) * p.dots.length)])
  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: '100%', height: '100%', display: 'block' }}>
      <path d={p.path} fill={p.color} opacity={0.16} />
      <path d={p.path} fill="none" stroke={c.ink} strokeOpacity={0.4} strokeWidth={2.5} strokeDasharray="6 5" />
      {marks.map((m, i) => (
        <g key={i}>
          <circle cx={m[0]} cy={m[1]} r={6} fill="#fff" stroke={c.ink} strokeWidth={2} />
          <text x={m[0]} y={m[1] + 3.5} textAnchor="middle" fontFamily={fonts.body} fontWeight={800} fontSize={9} fill={spot === '' ? c.hint : c.hint}>
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  )
}

export function DotToDot() {
  const { go, play, showToast, startFinish, reducedMotion, state } = useGame()
  // dot-to-dot is powered by bundled SVG drawings (public/dots/, dotSvgs.ts);
  // the parametric shapes are only a fallback if none load.
  const [svgPuz, setSvgPuz] = useState<Puzzle[]>([])
  const ALL = svgPuz.length ? svgPuz : PUZZLES
  const [view, setView] = useState<'pick' | 'play'>('pick')
  const [puzIdx, setPuzIdx] = useState(0)
  const [n, setN] = useState(0)
  const [wrong, setWrong] = useState(0)

  // load the bundled SVGs → puzzles, then resume any half-joined shape by id
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const loaded: Puzzle[] = []
      for (const s of DOT_SVGS) {
        try {
          const res = await fetch(s.src)
          if (!res.ok) continue
          const puz = svgToPuzzle(await res.text(), s.name, s.id)
          if (puz) loaded.push(puz)
        } catch {
          /* skip a drawing that fails to load */
        }
      }
      if (cancelled) return
      if (loaded.length) setSvgPuz(loaded)
      const list = loaded.length ? loaded : PUZZLES
      const d = loadDraft<{ id: string; n: number }>('dot')
      if (d && d.n > 0) {
        const i = list.findIndex((p) => p.id === d.id)
        if (i >= 0) {
          setPuzIdx(i)
          setN(Math.min(d.n, list[i].dots.length))
          setView('play')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const puz = ALL[Math.min(puzIdx, ALL.length - 1)] ?? ALL[0]
  const N = puz.dots.length
  const done = n >= N
  const [ctrx, ctry] = centroid(puz.dots)

  const open = (i: number) => {
    setPuzIdx(i)
    setN(0)
    setWrong(0)
    setView('play')
    saveDraft('dot', { id: ALL[i].id, n: 0 })
    play('page')
  }

  /** Every connect climbs the ladder — dot 1 sits low, each dot rings one
   * step higher across two octaves, and the last dot detonates the climax. */
  const connectSound = (nn: number) => {
    if (nn >= N) {
      play('climax')
      showToast('joined — lovely!')
    } else {
      play('step', 0.75 * Math.pow(2, ((nn - 1) / Math.max(1, N - 1)) * 2))
    }
  }

  const tap = (i: number) => {
    if (done) return
    if (i < n) return // already joined (often via the same touch's sweep)
    if (i === n) {
      const nn = n + 1
      setN(nn)
      setWrong(0)
      saveDraft('dot', { id: puz.id, n: nn })
      connectSound(nn)
    } else {
      play('wrong')
      setWrong((w) => w + 1)
    }
  }

  const undo = () => {
    if (n === 0) return
    const nn = n - 1
    setN(nn)
    setWrong(0)
    saveDraft('dot', { id: puz.id, n: nn })
    play('select')
  }

  // ---- draw-the-line: drag the finger and dots connect as you sweep ----
  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)
  const nRef = useRef(n)
  nRef.current = n
  const [finger, setFinger] = useState<Pt | null>(null)
  const toView = (e: { clientX: number; clientY: number }): Pt => {
    const svg = svgRef.current
    if (!svg) return [0, 0]
    const r = svg.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * VW, ((e.clientY - r.top) / r.height) * VH]
  }
  /** connect every not-yet-joined dot the finger sweeps close to, in order */
  const sweep = (p: Pt) => {
    let nn = nRef.current
    let connected = 0
    while (nn < N && Math.hypot(puz.dots[nn][0] - p[0], puz.dots[nn][1] - p[1]) < 22) {
      nn++
      connected++
    }
    if (!connected) return
    setN(nn)
    setWrong(0)
    saveDraft('dot', { id: puz.id, n: nn })
    connectSound(nn)
  }
  const onDown = (e: RPE<SVGSVGElement>) => {
    if (done) return
    dragging.current = true
    const p = toView(e)
    setFinger(p)
    sweep(p)
  }
  const onMove = (e: RPE<SVGSVGElement>) => {
    if (!dragging.current || done) return
    const p = toView(e)
    setFinger(p)
    sweep(p)
  }
  const onUp = () => {
    dragging.current = false
    setFinger(null)
  }

  const keep = () => {
    if (!done) {
      showToast('join every dot first!')
      return
    }
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${VW} ${VH}'><rect width='${VW}' height='${VH}' fill='${PAPER}'/><path d='${puz.path}' fill='${puz.color}' stroke='${c.ink}' stroke-width='4' stroke-linejoin='round'/></svg>`
    const url = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
    clearDraft('dot')
    setView('pick') // primed for "make another" when the ritual clears
    startFinish({ type: 'dot', title: puz.name, img: url, tint: puz.color })
  }

  // ---------- PICKER ----------
  if (view === 'pick') {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px' }}>
          <IconButton onClick={() => go('home')} ariaLabel="back" size={52} style={{ fontFamily: fonts.display, fontSize: 26 }}>
            ‹
          </IconButton>
          <div>
            <div style={{ fontFamily: fonts.display, fontSize: 24, fontWeight: 550, letterSpacing: '-.015em', lineHeight: 1.1, color: c.ink }}>Dot to dot</div>
            <div style={{ fontFamily: fonts.body, fontWeight: 500, fontSize: 13, color: c.hint, marginTop: 3 }}>pick something to join</div>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '4px 16px calc(24px + env(safe-area-inset-bottom))' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {ALL.map((p, i) => {
              const spot = [c.pink, c.blue, c.yellow, c.teal][i % 4]
              return (
                <button
                  key={p.id}
                  onClick={() => open(i)}
                  style={{ position: 'relative', textAlign: 'left', background: c.card, border: 'none', borderRadius: 18, boxShadow: shadows.card, padding: 8, cursor: 'pointer' }}
                >
                  <div style={{ position: 'relative', aspectRatio: '4 / 5', background: PAPER, borderRadius: 12, overflow: 'hidden', border: 'none', boxShadow: `inset 0 0 0 1px ${c.line}` }}>
                    <Preview p={p} spot={spot} />
                    <span style={{ position: 'absolute', top: 6, left: 6, background: c.card, border: 'none', borderRadius: 999, padding: '2px 8px', boxShadow: shadows.dropSm, fontFamily: fonts.body, fontWeight: 600, fontSize: 10, letterSpacing: '.07em', textTransform: 'uppercase', color: c.faint }}>
                      {p.dots.length} dots
                    </span>
                  </div>
                  <div style={{ fontFamily: fonts.display, fontSize: 15, fontWeight: 550, letterSpacing: '-.01em', textAlign: 'center', marginTop: 8, color: c.ink }}>{p.name}</div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ---------- PLAY ----------
  const joined = puz.dots.slice(0, n)
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px' }}>
        <button onClick={() => setView('pick')} style={chip} aria-label="back to shapes">
          <span style={{ fontFamily: fonts.display, fontSize: 18, marginRight: 2 }}>‹</span> Shapes
        </button>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'center', fontFamily: fonts.display, fontWeight: 550, letterSpacing: '-.01em', color: c.ink, fontSize: 'clamp(13px, 4.2vw, 20px)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{puz.name}</div>
        <IconButton onClick={undo} ariaLabel="undo last dot" size={44} style={{ fontFamily: fonts.display, fontSize: 20 }}>
          ↶
        </IconButton>
        <IconButton onClick={() => { setN(0); setWrong(0); saveDraft('dot', { id: puz.id, n: 0 }); play('page') }} ariaLabel="reset" size={44} style={{ fontFamily: fonts.display, fontSize: 20 }}>
          ⟲
        </IconButton>
        <button
          onClick={keep}
          aria-disabled={!done}
          style={{ ...chip, background: done ? c.ink : c.disabled, color: done ? c.card : c.hint, boxShadow: done ? shadows.drop : 'none', animation: done ? 'popin .5s ease-out' : undefined }}
        >
          Keep ✓
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ position: 'relative', background: c.card, border: 'none', borderRadius: 20, boxShadow: shadows.dropLg, padding: 8 }}>
          <div style={{ width: 'min(420px, 88vw)', aspectRatio: `${VW} / ${VH}`, borderRadius: 13, overflow: 'hidden', background: PAPER, boxShadow: `inset 0 0 0 1px ${c.line}`, touchAction: 'none', animation: done ? 'wobble .8s ease-in-out 1s' : undefined }}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${VW} ${VH}`}
              style={{ width: '100%', height: '100%', display: 'block' }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerLeave={onUp}
            >
              {done && (
                // the reveal: the outline draws itself, then the colour blooms in
                <path
                  d={puz.path}
                  pathLength={1}
                  fill={puz.color}
                  stroke={c.ink}
                  strokeWidth={4}
                  strokeLinejoin="round"
                  style={{ strokeDasharray: 1, animation: 'drawPath .9s ease-out both, fillIn .55s ease-out .8s both' }}
                />
              )}
              {!done && joined.length >= 2 && (
                <polyline points={joined.map((p) => p.join(',')).join(' ')} fill="none" stroke={puz.color} strokeWidth={3.5} strokeLinejoin="round" strokeLinecap="round" />
              )}
              {/* live rubber line from the last joined dot to the finger */}
              {!done && finger && n > 0 && (
                <line x1={puz.dots[n - 1][0]} y1={puz.dots[n - 1][1]} x2={finger[0]} y2={finger[1]} stroke={puz.color} strokeWidth={3} strokeDasharray="5 5" strokeLinecap="round" opacity={0.7} />
              )}
              {!done &&
                puz.dots.map((p, i) => {
                  const isNext = i === n
                  const isJoined = i < n
                  const cen: Pt = [ctrx, ctry]
                  const dx = p[0] - cen[0]
                  const dy = p[1] - cen[1]
                  const dl = Math.hypot(dx, dy) || 1
                  const lx = p[0] + (dx / dl) * 12
                  const ly = p[1] + (dy / dl) * 12 + 3.5
                  return (
                    <g key={i}>
                      {isNext && <circle cx={p[0]} cy={p[1]} r={8} fill={puz.color} opacity={0.5} style={{ transformOrigin: `${p[0]}px ${p[1]}px`, animation: 'ping 1s ease-out infinite' }} />}
                      <circle cx={p[0]} cy={p[1]} r={isNext ? 7.5 : 5} fill={isJoined ? c.ink : isNext ? puz.color : '#fff'} stroke={c.ink} strokeWidth={isNext ? 2.5 : 2} />
                      {!isJoined && (
                        <text
                          x={lx}
                          y={ly}
                          textAnchor="middle"
                          fontFamily={fonts.body}
                          fontWeight={800}
                          fontSize={isNext ? (wrong >= 2 ? 20 : 12) : 10}
                          fill={isNext ? c.ink : c.hint}
                          style={{ paintOrder: 'stroke', stroke: PAPER, strokeWidth: 3, strokeLinejoin: 'round', pointerEvents: 'none' }}
                        >
                          {i + 1}
                        </text>
                      )}
                      {/* forgiving transparent hit target */}
                      <circle cx={p[0]} cy={p[1]} r={isNext ? 23 : 12} fill="transparent" role="button" aria-label={`dot ${i + 1}`} style={{ cursor: 'pointer' }} onClick={() => tap(i)} />
                    </g>
                  )
                })}
            </svg>
          </div>
          {done && (
            <div style={{ position: 'absolute', inset: 8, pointerEvents: 'none', overflow: 'hidden', borderRadius: 13 }}>
              <div style={{ position: 'absolute', top: 0, bottom: 0, width: 70, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.85),transparent)', animation: 'shim 1.1s ease-out 1s' }} />
              {buildParticles(reducedMotion || state.calm).map((p, i) => (
                <span
                  key={i}
                  style={
                    {
                      position: 'absolute',
                      left: '50%',
                      top: '48%',
                      width: 8,
                      height: 12,
                      borderRadius: 2,
                      background: p.c,
                      '--tx': `${p.tx}px`,
                      '--ty': `${p.ty}px`,
                      animation: `${reducedMotion || state.calm ? 'conf' : 'fw'} ${p.d}s ease-out ${0.9 + p.delay}s both`,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', padding: '4px 16px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 'min(260px, 72vw)' }}>
          <div style={{ flex: 1, height: 8, background: c.toggleOff, borderRadius: 999, overflow: 'hidden', border: 'none' }}>
            <div style={{ width: `${(n / N) * 100}%`, height: '100%', background: c.ink, borderRadius: 999, transition: 'width .2s' }} />
          </div>
        </div>
        <div style={{ fontFamily: fonts.body, fontWeight: 500, fontSize: 13, color: c.hint }}>
          {done ? 'done — press keep! ✨' : n === 0 ? 'start at dot 1' : `join dot ${n + 1} of ${N}`}
        </div>
      </div>
    </div>
  )
}
