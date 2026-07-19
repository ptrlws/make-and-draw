/* ------------------------------------------------------------------ *
 * Source images for the paint-by-numbers generator. Each is drawn
 * procedurally to a small offscreen canvas (bold shapes + gradients),
 * then quantized + faceted by pbn.ts into a numbered SVG print. Smooth
 * gradients posterize into many bands → real paint-by-numbers density.
 * ------------------------------------------------------------------ */

export interface PbnSource {
  id: string
  name: string
  /** suggested generator settings */
  colors: number
  render: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
}

function vgrad(ctx: CanvasRenderingContext2D, w: number, h: number, stops: [number, string][], x = 0, y0 = 0, y1 = h) {
  const g = ctx.createLinearGradient(x, y0, x, y1)
  for (const [o, c] of stops) g.addColorStop(o, c)
  ctx.fillStyle = g
  ctx.fillRect(0, y0, w, y1 - y0)
}

function hill(ctx: CanvasRenderingContext2D, w: number, h: number, base: number, amp: number, phase: number, fill: string) {
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.moveTo(0, h)
  ctx.lineTo(0, base)
  for (let x = 0; x <= w; x += 4) ctx.lineTo(x, base + Math.sin(x / w * Math.PI * 2 + phase) * amp)
  ctx.lineTo(w, h)
  ctx.closePath()
  ctx.fill()
}

const sunset: PbnSource = {
  id: 'sunset',
  name: 'Mountains',
  colors: 14,
  render: (ctx, w, h) => {
    vgrad(ctx, w, h, [[0, '#3b2e7e'], [0.35, '#c0417f'], [0.62, '#ff7a4d'], [0.8, '#ffc857']], 0, 0, h * 0.66)
    // sun
    const sx = w * 0.5
    const sy = h * 0.42
    const sg = ctx.createRadialGradient(sx, sy, 2, sx, sy, w * 0.26)
    sg.addColorStop(0, '#fff2b0')
    sg.addColorStop(0.5, '#ffd23f')
    sg.addColorStop(1, '#ff8a3d')
    ctx.fillStyle = sg
    ctx.beginPath()
    ctx.arc(sx, sy, w * 0.19, 0, 7)
    ctx.fill()
    // layered hills
    hill(ctx, w, h, h * 0.6, h * 0.05, 0.6, '#7a3b6e')
    hill(ctx, w, h, h * 0.66, h * 0.045, 2.1, '#5a2b62')
    // water
    vgrad(ctx, w, h, [[0, '#b0417f'], [0.5, '#7a3b8e'], [1, '#3b2e7e']], 0, h * 0.72, h)
    ctx.fillStyle = 'rgba(255,210,63,0.55)'
    ctx.fillRect(sx - w * 0.05, h * 0.72, w * 0.1, h * 0.28)
    hill(ctx, w, h, h * 0.74, h * 0.02, 1.0, '#2a2060')
  },
}

const toucan: PbnSource = {
  id: 'toucan',
  name: 'Toucan',
  colors: 12,
  render: (ctx, w, h) => {
    vgrad(ctx, w, h, [[0, '#2f9e6f'], [0.6, '#3fb98a'], [1, '#7fd0a8']])
    // leaves
    ctx.fillStyle = '#1f7d55'
    for (const [lx, ly, r] of [[w * 0.14, h * 0.2, w * 0.22], [w * 0.86, h * 0.72, w * 0.26], [w * 0.9, h * 0.18, w * 0.18]] as const) {
      ctx.beginPath()
      ctx.ellipse(lx, ly, r, r * 0.5, Math.PI / 4, 0, 7)
      ctx.fill()
    }
    // branch
    ctx.strokeStyle = '#6b4a2b'
    ctx.lineWidth = w * 0.05
    ctx.beginPath()
    ctx.moveTo(0, h * 0.9)
    ctx.lineTo(w * 0.7, h * 0.82)
    ctx.stroke()
    // body
    ctx.fillStyle = '#16130f'
    ctx.beginPath()
    ctx.ellipse(w * 0.46, h * 0.55, w * 0.24, h * 0.26, 0, 0, 7)
    ctx.fill()
    // belly
    ctx.fillStyle = '#fff3d6'
    ctx.beginPath()
    ctx.ellipse(w * 0.4, h * 0.5, w * 0.13, h * 0.14, 0, 0, 7)
    ctx.fill()
    // beak
    ctx.fillStyle = '#ff8a1e'
    ctx.beginPath()
    ctx.moveTo(w * 0.5, h * 0.38)
    ctx.quadraticCurveTo(w * 0.95, h * 0.36, w * 0.86, h * 0.5)
    ctx.quadraticCurveTo(w * 0.7, h * 0.52, w * 0.52, h * 0.48)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#e23b2e'
    ctx.beginPath()
    ctx.moveTo(w * 0.78, h * 0.44)
    ctx.quadraticCurveTo(w * 0.9, h * 0.44, w * 0.86, h * 0.5)
    ctx.quadraticCurveTo(w * 0.8, h * 0.5, w * 0.78, h * 0.44)
    ctx.fill()
    // eye
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(w * 0.5, h * 0.36, w * 0.055, 0, 7)
    ctx.fill()
    ctx.fillStyle = '#16130f'
    ctx.beginPath()
    ctx.arc(w * 0.51, h * 0.36, w * 0.028, 0, 7)
    ctx.fill()
  },
}

