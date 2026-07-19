import * as THREE from 'three'

// author colours in plain sRGB hex and show them 1:1 (no gamma surprises)
THREE.ColorManagement.enabled = false

const hex = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

const PAPER = hex('#f4f1e7')
const INKS = [
  { name: 'Pink', hex: '#ff2e7e' },
  { name: 'Blue', hex: '#0a5af5' },
  { name: 'Yellow', hex: '#ffb800' },
  { name: 'Teal', hex: '#00a58a' },
  { name: 'Ink', hex: '#16130f' },
].map((i) => ({ ...i, c: hex(i.hex) }))

// ---------- renderer + fluid ping-pong ----------
const canvas = document.getElementById('gl') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
renderer.outputColorSpace = THREE.LinearSRGBColorSpace
renderer.setClearColor(0x000000, 0)
const dpr = Math.min(window.devicePixelRatio || 1, 2)
renderer.setPixelRatio(dpr)
const rect = canvas.getBoundingClientRect()
renderer.setSize(rect.width, rect.height, false)
const simW = Math.max(2, Math.round(rect.width * dpr))
const simH = Math.max(2, Math.round(rect.height * dpr))

const rtOpts: THREE.RenderTargetOptions = {
  type: THREE.UnsignedByteType,
  format: THREE.RGBAFormat,
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  wrapS: THREE.ClampToEdgeWrapping,
  wrapT: THREE.ClampToEdgeWrapping,
  depthBuffer: false,
  stencilBuffer: false,
}
let read = new THREE.WebGLRenderTarget(simW, simH, rtOpts)
let write = new THREE.WebGLRenderTarget(simW, simH, rtOpts)

