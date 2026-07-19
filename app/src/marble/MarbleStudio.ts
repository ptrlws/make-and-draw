import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { INKS, c as tokens } from '../theme'
import type { Sound } from '../types'

/* ------------------------------------------------------------------ *
 * MarbleStudio — the real marbling engine, framework-agnostic.
 *
 *  • A GPU closed-form ebru fluid on a ping-pong RGBA8 field (crisp,
 *    no diffusion). Tap = area-preserving ink drop; drag = comb/swirl.
 *  • A "dip" that lifts a real 3D object out of the tray wearing the
 *    marble (triplanar-projected + lit + wet sheen), on a darkened
 *    spotlight backdrop — the collectible reveal.
 *  • Render-on-demand for the tray; a short RAF loop only during the
 *    3D reveal (for the slow collectible spin).
 *
 * Driven imperatively from React via a canvas ref.
 * ------------------------------------------------------------------ */

// Dip objects are all real STL models now (see marble/models.ts + user import);
// no procedural geometry.

const hex = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
const PAPER = hex(tokens.paper)
const INK_RGB = INKS.map((i) => hex(i.c))

export type Op =
  | { k: 'drop'; x: number; y: number; r: number; ci: number }
  | {
      k: 'stroke'
      x: number
      y: number
      dx: number
      dy: number
      amp: number
      sigma: number
      comb: number
      /** rake/comb tools drag several evenly-spaced tines at once */
      tines?: number
      space?: number
    }

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`

// ---------- 3D object geometry (procedural, normalized to ~unit) ----------
function normalize(geo: THREE.BufferGeometry, fit = 1.7): THREE.BufferGeometry {
  geo.computeBoundingBox()
  const b = geo.boundingBox!
  geo.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -(b.min.z + b.max.z) / 2)
  const s = fit / Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z)
  geo.scale(s, s, s)
  return geo
}
/** Neutral placeholder — never shown in the tray; used for the initial mesh
 * and as a fallback for an id whose STL model hasn't registered yet. */
const fallbackGeometry = () => normalize(new THREE.IcosahedronGeometry(1, 1))

export class MarbleStudio {
  private canvas: HTMLCanvasElement
  private renderer: THREE.WebGLRenderer
  private W: number
  private H: number
  private read: THREE.WebGLRenderTarget
  private write: THREE.WebGLRenderTarget
  private simMat: THREE.ShaderMaterial
  private dispMat: THREE.ShaderMaterial
  private objMat: THREE.ShaderMaterial
  private orthoCam: THREE.OrthographicCamera
  private simScene: THREE.Scene
  private dispScene: THREE.Scene
  private scene3d: THREE.Scene
  private cam3d: THREE.PerspectiveCamera
  private mesh: THREE.Mesh
  private geoCache = new Map<string, THREE.BufferGeometry>()
  private shadow!: THREE.Mesh
  private shadowMat!: THREE.MeshBasicMaterial
  private drips: THREE.Mesh[] = []
  private baseOps: Op[] = []

  private ink = 0
  private tool = 0 // 0 stylus · 1 wide rake · 2 fine comb
  private mode: 'tray' | 'object' = 'tray'
  private dim = 1
  private raf = 0
  private spinning = false
  private disposed = false

  private gestures: Op[][] = []
  private current: Op[] | null = null
  private downId: number | null = null
  private moved = false
  private last: [number, number] = [0, 0]

  // hold-to-grow ink blooms: the stone spreads while the finger stays down
  private holdTimer = 0
  private holdR = 0
  private holdCount = 0

  // drag-to-rotate the finished collectible
  private userRotating = false
  private userRotated = false
  private rotLast: [number, number] = [0, 0]

  // feel: foley hook + reduced-motion, wired from React
  onSound?: (s: Sound, pitch?: number) => void
  private reduced = false
  private lastSwirlAt = 0

  private DROP_R: number
  private SW: number
  private CW: number
  private MAXSTEP: number

  onReveal?: () => void

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    renderer.setPixelRatio(dpr)
    const rect = canvas.getBoundingClientRect()
    renderer.setSize(rect.width, rect.height, false)
    this.renderer = renderer
    this.W = Math.max(2, Math.round(rect.width * dpr))
    this.H = Math.max(2, Math.round(rect.height * dpr))

    this.DROP_R = this.W * 0.045
    this.SW = this.W * 0.07
    this.CW = this.W * 0.12
    this.MAXSTEP = this.W * 0.04

    const opts: THREE.RenderTargetOptions = {
      type: THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
    }
    this.read = new THREE.WebGLRenderTarget(this.W, this.H, opts)
    this.write = new THREE.WebGLRenderTarget(this.W, this.H, opts)

    const quad = new THREE.PlaneGeometry(2, 2)
    this.orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    this.simMat = new THREE.ShaderMaterial({
      uniforms: {
        uPrev: { value: null },
        uMode: { value: 0 },
        uRes: { value: new THREE.Vector2(this.W, this.H) },
        uPaper: { value: new THREE.Vector3(...PAPER) },
        uColor: { value: new THREE.Vector3(...INK_RGB[0]) },
        uCenter: { value: new THREE.Vector2() },
        uRadius: { value: 10 },
        uPoint: { value: new THREE.Vector2() },
        uDir: { value: new THREE.Vector2(1, 0) },
        uAmp: { value: 0 },
        uSigma: { value: 40 },
        uComb: { value: 0 },
        uTines: { value: 1 },
        uSpace: { value: 0 },
      },
      vertexShader: VERT,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D uPrev; uniform int uMode, uComb, uTines;
        uniform vec2 uRes, uCenter, uPoint, uDir;
        uniform vec3 uPaper, uColor;
        uniform float uRadius, uAmp, uSigma, uSpace;
        void main(){
          vec2 P = vUv * uRes; vec3 col;
          if (uMode == 0) { col = uPaper; }
          else if (uMode == 1) {
            vec2 d = P - uCenter; float R2 = dot(d,d); float r = uRadius;
            if (R2 <= r*r) col = uColor;
            else { float R = sqrt(R2); col = texture2D(uPrev, (uCenter + d*(sqrt(max(R2-r*r,0.0))/R))/uRes).rgb; }
          } else {
            vec2 rel = P - uPoint; float dist;
            if (uComb >= 1){
              // a rake drags uTines evenly-spaced tines: distance to the NEAREST
              // tine line makes one pull feather the whole tray (gelgit/nonpareil)
              vec2 nrm = vec2(-uDir.y, uDir.x);
              float perp = dot(rel, nrm);
              if (uTines > 1) {
                float halfW = uSpace * float(uTines - 1) * 0.5;
                float snapped = clamp(uSpace * floor(perp / uSpace + 0.5), -halfW, halfW);
                dist = abs(perp - snapped);
              } else {
                dist = abs(perp);
              }
            } else dist = length(rel);
            col = texture2D(uPrev, (P - uDir*(uAmp*exp(-(dist*dist)/(2.0*uSigma*uSigma))))/uRes).rgb;
          }
          gl_FragColor = vec4(col,1.0);
        }
      `,
    })

    this.dispMat = new THREE.ShaderMaterial({
      uniforms: {
        uField: { value: null },
        uRes: { value: new THREE.Vector2(this.W, this.H) },
        uGrain: { value: 0.04 },
        uDim: { value: 1 },
      },
      vertexShader: VERT,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D uField; uniform vec2 uRes; uniform float uGrain, uDim;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
        void main(){
          vec3 c = texture2D(uField, vUv).rgb;
          c += (hash(floor(vUv*uRes)) - 0.5) * uGrain;
          c *= uDim;
          float vig = smoothstep(1.05, 0.26, length(vUv-0.5)*1.35);
          c *= mix(1.0, vig, 1.0 - uDim);
          gl_FragColor = vec4(c,1.0);
        }
      `,
    })

    this.simScene = new THREE.Scene()
    this.simScene.add(new THREE.Mesh(quad, this.simMat))
    this.dispScene = new THREE.Scene()
    this.dispScene.add(new THREE.Mesh(quad, this.dispMat))

    // 3D collectible
    this.scene3d = new THREE.Scene()
    this.cam3d = new THREE.PerspectiveCamera(38, rect.width / Math.max(1, rect.height), 0.1, 100)
    this.cam3d.position.set(0, 0, 4.2)
    this.cam3d.lookAt(0, 0, 0)
    this.objMat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: {
        uMarble: { value: null },
        uWet: { value: 1 },
        uProj: { value: 0.42 },
      },
      vertexShader: `
        varying vec3 vLp; varying vec3 vLn; varying vec3 vWn;
        void main(){
          vLp = position; vLn = normal;
          vWn = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vLp; varying vec3 vLn; varying vec3 vWn;
        uniform sampler2D uMarble; uniform float uWet, uProj;
        vec3 tri(vec3 p, vec3 n){
          vec3 b = abs(normalize(n)); b /= (b.x + b.y + b.z);
          vec3 cx = texture2D(uMarble, p.zy * uProj + 0.5).rgb;
          vec3 cy = texture2D(uMarble, p.xz * uProj + 0.5).rgb;
          vec3 cz = texture2D(uMarble, p.xy * uProj + 0.5).rgb;
          return cx*b.x + cy*b.y + cz*b.z;
        }
        void main(){
          vec3 marble = tri(vLp, vLn);
          vec3 N = normalize(vWn);
          vec3 V = vec3(0.0, 0.0, 1.0);
          vec3 L = normalize(vec3(-0.4, 0.82, 0.6));
          vec3 H = normalize(L + V);
          // wrap diffuse — soft key light, no hard terminator
          float diff = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0);
          // hemisphere ambient: cool from below, warm from above
          float hemi = N.y * 0.5 + 0.5;
          vec3 amb = mix(vec3(0.32, 0.31, 0.37), vec3(0.64, 0.62, 0.56), hemi);
          vec3 base = marble * (amb + diff * 0.72);
          // clearcoat glaze — tighter & brighter while the ink is still wet
          float gloss = 0.5 + 0.5 * uWet;
          float spec = pow(clamp(dot(N, H), 0.0, 1.0), mix(28.0, 88.0, uWet));
          float sheen = pow(clamp(dot(N, H), 0.0, 1.0), 8.0) * 0.16;
          float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
          vec3 col = base + spec * gloss + sheen
                   + fres * mix(vec3(0.1, 0.12, 0.18), vec3(0.5, 0.55, 0.72), uWet);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
    this.mesh = new THREE.Mesh(this.geo('egg'), this.objMat)
    this.scene3d.add(this.mesh)

    // soft contact shadow that grounds the collectible
    const sc = document.createElement('canvas')
    sc.width = sc.height = 128
    const sx = sc.getContext('2d')!
    const grd = sx.createRadialGradient(64, 64, 4, 64, 64, 60)
    grd.addColorStop(0, 'rgba(0,0,0,.55)')
    grd.addColorStop(1, 'rgba(0,0,0,0)')
    sx.fillStyle = grd
    sx.fillRect(0, 0, 128, 128)
    this.shadowMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, opacity: 0, depthWrite: false })
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.1), this.shadowMat)
    this.shadow.position.set(0, -1.25, -0.3)
    this.scene3d.add(this.shadow)

    // ink drips that run off as the object lifts out
    const dripGeo = new THREE.SphereGeometry(0.07, 12, 10)
    for (let i = 0; i < 5; i++) {
      const d = new THREE.Mesh(dripGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(INKS[i % INKS.length].c), transparent: true }))
      d.visible = false
      this.drips.push(d)
      this.scene3d.add(d)
    }

    this.attach()
    this.clearField() // start on EMPTY water — the child builds the marble
    this.render()
  }

  private geo(id: string): THREE.BufferGeometry {
    let g = this.geoCache.get(id)
    if (!g) {
      // no procedural objects — an id whose STL hasn't registered yet gets a
      // neutral placeholder (never actually shown in the tray)
      g = fallbackGeometry()
      this.geoCache.set(id, g)
    }
    return g
  }

  /** Register an externally-supplied geometry (e.g. an imported STL) under an
   * id; it's re-centred, scaled to fit, welded + re-normalled for clean lighting. */
  registerGeometry(id: string, geo: THREE.BufferGeometry) {
    let g = geo.index ? geo : mergeVertices(geo)
    g.rotateX(-Math.PI / 2) // STL/print models are usually Z-up → stand them Y-up
    g = normalize(g, 1.85)
    g.computeVertexNormals()
    this.geoCache.get(id)?.dispose()
    this.geoCache.set(id, g)
  }

  // ---------- passes ----------
  private pass(setup: () => void) {
    setup()
    this.simMat.uniforms.uPrev.value = this.read.texture
    this.renderer.setRenderTarget(this.write)
    this.renderer.render(this.simScene, this.orthoCam)
    const t = this.read
    this.read = this.write
    this.write = t
  }
  private clearField() {
    this.pass(() => (this.simMat.uniforms.uMode.value = 0))
  }
  private applyOp(op: Op) {
    if (op.k === 'drop') {
      this.pass(() => {
        this.simMat.uniforms.uMode.value = 1
        this.simMat.uniforms.uCenter.value.set(op.x, op.y)
        this.simMat.uniforms.uRadius.value = op.r
        this.simMat.uniforms.uColor.value.set(...INK_RGB[op.ci])
      })
    } else {
      this.pass(() => {
        this.simMat.uniforms.uMode.value = 2
        this.simMat.uniforms.uPoint.value.set(op.x, op.y)
        this.simMat.uniforms.uDir.value.set(op.dx, op.dy)
        this.simMat.uniforms.uAmp.value = op.amp
        this.simMat.uniforms.uSigma.value = op.sigma
        this.simMat.uniforms.uComb.value = op.comb
        this.simMat.uniforms.uTines.value = op.tines ?? 1
        this.simMat.uniforms.uSpace.value = op.space ?? 0
      })
    }
  }

  private render() {
    if (this.disposed) return
    this.renderer.setRenderTarget(null)
    this.dispMat.uniforms.uField.value = this.read.texture
    this.dispMat.uniforms.uDim.value = this.mode === 'object' ? this.dim : 1
    this.renderer.autoClear = true
    this.renderer.setClearColor(0x000000, 1)
    this.renderer.clear()
    this.renderer.render(this.dispScene, this.orthoCam)
    if (this.mode === 'object') {
      this.renderer.autoClear = false
      this.renderer.clearDepth()
      this.renderer.render(this.scene3d, this.cam3d)
      this.renderer.autoClear = true
    }
  }

  // ---------- pointer ----------
  private toField(e: PointerEvent): [number, number] {
    const r = this.canvas.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * this.W, (1 - (e.clientY - r.top) / r.height) * this.H]
  }
  private onDown = (e: PointerEvent) => {
    e.preventDefault()
    try {
      this.canvas.setPointerCapture(e.pointerId)
    } catch {
      /* capture optional */
    }
    this.downId = e.pointerId
    if (this.mode === 'object') {
      this.userRotating = true
      this.userRotated = true
      this.rotLast = [e.clientX, e.clientY]
      return
    }
    this.moved = false
    this.current = []
    this.last = this.toField(e)

    // one drop of ink hits the water the INSTANT the finger touches, then
    // keeps spreading while held. It's a single solid stone of the chosen
    // ink — the fluid's area-preserving displacement pushes whatever is
    // already floating out into rings, so real marbling emerges as you layer
    // colours and swirl (no fake bullseye).
    const [x, y] = this.last
    const lay = (r: number) => {
      const op: Op = { k: 'drop', x, y, r, ci: this.ink }
      this.current!.push(op)
      this.applyOp(op)
    }
    this.holdR = this.DROP_R
    lay(this.holdR)
    this.render()
    this.onSound?.('drip', 1 + Math.random() * 0.15)
    this.holdCount = 0
    clearInterval(this.holdTimer)
    this.holdTimer = window.setInterval(() => {
      if (this.moved || this.downId === null || this.mode !== 'tray' || !this.current) {
        clearInterval(this.holdTimer)
        return
      }
      this.holdCount++
      this.holdR = Math.min(this.DROP_R * 3.1, this.holdR * 1.2)
      lay(this.holdR) // the same stone spreads wider — pushing prior ink outward
      this.render()
      // the plop deepens as the stone grows
      this.onSound?.('drip', Math.max(0.5, 0.95 - this.holdCount * 0.06))
      if (this.holdR >= this.DROP_R * 3.05) clearInterval(this.holdTimer)
    }, 190)
  }
  private onMove = (e: PointerEvent) => {
    if (this.downId === null) return
    if (this.mode === 'object') {
      if (!this.userRotating) return
      const dx = e.clientX - this.rotLast[0]
      const dy = e.clientY - this.rotLast[1]
      this.rotLast = [e.clientX, e.clientY]
      this.mesh.rotation.y += dx * 0.012
      this.mesh.rotation.x = Math.max(-1.1, Math.min(1.1, this.mesh.rotation.x + dy * 0.012))
      this.render()
      return
    }
    const p = this.toField(e)
    const dx = p[0] - this.last[0]
    const dy = p[1] - this.last[1]
    const d = Math.hypot(dx, dy)
    if (d < 1.5) return
    this.moved = true
    const t2 = this.toolParams()
    const op: Op = {
      k: 'stroke',
      x: p[0],
      y: p[1],
      dx: dx / d,
      dy: dy / d,
      amp: Math.min(d, this.MAXSTEP),
      sigma: t2.sigma,
      comb: t2.comb,
      tines: t2.tines,
      space: t2.space,
    }
    this.current!.push(op)
    this.applyOp(op)
    this.render()
    this.last = p
    // throttled swirl foley, pitch tracking finger speed
    const t = performance.now()
    if (t - this.lastSwirlAt > 80) {
      this.lastSwirlAt = t
      this.onSound?.('swirl', 0.85 + Math.min(0.6, d / this.MAXSTEP) * 0.7)
    }
  }
  private onUp = () => {
    if (this.downId === null) {
      return
    }
    if (this.mode === 'object') {
      this.userRotating = false
      this.downId = null
      return
    }
    if (this.mode === 'tray') {
      // the bloom (and any swirl after it) is already applied — just commit
      // it as one undoable gesture
      clearInterval(this.holdTimer)
      if (this.current && this.current.length) {
        this.gestures.push(this.current)
        this.onOps?.()
      }
    }
    this.current = null
    this.downId = null
  }
  private attach() {
    this.canvas.addEventListener('pointerdown', this.onDown)
    this.canvas.addEventListener('pointermove', this.onMove)
    this.canvas.addEventListener('pointerup', this.onUp)
    this.canvas.addEventListener('pointercancel', this.onUp)
  }

  // ---------- public API ----------
  setInk(i: number) {
    this.ink = i
  }
  /** 0 stylus (free swirl) · 1 wide rake (5 tines) · 2 fine comb (12 tines) */
  setTool(i: number) {
    this.tool = i
  }
  private toolParams() {
    if (this.tool === 1) return { comb: 1, tines: 5, space: this.CW * 0.95, sigma: this.SW * 0.5 }
    if (this.tool === 2) return { comb: 1, tines: 12, space: this.CW * 0.4, sigma: this.SW * 0.3 }
    return { comb: 0, tines: 1, space: 0, sigma: this.SW }
  }
  private rebuild() {
    this.clearField()
    for (const op of this.baseOps) this.applyOp(op)
    for (const g of this.gestures) for (const op of g) this.applyOp(op)
  }
  undo() {
    if (this.mode !== 'tray' || !this.gestures.length) return
    this.gestures.pop()
    this.rebuild()
    this.render()
    this.onOps?.()
  }
  reset() {
    this.gestures = []
    this.rebuild()
    this.render()
    this.onOps?.()
  }

  /** Fires after any change to the child's gesture log (for draft saving). */
  onOps?: () => void

  /** The child's gestures, normalized by field width — a device-portable draft. */
  exportGestures(): Op[][] {
    const s = 1 / this.W
    return this.gestures.map((g) =>
      g.map((op) =>
        op.k === 'drop'
          ? { ...op, x: op.x * s, y: op.y * s, r: op.r * s }
          : { ...op, x: op.x * s, y: op.y * s, amp: op.amp * s, sigma: op.sigma * s, ...(op.space ? { space: op.space * s } : {}) },
      ),
    )
  }

  /** Replace the gesture log with a normalized draft and replay it. */
  importGestures(gs: Op[][]) {
    const s = this.W
    this.gestures = gs.map((g) =>
      g.map((op) =>
        op.k === 'drop'
          ? { ...op, x: op.x * s, y: op.y * s, r: op.r * s }
          : { ...op, x: op.x * s, y: op.y * s, amp: op.amp * s, sigma: op.sigma * s, ...(op.space ? { space: op.space * s } : {}) },
      ),
    )
    this.rebuild()
    this.render()
  }

  setReduced(v: boolean) {
    this.reduced = v
  }

  /** Lift the chosen object out of the tray as a marbled collectible. */
  dip(id: string) {
    this.mesh.geometry = this.geo(id)
    this.objMat.uniforms.uMarble.value = this.read.texture
    this.mode = 'object'
    this.dim = 1
    this.mesh.rotation.set(0, 0, 0)
    this.userRotating = false
    this.userRotated = false
    cancelAnimationFrame(this.raf)

    // Reduced-motion / calm: no rise, no spin, no drips — settle straight to a
    // static darkened hero pose and reveal at once (Apple's criteria name
    // spinning + multi-axis motion as effects that must stop).
    if (this.reduced) {
      this.spinning = false
      this.mesh.position.y = 0
      this.mesh.rotation.set(0.15, -0.5, 0)
      this.objMat.uniforms.uWet.value = 0.4
      this.dim = 0.42
      this.shadowMat.opacity = 0.48
      for (const d of this.drips) d.visible = false
      this.render()
      this.onReveal?.()
      return
    }

    this.spinning = true
    this.onSound?.('lift')
    const t0 = performance.now()
    const RISE = 1150
    const DARK = 550
    let revealed = false
    const easeOut = (v: number) => 1 - Math.pow(1 - v, 3)
    const step = () => {
      if (this.disposed) return
      const t = performance.now() - t0
      const rise = easeOut(Math.min(1, t / RISE))
      this.mesh.position.y = -3.2 * (1 - rise) + Math.sin(performance.now() / 700) * 0.008
      this.objMat.uniforms.uWet.value = t < RISE ? 1 : Math.max(0.3, 1 - (t - RISE) / 900)
      this.dim = t < RISE ? 1 : Math.max(0.3, 1 - (t - RISE) / DARK)
      // gentle showcase rock until the user grabs it to orbit freely
      if (t > RISE && !this.userRotating && !this.userRotated) {
        const s = performance.now()
        this.mesh.rotation.y = Math.sin(s / 1500) * 0.42
        this.mesh.rotation.x = Math.sin(s / 2300) * 0.06 - 0.02
      }
      this.shadowMat.opacity = 0.48 * rise
      for (let i = 0; i < this.drips.length; i++) {
        const d = this.drips[i]
        const dp = rise * 1.5 - 0.14 * i
        if (t < RISE && dp > 0 && dp < 1) {
          d.visible = true
          d.position.set((i - 2) * 0.24, 0.35 - dp * 2.4, 0.25)
          d.scale.setScalar(1 - dp * 0.45)
          ;(d.material as THREE.MeshBasicMaterial).opacity = 1 - dp
        } else {
          d.visible = false
        }
      }
      this.render()
      if (!revealed && t > RISE + DARK) {
        revealed = true
        this.onReveal?.()
      }
      if (this.spinning) this.raf = requestAnimationFrame(step)
    }
    this.raf = requestAnimationFrame(step)
  }

  backToTray() {
    this.spinning = false
    cancelAnimationFrame(this.raf)
    this.mode = 'tray'
    this.dim = 1
    this.shadowMat.opacity = 0
    for (const d of this.drips) d.visible = false
    this.render()
  }

  /** PNG of the marbled paper itself — the tray painting is the artwork. */
  snapshotTray(): string {
    this.render()
    return this.canvas.toDataURL('image/png')
  }

  /** PNG of the current collectible on a transparent ground (for the gallery). */
  snapshotCollectible(): string {
    // capture just the object on a transparent ground (no shadow/drips)
    const shadowVis = this.shadow.visible
    this.shadow.visible = false
    for (const d of this.drips) d.visible = false
    // If the child hasn't posed it themselves, use a canonical front-3/4 hero
    // angle so the saved thumbnail is never a random spin frame (or a blank back).
    const rx = this.mesh.rotation.x
    const ry = this.mesh.rotation.y
    const rz = this.mesh.rotation.z
    if (!this.userRotated) this.mesh.rotation.set(0.16, -0.5, 0)
    this.renderer.setRenderTarget(null)
    this.renderer.autoClear = true
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.clear()
    this.renderer.render(this.scene3d, this.cam3d)
    const url = this.canvas.toDataURL('image/png')
    this.mesh.rotation.set(rx, ry, rz)
    this.shadow.visible = shadowVis
    this.render() // restore the live view
    return url
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect()
    if (rect.width < 2 || rect.height < 2) return
    this.renderer.setSize(rect.width, rect.height, false)
    this.cam3d.aspect = rect.width / rect.height
    this.cam3d.updateProjectionMatrix()
    this.render()
  }

  dispose() {
    this.disposed = true
    this.spinning = false
    cancelAnimationFrame(this.raf)
    clearInterval(this.holdTimer)
    this.canvas.removeEventListener('pointerdown', this.onDown)
    this.canvas.removeEventListener('pointermove', this.onMove)
    this.canvas.removeEventListener('pointerup', this.onUp)
    this.canvas.removeEventListener('pointercancel', this.onUp)
    this.read.dispose()
    this.write.dispose()
    this.geoCache.forEach((g) => g.dispose())
    this.renderer.dispose()
  }
}