const koi: PbnSource = {
  id: 'koi',
  name: 'Koi pond',
  colors: 12,
  render: (ctx, w, h) => {
    const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 4, w * 0.5, h * 0.5, w * 0.8)
    g.addColorStop(0, '#2ec5c5')
    g.addColorStop(0.6, '#0f8fb8')
    g.addColorStop(1, '#0a4f8c')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    // lily pads
    ctx.fillStyle = '#2f9e5f'
    for (const [lx, ly, r] of [[w * 0.2, h * 0.18, w * 0.16], [w * 0.82, h * 0.28, w * 0.13], [w * 0.75, h * 0.85, w * 0.17]] as const) {
      ctx.beginPath()
      ctx.arc(lx, ly, r, 0.5, Math.PI * 2)
      ctx.fill()
    }
    const fish = (fx: number, fy: number, rot: number, col: string) => {
      ctx.save()
      ctx.translate(fx, fy)
      ctx.rotate(rot)
      ctx.fillStyle = col
      ctx.beginPath()
      ctx.ellipse(0, 0, w * 0.2, w * 0.11, 0, 0, 7)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(w * 0.16, 0)
      ctx.lineTo(w * 0.3, -w * 0.1)
      ctx.lineTo(w * 0.3, w * 0.1)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.ellipse(-w * 0.06, -w * 0.01, w * 0.06, w * 0.05, 0, 0, 7)
      ctx.fill()
      ctx.restore()
    }
    fish(w * 0.42, h * 0.42, -0.4, '#ff6a1a')
    fish(w * 0.6, h * 0.66, 2.6, '#ffb02e')
  },
}

const balloon: PbnSource = {
  id: 'balloon',
  name: 'Balloon',
  colors: 13,
  render: (ctx, w, h) => {
    vgrad(ctx, w, h, [[0, '#7fd0ff'], [0.7, '#bfe8ff'], [1, '#e9f7ff']])
    // clouds
    ctx.fillStyle = '#ffffff'
    for (const [cx, cy] of [[w * 0.2, h * 0.2], [w * 0.82, h * 0.34]] as const) {
      for (const dx of [-1, 0, 1]) {
        ctx.beginPath()
        ctx.arc(cx + dx * w * 0.07, cy, w * 0.06, 0, 7)
        ctx.fill()
      }
    }
    // balloon envelope with colour panels
    const bx = w * 0.5
    const by = h * 0.42
    const R = w * 0.32
    const cols = ['#ff2e7e', '#ffb800', '#00a58a', '#0a5af5', '#ff7a1a', '#8f3ac0']
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = cols[i]
      ctx.beginPath()
      ctx.moveTo(bx, by)
      ctx.arc(bx, by, R, (i / 6) * Math.PI * 2 - Math.PI / 2, ((i + 1) / 6) * Math.PI * 2 - Math.PI / 2)
      ctx.closePath()
      ctx.fill()
    }
    // taper bottom
    ctx.fillStyle = '#ff2e7e'
    ctx.beginPath()
    ctx.moveTo(bx - R * 0.5, by + R * 0.8)
    ctx.lineTo(bx + R * 0.5, by + R * 0.8)
    ctx.lineTo(bx, by + R * 1.15)
    ctx.closePath()
    ctx.fill()
    // basket + ropes
    ctx.strokeStyle = '#6b4a2b'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(bx - R * 0.3, by + R * 1.1)
    ctx.lineTo(bx - w * 0.05, h * 0.82)
    ctx.moveTo(bx + R * 0.3, by + R * 1.1)
    ctx.lineTo(bx + w * 0.05, h * 0.82)
    ctx.stroke()
    ctx.fillStyle = '#8a5a2b'
    ctx.fillRect(bx - w * 0.06, h * 0.82, w * 0.12, h * 0.08)
  },
}

