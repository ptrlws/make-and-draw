/* ------------------------------------------------------------------ *
 * Mono line-drawing overlays (SVG path data, 100x100 space) for the
 * scratch-off kit. Each picture is a set of plain stroke paths — no
 * colour — so the same drawing can be rendered faintly as a scratch
 * guide on the black coat AND glowing in neon underneath it.
 *
 * Add a picture: push { id, name, paths } where paths are SVG `d`
 * strings (or use the circle/poly/line/star helpers) in a 0..100 box.
 * ------------------------------------------------------------------ */

export interface NeonPic {
  id: string
  name: string
  /** SVG path `d` strings in a 100x100 coordinate box */
  paths: string[]
}

const n = (v: number) => v.toFixed(1)
/** a full circle as one path */
const circle = (cx: number, cy: number, r: number) =>
  `M ${n(cx - r)} ${n(cy)} a ${n(r)} ${n(r)} 0 1 0 ${n(r * 2)} 0 a ${n(r)} ${n(r)} 0 1 0 ${n(-r * 2)} 0 Z`
const line = (x1: number, y1: number, x2: number, y2: number) => `M ${n(x1)} ${n(y1)} L ${n(x2)} ${n(y2)}`
const poly = (pts: [number, number][], close = true) => 'M ' + pts.map((p) => `${n(p[0])} ${n(p[1])}`).join(' L ') + (close ? ' Z' : '')
function star(cx: number, cy: number, R: number, r: number, points = 5) {
  let d = ''
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? R : r
    const a = -Math.PI / 2 + (i * Math.PI) / points
    d += (i === 0 ? 'M ' : 'L ') + n(cx + Math.cos(a) * rad) + ' ' + n(cy + Math.sin(a) * rad) + ' '
  }
  return d + 'Z'
}

const sunRays: string[] = []
for (let i = 0; i < 12; i++) {
  const a = (i * Math.PI) / 6
  sunRays.push(line(50 + Math.cos(a) * 26, 50 + Math.sin(a) * 26, 50 + Math.cos(a) * 40, 50 + Math.sin(a) * 40))
}

const flowerPetals: string[] = []
for (let i = 0; i < 6; i++) {
  const a = (i * Math.PI) / 3
  flowerPetals.push(circle(50 + Math.cos(a) * 17, 40 + Math.sin(a) * 17, 9))
}

export const NEON_PICS: NeonPic[] = [
  { id: 'star', name: 'Star', paths: [star(50, 50, 42, 17), star(50, 50, 22, 9)] },
  {
    id: 'heart',
    name: 'Heart',
    paths: [
      'M 50 84 C 16 58 18 26 40 26 C 48 26 50 33 50 40 C 50 33 52 26 60 26 C 82 26 84 58 50 84 Z',
      'M 34 40 Q 33 32 40 30',
    ],
  },
  { id: 'sun', name: 'Sun', paths: [circle(50, 50, 20), ...sunRays] },
  {
    id: 'cat',
    name: 'Cat',
    paths: [
      circle(50, 54, 28),
      poly([[30, 34], [26, 10], [48, 27]]),
      poly([[70, 34], [74, 10], [52, 27]]),
      circle(40, 50, 3),
      circle(60, 50, 3),
      poly([[50, 60], [46, 56], [54, 56]]),
      line(40, 63, 20, 59),
      line(40, 66, 20, 68),
      line(60, 63, 80, 59),
      line(60, 66, 80, 68),
    ],
  },
  {
    id: 'rocket',
    name: 'Rocket',
    paths: [
      'M 40 36 Q 50 8 60 36 L 60 72 L 40 72 Z',
      circle(50, 40, 7),
      poly([[40, 60], [28, 76], [40, 74]]),
      poly([[60, 60], [72, 76], [60, 74]]),
      line(45, 74, 44, 88),
      line(50, 74, 50, 92),
      line(55, 74, 56, 88),
    ],
  },
  { id: 'flower', name: 'Flower', paths: [circle(50, 40, 9), ...flowerPetals, line(50, 52, 50, 92), 'M 50 74 Q 66 68 72 80'] },
]
