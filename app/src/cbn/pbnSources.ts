/* ------------------------------------------------------------------ *
 * Photo pre-pass for the paint-by-numbers generator. Built-in pictures
 * now come from bundled PNG/SVG files (see cbnSources.ts) — this file is
 * only the clean-up an *uploaded photo* gets before faceting: adjust
 * brightness/contrast, then an edge-aware (median) smooth that flattens
 * noise / JPEG grain while keeping colour edges crisp, so quantization
 * yields tidy facets instead of speckle.
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