const bloom: PbnSource = {
  id: 'bloom',
  name: 'Bloom',
  colors: 12,
  render: (ctx, w, h) => {
    const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 4, w * 0.5, h * 0.5, w * 0.75)
    g.addColorStop(0, '#fff0c2')
    g.addColorStop(1, '#00a58a')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    const cx = w * 0.5
    const cy = h * 0.5
    const petalCols = ['#ff2e7e', '#ff6aa6']
    for (let ring = 0; ring < 2; ring++) {
      const n = 8
      const rad = ring === 0 ? w * 0.32 : w * 0.2
      const pr = ring === 0 ? w * 0.14 : w * 0.1
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + ring * 0.4
        ctx.save()
        ctx.translate(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad)
        ctx.rotate(a)
        ctx.fillStyle = petalCols[ring]
        ctx.beginPath()
        ctx.ellipse(0, 0, pr, pr * 0.5, 0, 0, 7)
        ctx.fill()
        ctx.restore()
      }
    }
    const cg = ctx.createRadialGradient(cx, cy, 2, cx, cy, w * 0.16)
    cg.addColorStop(0, '#ffe066')
    cg.addColorStop(1, '#ff8a1e')
    ctx.fillStyle = cg
    ctx.beginPath()
    ctx.arc(cx, cy, w * 0.15, 0, 7)
    ctx.fill()
  },
}

const cat: PbnSource = {
  id: 'cat',
  name: 'Cat',
  colors: 12,
  render: (ctx, w, h) => {
    vgrad(ctx, w, h, [[0, '#0a5f8c'], [1, '#2ec5c5']])
    ctx.fillStyle = '#ffe066'
    ctx.beginPath()
    ctx.arc(w * 0.79, h * 0.19, w * 0.13, 0, 7)
    ctx.fill()
    // tail
    ctx.strokeStyle = '#ff8a1e'
    ctx.lineWidth = w * 0.09
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(w * 0.72, h * 0.74)
    ctx.quadraticCurveTo(w * 0.94, h * 0.62, w * 0.86, h * 0.42)
    ctx.stroke()
    // body
    ctx.fillStyle = '#ff8a1e'
    ctx.beginPath()
    ctx.ellipse(w * 0.5, h * 0.68, w * 0.26, h * 0.22, 0, 0, 7)
    ctx.fill()
    ctx.fillStyle = '#fff3d6'
    ctx.beginPath()
    ctx.ellipse(w * 0.5, h * 0.72, w * 0.13, h * 0.14, 0, 0, 7)
    ctx.fill()
    // ears
    ctx.fillStyle = '#ff8a1e'
    for (const s of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(w * (0.5 + s * 0.14), h * 0.32)
      ctx.lineTo(w * (0.5 + s * 0.24), h * 0.15)
      ctx.lineTo(w * (0.5 + s * 0.02), h * 0.26)
      ctx.closePath()
      ctx.fill()
    }
    ctx.fillStyle = '#ff4f81'
    for (const s of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(w * (0.5 + s * 0.13), h * 0.29)
      ctx.lineTo(w * (0.5 + s * 0.19), h * 0.19)
      ctx.lineTo(w * (0.5 + s * 0.06), h * 0.25)
      ctx.closePath()
      ctx.fill()
    }
    // head
    ctx.fillStyle = '#ffa040'
    ctx.beginPath()
    ctx.arc(w * 0.5, h * 0.44, w * 0.2, 0, 7)
    ctx.fill()
    // eyes + nose
    ctx.fillStyle = '#16130f'
    ctx.beginPath()
    ctx.arc(w * 0.43, h * 0.43, w * 0.03, 0, 7)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(w * 0.57, h * 0.43, w * 0.03, 0, 7)
    ctx.fill()
    ctx.fillStyle = '#ff4f81'
    ctx.beginPath()
    ctx.moveTo(w * 0.47, h * 0.5)
    ctx.lineTo(w * 0.53, h * 0.5)
    ctx.lineTo(w * 0.5, h * 0.54)
    ctx.closePath()
    ctx.fill()
  },
}