const quad = new THREE.PlaneGeometry(2, 2)
const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`

const simMat = new THREE.ShaderMaterial({
  uniforms: {
    uPrev: { value: null as THREE.Texture | null },
    uMode: { value: 0 },
    uRes: { value: new THREE.Vector2(simW, simH) },
    uPaper: { value: new THREE.Vector3(...PAPER) },
    uColor: { value: new THREE.Vector3(...INKS[0].c) },
    uCenter: { value: new THREE.Vector2() },
    uRadius: { value: 10 },
    uPoint: { value: new THREE.Vector2() },
    uDir: { value: new THREE.Vector2(1, 0) },
    uAmp: { value: 0 },
    uSigma: { value: 40 },
    uComb: { value: 0 },
  },
  vertexShader: VERT,
  fragmentShader: `
    varying vec2 vUv;
    uniform sampler2D uPrev;
    uniform int uMode;
    uniform vec2 uRes, uCenter, uPoint, uDir;
    uniform vec3 uPaper, uColor;
    uniform float uRadius, uAmp, uSigma;
    uniform int uComb;
    void main(){
      vec2 P = vUv * uRes;
      vec3 col;
      if (uMode == 0) { col = uPaper; }
      else if (uMode == 1) {
        vec2 d = P - uCenter; float R2 = dot(d, d); float r = uRadius;
        if (R2 <= r*r) { col = uColor; }
        else { float R = sqrt(R2); float sR = sqrt(max(R2 - r*r, 0.0)); col = texture2D(uPrev, (uCenter + d*(sR/R))/uRes).rgb; }
      } else {
        vec2 rel = P - uPoint; float dist;
        if (uComb == 1) { float al = dot(rel, uDir); dist = length(rel - al*uDir); } else { dist = length(rel); }
        float amp = uAmp * exp(-(dist*dist)/(2.0*uSigma*uSigma));
        col = texture2D(uPrev, (P - uDir*amp)/uRes).rgb;
      }
      gl_FragColor = vec4(col, 1.0);
    }
  `,
})

// tray display (marble + grain), dimmable for the collectible reveal
const dispMat = new THREE.ShaderMaterial({
  uniforms: {
    uField: { value: null as THREE.Texture | null },
    uRes: { value: new THREE.Vector2(simW, simH) },
    uGrain: { value: 0.045 },
    uDim: { value: 1 },
  },
  vertexShader: VERT,
  fragmentShader: `
    varying vec2 vUv;
    uniform sampler2D uField;
    uniform vec2 uRes;
    uniform float uGrain, uDim;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec3 c = texture2D(uField, vUv).rgb;
      c += (hash(floor(vUv * uRes)) - 0.5) * uGrain;
      c *= uDim;
      float vig = smoothstep(1.05, 0.28, length(vUv - 0.5) * 1.35);   // spotlight when dimmed
      c *= mix(1.0, vig, 1.0 - uDim);
      gl_FragColor = vec4(c, 1.0);
    }
  `,
})

const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
const simScene = new THREE.Scene()
simScene.add(new THREE.Mesh(quad, simMat))
const dispScene = new THREE.Scene()
dispScene.add(new THREE.Mesh(quad, dispMat))

// ---------- 3D collectible scene ----------
const scene3d = new THREE.Scene()
const cam3d = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
cam3d.position.set(0, 0, 4.2)
cam3d.lookAt(0, 0, 0)

// egg = squashed sphere; triplanar-project the marble onto it + simple wet shading
const obj3dMat = new THREE.ShaderMaterial({
  uniforms: {
    uMarble: { value: null as THREE.Texture | null },
    uWet: { value: 1 },
    uProj: { value: 0.34 },
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
      vec3 L = normalize(vec3(-0.45, 0.72, 0.55));
      vec3 V = vec3(0.0, 0.0, 1.0);
      vec3 H = normalize(L + V);
      float diff = clamp(dot(N, L), 0.0, 1.0);
      float shade = 0.5 + 0.55 * diff;
      float spec = pow(clamp(dot(N, H), 0.0, 1.0), 42.0);
      float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.6);
      vec3 col = marble * shade + spec * (0.35 + 0.6 * uWet) + rim * 0.05;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
})

const eggGeo = new THREE.SphereGeometry(1, 72, 72)
const egg = new THREE.Mesh(eggGeo, obj3dMat)
egg.scale.set(0.92, 1.16, 0.92)
scene3d.add(egg)

// ---------- passes ----------
function pass(setup: () => void) {
  setup()
  simMat.uniforms.uPrev.value = read.texture
  renderer.setRenderTarget(write)
  renderer.render(simScene, orthoCam)
  const t = read
  read = write
  write = t
}
const clearField = () => pass(() => (simMat.uniforms.uMode.value = 0))
function drop(x: number, y: number, r: number, col: [number, number, number]) {
  pass(() => {
    simMat.uniforms.uMode.value = 1
    simMat.uniforms.uCenter.value.set(x, y)
    simMat.uniforms.uRadius.value = r
    simMat.uniforms.uColor.value.set(...col)
  })
}
function stroke(x: number, y: number, dx: number, dy: number, amp: number, sigma: number, comb: number) {
  pass(() => {
    simMat.uniforms.uMode.value = 2
    simMat.uniforms.uPoint.value.set(x, y)
    simMat.uniforms.uDir.value.set(dx, dy)
    simMat.uniforms.uAmp.value = amp
    simMat.uniforms.uSigma.value = sigma
    simMat.uniforms.uComb.value = comb
  })
}

let mode: 'tray' | 'object' = 'tray'
let dim = 1
function render() {
  renderer.setRenderTarget(null)
  dispMat.uniforms.uField.value = read.texture
  dispMat.uniforms.uDim.value = mode === 'object' ? dim : 1
  renderer.autoClear = true
  renderer.render(dispScene, orthoCam)
  if (mode === 'object') {
    renderer.autoClear = false
    renderer.clearDepth()
    renderer.render(scene3d, cam3d)
    renderer.autoClear = true
  }
}

// ---------- interaction (tray only) ----------
let ink = 0
let comb = false
const DROP_R = simW * 0.045
const SW = simW * 0.07
const CW = simW * 0.12
const MAXSTEP = simW * 0.04
const toField = (e: PointerEvent): [number, number] => {
  const r = canvas.getBoundingClientRect()
  return [((e.clientX - r.left) / r.width) * simW, (1 - (e.clientY - r.top) / r.height) * simH]
}
let downId: number | null = null
let moved = false
let last: [number, number] = [0, 0]
canvas.addEventListener('pointerdown', (e) => {
  if (mode !== 'tray') return
  e.preventDefault()
  canvas.setPointerCapture(e.pointerId)
  downId = e.pointerId
  moved = false
  last = toField(e)
})
canvas.addEventListener('pointermove', (e) => {
  if (downId === null || mode !== 'tray') return
  const p = toField(e)
  const dx = p[0] - last[0]
  const dy = p[1] - last[1]
  const d = Math.hypot(dx, dy)
  if (d < 1.5) return
  moved = true
  stroke(p[0], p[1], dx / d, dy / d, Math.min(d, MAXSTEP), comb ? CW : SW, comb ? 1 : 0)
  render()
  last = p
})
canvas.addEventListener('pointerup', () => {
  if (downId !== null && !moved && mode === 'tray') {
    drop(last[0], last[1], DROP_R, INKS[ink].c)
    render()
  }
  downId = null
})

// ---------- seed ----------
function seed() {
  clearField()
  const stones: [number, number, number[]][] = [
    [0.3, 0.68, [0, 2, 4]], [0.63, 0.72, [1, 0, 3]], [0.76, 0.46, [2, 1, 4]],
    [0.4, 0.42, [3, 4, 0]], [0.56, 0.3, [0, 1, 2]], [0.26, 0.34, [1, 3, 0]],
  ]
  for (const [nx, ny, cols] of stones) {
    const cx = nx * simW, cy = ny * simH
    drop(cx, cy, DROP_R * 1.55, INKS[cols[0]].c)
    drop(cx, cy, DROP_R * 0.95, INKS[cols[1]].c)
    drop(cx, cy, DROP_R * 0.45, INKS[cols[2]].c)
  }
  const cx = 0.5 * simW, cy = 0.5 * simH
  let px = cx + 0.32 * simW, py = cy
  for (let a = 0; a < Math.PI * 3.2; a += 0.16) {
    const r = (0.32 - a * 0.013) * simW
    const nx = cx + Math.cos(a) * r, ny = cy + Math.sin(a) * r
    const dx = nx - px, dy = ny - py, dl = Math.hypot(dx, dy) || 1
    stroke(nx, ny, dx / dl, dy / dl, Math.min(dl, MAXSTEP), SW, 0)
    px = nx; py = ny
  }
  for (let i = 0; i < 6; i++) stroke(0.5 * simW, (0.12 + i * 0.15) * simH, i % 2 ? 1 : -1, 0, MAXSTEP, CW * 0.55, 1)
  render()
}

// ---------- dip → 3D collectible reveal ----------
const backBtn = document.getElementById('back')!
const easeOut = (v: number) => 1 - Math.pow(1 - v, 3)
let raf3d = 0
let spinning = false

function dip() {
  obj3dMat.uniforms.uMarble.value = read.texture
  mode = 'object'
  backBtn.removeAttribute('hidden')
  collect.hidden = true
  dim = 1
  egg.rotation.set(0, 0, 0)
  const t0 = performance.now()
  const RISE = 1150
  const DARK = 550
  spinning = true
  cancelAnimationFrame(raf3d)
  const step = () => {
    const t = performance.now() - t0
    const rise = easeOut(Math.min(1, t / RISE))
    egg.position.y = -3.0 * (1 - rise) // rises from below into frame
    obj3dMat.uniforms.uWet.value = t < RISE ? 1 : Math.max(0.3, 1 - (t - RISE) / 900)
    dim = t < RISE ? 1 : Math.max(0.32, 1 - (t - RISE) / DARK)
    if (t > RISE) egg.rotation.y += 0.012 // slow collectible spin once emerged
    egg.position.y += Math.sin(performance.now() / 700) * 0.006 // gentle bob
    render()
    if (t > RISE + DARK) collect.hidden = false
    if (spinning) raf3d = requestAnimationFrame(step)
  }
  raf3d = requestAnimationFrame(step)
}
function backToTray() {
  spinning = false
  cancelAnimationFrame(raf3d)
  mode = 'tray'
  dim = 1
  backBtn.setAttribute('hidden', '')
  collect.hidden = true
  render()
}

// ---------- controls ----------
const swWrap = document.getElementById('swatches')!
INKS.forEach((k, i) => {
  const b = document.createElement('button')
  b.className = 'sw'
  b.style.background = k.hex
  b.setAttribute('aria-pressed', String(i === ink))
  b.setAttribute('aria-label', k.name)
  b.addEventListener('click', () => {
    ink = i
    ;[...swWrap.children].forEach((c, j) => c.setAttribute('aria-pressed', String(j === i)))
  })
  swWrap.appendChild(b)
})
document.getElementById('comb')!.addEventListener('click', (e) => {
  comb = !comb
  ;(e.currentTarget as HTMLElement).setAttribute('aria-pressed', String(comb))
})
document.getElementById('reset')!.addEventListener('click', () => {
  clearField()
  render()
})
document.getElementById('seed')!.addEventListener('click', () => seed())
backBtn.addEventListener('click', () => backToTray())

// single Dip button
const dipTray = document.getElementById('diptray')!
const dipBtn = document.createElement('button')
dipBtn.className = 'btn'
dipBtn.textContent = 'Dip →'
dipBtn.style.cssText = 'background:#ff2e7e;color:#faf8f0;border-color:#16130f'
dipBtn.addEventListener('click', () => dip())
dipTray.insertBefore(dipBtn, backBtn)

// collectible bar
const collect = document.createElement('div')
collect.className = 'tools'
collect.hidden = true
const cap = document.createElement('span')
cap.textContent = 'a marbled egg — one of a kind'
cap.style.cssText = 'font-weight:700;font-size:14px'
const addBtn = document.createElement('button')
addBtn.className = 'btn'
addBtn.textContent = 'Add to collection ✓'
addBtn.style.cssText = 'background:#00a58a;color:#faf8f0;border-color:#16130f'
addBtn.addEventListener('click', () => {
  toast("added to your collection!")
  backToTray()
})
collect.append(cap, addBtn)
dipTray.after(collect)

function toast(msg: string) {
  const t = document.createElement('div')
  t.textContent = msg
  t.style.cssText =
    'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:#16130f;color:#f4f1e7;font-weight:800;font-size:14px;padding:11px 18px;border-radius:6px;z-index:99;box-shadow:4px 4px 0 rgba(255,46,126,.8)'
  document.body.appendChild(t)
  setTimeout(() => t.remove(), 1800)
}

document.getElementById('fps')!.textContent = 'closed-form GPU · raw three.js 3D'
document.getElementById('res')!.textContent = `${simW}×${simH}`

seed()