const whale: PbnSource = {
  id: 'whale',
  name: 'Whale',
  colors: 11,
  render: (ctx, w, h) => {
    vgrad(ctx, w, h, [[0, '#bfeaff'], [0.44, '#7fd0ff'], [0.44, '#1f8fd0'], [1, '#0a5290']])
    ctx.fillStyle = '#ffd23f'
    ctx.beginPath()
    ctx.arc(w * 0.8, h * 0.16, w * 0.1, 0, 7)
    ctx.fill()
    // body
    ctx.fillStyle = '#3a5fd0'
    ctx.beginPath()
    ctx.ellipse(w * 0.46, h * 0.63, w * 0.3, h * 0.2, 0, 0, 7)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(w * 0.72, h * 0.63)
    ctx.lineTo(w * 0.96, h * 0.48)
    ctx.lineTo(w * 0.93, h * 0.76)
    ctx.closePath()
    ctx.fill()
    // belly
    ctx.fillStyle = '#cfe4ff'
    ctx.beginPath()
    ctx.ellipse(w * 0.42, h * 0.73, w * 0.2, h * 0.09, 0, 0, 7)
    ctx.fill()
    // eye
    ctx.fillStyle = '#16130f'
    ctx.beginPath()
    ctx.arc(w * 0.26, h * 0.59, w * 0.03, 0, 7)
    ctx.fill()
    // spout
    ctx.strokeStyle = '#eaf7ff'
    ctx.lineWidth = w * 0.03
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(w * 0.3, h * 0.45)
    ctx.quadraticCurveTo(w * 0.25, h * 0.3, w * 0.34, h * 0.27)
    ctx.stroke()
  },
}

const rocket: PbnSource = {
  id: 'rocket',
  name: 'Rocket',
  colors: 12,
  render: (ctx, w, h) => {
    vgrad(ctx, w, h, [[0, '#10143a'], [1, '#3a2f7e']])
    ctx.fillStyle = '#ffe066'
    for (const [sx, sy, r] of [[w * 0.2, h * 0.15, w * 0.022], [w * 0.82, h * 0.1, w * 0.026], [w * 0.72, h * 0.34, w * 0.016], [w * 0.14, h * 0.5, w * 0.02], [w * 0.86, h * 0.56, w * 0.02]] as const) {
      ctx.beginPath()
      ctx.arc(sx, sy, r, 0, 7)
      ctx.fill()
    }
    // flame
    ctx.fillStyle = '#ff8a1e'
    ctx.beginPath()
    ctx.moveTo(w * 0.42, h * 0.78)
    ctx.lineTo(w * 0.58, h * 0.78)
    ctx.lineTo(w * 0.5, h * 0.97)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#ffd23f'
    ctx.beginPath()
    ctx.moveTo(w * 0.45, h * 0.78)
    ctx.lineTo(w * 0.55, h * 0.78)
    ctx.lineTo(w * 0.5, h * 0.9)
    ctx.closePath()
    ctx.fill()
    // body
    ctx.fillStyle = '#f2eee2'
    ctx.beginPath()
    ctx.moveTo(w * 0.5, h * 0.12)
    ctx.quadraticCurveTo(w * 0.68, h * 0.4, w * 0.62, h * 0.78)
    ctx.lineTo(w * 0.38, h * 0.78)
    ctx.quadraticCurveTo(w * 0.32, h * 0.4, w * 0.5, h * 0.12)
    ctx.fill()
    // nose
    ctx.fillStyle = '#ff2e7e'
    ctx.beginPath()
    ctx.moveTo(w * 0.5, h * 0.12)
    ctx.quadraticCurveTo(w * 0.61, h * 0.28, w * 0.6, h * 0.36)
    ctx.lineTo(w * 0.4, h * 0.36)
    ctx.quadraticCurveTo(w * 0.39, h * 0.28, w * 0.5, h * 0.12)
    ctx.fill()
    // fins
    ctx.fillStyle = '#ff2e7e'
    ctx.beginPath()
    ctx.moveTo(w * 0.38, h * 0.6)
    ctx.lineTo(w * 0.25, h * 0.82)
    ctx.lineTo(w * 0.4, h * 0.76)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(w * 0.62, h * 0.6)
    ctx.lineTo(w * 0.75, h * 0.82)
    ctx.lineTo(w * 0.6, h * 0.76)
    ctx.closePath()
    ctx.fill()
    // window
    ctx.fillStyle = '#0a5af5'
    ctx.beginPath()
    ctx.arc(w * 0.5, h * 0.48, w * 0.09, 0, 7)
    ctx.fill()
    ctx.fillStyle = '#9fdcff'
    ctx.beginPath()
    ctx.arc(w * 0.5, h * 0.48, w * 0.05, 0, 7)
    ctx.fill()
  },
}

const rainbow: PbnSource = {
  id: 'rainbow',
  name: 'Rainbow',
  colors: 12,
  render: (ctx, w, h) => {
    vgrad(ctx, w, h, [[0, '#bfe8ff'], [1, '#eaf7ff']])
    const cx = w * 0.5
    const cy = h * 1.02
    const cols = ['#ff2e7e', '#ff7a1a', '#ffb800', '#00a58a', '#0a5af5', '#8f3ac0']
    for (let i = 0; i < cols.length; i++) {
      ctx.fillStyle = cols[i]
      ctx.beginPath()
      ctx.arc(cx, cy, w * (0.82 - i * 0.1), 0, 7)
      ctx.fill()
    }
    ctx.fillStyle = '#d6efff'
    ctx.beginPath()
    ctx.arc(cx, cy, w * 0.22, 0, 7)
    ctx.fill()
    ctx.fillStyle = '#3fb98a'
    ctx.fillRect(0, h * 0.86, w, h * 0.14)
    ctx.fillStyle = '#ffffff'
    for (const [ccx, ccy] of [[w * 0.17, h * 0.5], [w * 0.85, h * 0.42]] as const) {
      for (const dx of [-1, 0, 1]) {
        ctx.beginPath()
        ctx.arc(ccx + dx * w * 0.07, ccy, w * 0.06, 0, 7)
        ctx.fill()
      }
    }
  },
}

export const PBN_SOURCES: PbnSource[] = [toucan, cat, whale, koi, rocket, balloon, sunset, rainbow, bloom]

/** Render a source to ImageData at the generator's working resolution. */
export function rasterize(src: PbnSource, w: number, h: number): ImageData {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const ctx = cv.getContext('2d', { willReadFrequently: true })!
  src.render(ctx, w, h)
  return ctx.getImageData(0, 0, w, h)
}

/* ------------------------------------------------------------------ *
 * Photo pre-pass — clean an uploaded image before faceting: adjust
 * brightness/contrast, then an EDGE-AWARE (bilateral) smooth that
 * flattens noise/JPEG grain while keeping colour edges crisp, so
 * quantization yields tidy facets instead of speckle.
 * ------------------------------------------------------------------ */

export interface RGBAImage {
  data: Uint8ClampedArray
  width: number
  height: number
}

/** Edge-preserving median despeckle. radius in px (1→3×3, 2→5×5); new buffer.
 * Median removes photo grain / JPEG speckle while keeping colour edges sharp,
 * and is monotonic — more radius = cleaner (fewer stray facets). */
function medianSmooth(src: RGBAImage, radius: number): Uint8ClampedArray {
  const { data: d, width: w, height: h } = src
  const out = new Uint8ClampedArray(d.length)
  const n = (2 * radius + 1) * (2 * radius + 1)
  const half = n >> 1
  const win = new Uint8Array(n)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const oi = (y * w + x) * 4
      for (let c = 0; c < 3; c++) {
        let m = 0
        for (let dy = -radius; dy <= radius; dy++) {
          const ny = Math.min(h - 1, Math.max(0, y + dy))
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = Math.min(w - 1, Math.max(0, x + dx))
            win[m++] = d[(ny * w + nx) * 4 + c]
          }
        }
        for (let a = 1; a < n; a++) {
          const v = win[a]
          let b = a - 1
          while (b >= 0 && win[b] > v) {
            win[b + 1] = win[b]
            b--
          }
          win[b + 1] = v
        }
        out[oi + c] = win[half]
      }
      out[oi + 3] = 255
    }
  }
  return out
}

/** brightness (-255..255), contrast (0.5..1.5), then optional median despeckle. */
export function preprocess(src: RGBAImage, o: { brightness: number; contrast: number; smooth: number }): RGBAImage {
  const w = src.width
  const h = src.height
  const d = src.data
  const adj = new Uint8ClampedArray(d.length)
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) adj[i + c] = (d[i + c] - 128) * o.contrast + 128 + o.brightness
    adj[i + 3] = 255
  }
  const data = o.smooth > 0 ? medianSmooth({ data: adj, width: w, height: h }, o.smooth) : adj
  return { data, width: w, height: h }
}
