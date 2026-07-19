/**
 * pbn.ts — in-browser paint-by-numbers generator.
 *
 * A dependency-free, deterministic TypeScript implementation inspired by
 * github.com/drake7707/paintbynumbersgenerator (simplified but faithful).
 *
 * Pipeline:
 *   1. Median-cut colour quantization; the palette is deduplicated, sorted
 *      ascending by (R,G,B) and (after clean-up) compacted to the colours that
 *      actually own a pixel, so every region's `n` is canonical.
 *   2. 4-connectivity connected components (union-find) -> facets.
 *   3. Speckle clean-up: merge facets smaller than `minArea` into a neighbour.
 *   4. Moore-neighbour / grid-edge boundary tracing per facet -> closed loops.
 *   5. Simplification: collinear-run collapse + Douglas-Peucker (epsilon=simplify),
 *      applied per shared border *segment* so adjacent facets stay gap-free.
 *   6. Label point = pole-of-inaccessibility via a chamfer distance transform
 *      whose sources are only OTHER-facet pixels (off-grid is not a source);
 *      the anchor is re-picked if simplification eroded it out of its polygon.
 *   7. Regions sorted by area descending.
 *
 * No imports, no Math.random, no Date -> fully deterministic. All working
 * buffers are typed arrays; flood-fill and Douglas-Peucker are iterative (no
 * recursion), so a ~15k-pixel image completes well under 400ms.
 *
 * Holes: only each facet's OUTER contour is emitted; an enclosing facet's fill
 * covers the hole and the (smaller-area) enclosed facet is painted on top via
 * the area-descending order. This tiles exactly with no explicit hole geometry
 * (spec design), the one caveat being a thin enclosing ring whose pixel-area is
 * smaller than the region it surrounds.
 */

export interface PbnResult {
  w: number
  h: number
  /** RGB 0-255 per colour, index 0-based */
  palette: [number, number, number][]
  /**
   * n  = 1-based palette index
   * d  = SVG path in grid-edge pixel coords [0..w] x [0..h]
   * lx,ly = numeral anchor (guaranteed inside the facet)
   */
  regions: { n: number; d: string; lx: number; ly: number }[]
}

/* ------------------------------------------------------------------ *
 *  Public entry point
 * ------------------------------------------------------------------ */

export function generatePbn(
  img: { data: Uint8ClampedArray; width: number; height: number },
  opts?: { colors?: number; minArea?: number; simplify?: number },
): PbnResult {
  const w = img.width | 0
  const h = img.height | 0
  const N = w * h

  const colors = Math.max(1, Math.min(256, (opts?.colors ?? 12) | 0))
  const minArea = Math.max(0, (opts?.minArea ?? 14) | 0)
  const simplify = Math.max(0, opts?.simplify ?? 1.2)

  if (N === 0) return { w, h, palette: [], regions: [] }

  // 1. Quantize -----------------------------------------------------------
  const { palette: quantPalette, colorIndex } = medianCutQuantize(img.data, N, colors)

  // 2 + 3. Facets (with speckle clean-up baked in) ------------------------
  //    `facetOf` maps every pixel -> a compact facet id; `facetColor` maps
  //    a facet id -> its palette index. Every pixel is in exactly one facet.
  const { facetOf, facetColor, facetCount } = buildFacets(colorIndex, w, h, minArea)

  // Clean-up can eliminate a colour entirely (all its pixels merged away). Per
  // spec 1e the palette is the set of colours that actually own >=1 pixel, so
  // drop now-unused entries — preserving the ascending-(R,G,B) order — and
  // remap facet colours (hence every region's `n`) onto the compacted palette.
  const palette = compactPalette(quantPalette, facetColor, facetCount)

  // Node map: grid vertices where >=3 regions meet, diagonal pinches, and the
  // four image corners. Border segments split at nodes so that two adjacent
  // facets simplify their shared border identically (DP is reversal-invariant),
  // which guarantees the union of all paths tiles the image with no gaps.
  const nodes = computeNodes(facetOf, w, h)

  // 6. Distance transform for label points (pole of inaccessibility) ------
  const dist = boundaryDistanceTransform(facetOf, w, h)

  // 4 + 5. Trace + simplify each facet's outer loop -----------------------
  // Per-facet accumulators.
  const area = new Int32Array(facetCount)
  const firstPixel = new Int32Array(facetCount).fill(-1)
  const bestDist = new Float32Array(facetCount).fill(-1)
  const bestPixel = new Int32Array(facetCount).fill(-1)

  for (let p = 0; p < N; p++) {
    const f = facetOf[p]
    area[f]++
    if (firstPixel[f] < 0) firstPixel[f] = p
    if (dist[p] > bestDist[f]) {
      bestDist[f] = dist[p]
      bestPixel[f] = p
    }
  }

  // Facet pixel lists grouped in raster order (counting sort), used to re-pick
  // a label that is guaranteed to fall inside the facet's own drawn polygon.
  const facetPixStart = new Int32Array(facetCount + 1)
  for (let p = 0; p < N; p++) facetPixStart[facetOf[p] + 1]++
  for (let f = 0; f < facetCount; f++) facetPixStart[f + 1] += facetPixStart[f]
  const facetPix = new Int32Array(N)
  {
    const cursor = facetPixStart.slice(0, facetCount)
    for (let p = 0; p < N; p++) {
      const f = facetOf[p]
      facetPix[cursor[f]++] = p
    }
  }

  const built: { region: PbnResult["regions"][number]; area: number }[] = []
  const INF_DIST = 5e8

  for (let f = 0; f < facetCount; f++) {
    if (area[f] === 0) continue // merged-away id

    const start = firstPixel[f]
    const sx = start % w
    const sy = (start / w) | 0

    // Trace + simplify the OUTER loop of this facet (segment-aware).
    const loop = traceOuterLoop(facetOf, w, h, f, sx, sy)
    const pts = buildPath(loop, nodes, w, simplify)
    if (!pts) continue
    const d = pointsToPath(pts)

    // Label = pole of inaccessibility (deepest facet pixel). Two adjustments
    // keep the numeral on the facet's own painted colour:
    //  (a) whole-image facet reached no source (all INF) -> use the facet
    //      pixel nearest the image centre;
    //  (b) if the deepest pixel's centre falls outside the *simplified*
    //      polygon (DP eroded a shallow pole), re-pick the deepest facet
    //      pixel whose centre lies inside it. Every candidate is a facet-owned
    //      pixel, so fid[floor(ly)*w+floor(lx)] === f always holds (bug #8).
    let lp = bestPixel[f]
    if (bestDist[f] >= INF_DIST) {
      const ccx = (w - 1) / 2
      const ccy = (h - 1) / 2
      let bd = Infinity
      for (let i = facetPixStart[f]; i < facetPixStart[f + 1]; i++) {
        const p = facetPix[i]
        const dx = (p % w) - ccx
        const dy = ((p / w) | 0) - ccy
        const d2 = dx * dx + dy * dy
        if (d2 < bd) {
          bd = d2
          lp = p
        }
      }
    }
    if (!pointInPolygon(pts, (lp % w) + 0.5, ((lp / w) | 0) + 0.5)) {
      let bp = -1
      let bDist = -Infinity
      for (let i = facetPixStart[f]; i < facetPixStart[f + 1]; i++) {
        const p = facetPix[i]
        if (dist[p] <= bDist) continue // cannot beat current best
        if (pointInPolygon(pts, (p % w) + 0.5, ((p / w) | 0) + 0.5)) {
          bDist = dist[p]
          bp = p
        }
      }
      if (bp >= 0) lp = bp
    }

    const lx = (lp % w) + 0.5
    const ly = ((lp / w) | 0) + 0.5

    built.push({ region: { n: facetColor[f] + 1, d, lx, ly }, area: area[f] })
  }

  // 7. Sort by area descending (paint big facets first, small on top), with the
  // spec's exact tie-break: smaller n, then smaller lx, then smaller ly. Each
  // region has a distinct label pixel, so this is a total, deterministic order.
  built.sort(
    (a, b) =>
      b.area - a.area ||
      a.region.n - b.region.n ||
      a.region.lx - b.region.lx ||
      a.region.ly - b.region.ly,
  )

  return { w, h, palette, regions: built.map((b) => b.region) }
}

/* ================================================================== *
 *  1. MEDIAN-CUT QUANTIZATION
 * ================================================================== */

function medianCutQuantize(
  data: Uint8ClampedArray,
  N: number,
  colors: number,
): { palette: [number, number, number][]; colorIndex: Int32Array } {
  // Per-pixel RGB. Alpha is ignored except that a fully-transparent pixel
  // (a === 0) is sampled as (0,0,0), per spec 1a.
  const r = new Uint8Array(N)
  const g = new Uint8Array(N)
  const b = new Uint8Array(N)
  for (let i = 0; i < N; i++) {
    const o = i << 2
    if (data[o + 3] === 0) continue // transparent -> (0,0,0) (arrays start zeroed)
    r[i] = data[o]
    g[i] = data[o + 1]
    b[i] = data[o + 2]
  }

  // idx[] holds pixel indices; boxes reference contiguous sub-ranges of idx.
  const idx = new Int32Array(N)
  for (let i = 0; i < N; i++) idx[i] = i

  interface Box {
    start: number
    end: number // exclusive
    range: number // max channel range in the box
    channel: number // channel (0=r,1=g,2=b) with that range
  }

  const measure = (box: Box) => {
    let rMin = 255,
      rMax = 0,
      gMin = 255,
      gMax = 0,
      bMin = 255,
      bMax = 0
    for (let i = box.start; i < box.end; i++) {
      const p = idx[i]
      const rr = r[p],
        gg = g[p],
        bb = b[p]
      if (rr < rMin) rMin = rr
      if (rr > rMax) rMax = rr
      if (gg < gMin) gMin = gg
      if (gg > gMax) gMax = gg
      if (bb < bMin) bMin = bb
      if (bb > bMax) bMax = bb
    }
    const dr = rMax - rMin,
      dg = gMax - gMin,
      db = bMax - bMin
    if (dr >= dg && dr >= db) {
      box.range = dr
      box.channel = 0
    } else if (dg >= db) {
      box.range = dg
      box.channel = 1
    } else {
      box.range = db
      box.channel = 2
    }
  }

  const boxes: Box[] = [{ start: 0, end: N, range: 0, channel: 0 }]
  measure(boxes[0])

  const chanArr = (c: number) => (c === 0 ? r : c === 1 ? g : b)

  while (boxes.length < colors) {
    // Pick the splittable box with the largest colour range.
    let best = -1
    let bestRange = -1
    for (let i = 0; i < boxes.length; i++) {
      const bx = boxes[i]
      if (bx.end - bx.start > 1 && bx.range > bestRange) {
        bestRange = bx.range
        best = i
      }
    }
    if (best < 0 || bestRange <= 0) break // no box can be split further

    const box = boxes[best]
    const ch = chanArr(box.channel)

    // Sort the box's sub-range by the chosen channel, then split at median.
    const sub: number[] = []
    for (let i = box.start; i < box.end; i++) sub.push(idx[i])
    sub.sort((x, y) => ch[x] - ch[y])
    for (let i = 0; i < sub.length; i++) idx[box.start + i] = sub[i]

    // Split at the population median, but snap to the nearest value boundary so
    // pixels sharing the split channel's value (in particular, identical
    // colours) are never separated. This keeps uniform regions in one box and
    // avoids inventing blended palette entries (e.g. red+blue -> "purple").
    let mid = (box.start + box.end) >> 1
    {
      const midVal = ch[idx[mid]]
      if (ch[idx[mid - 1]] === midVal) {
        // Inside a constant-value run: find the run's two edges and pick the
        // edge closest to the median (guaranteed to exist since range > 0).
        let lo = mid
        while (lo > box.start && ch[idx[lo - 1]] === midVal) lo--
        let hi = mid
        while (hi < box.end && ch[idx[hi]] === midVal) hi++
        // lo = first index of the run, hi = one past its last index.
        const takeHi = hi <= box.end - 1 && (lo <= box.start || hi - mid <= mid - lo)
        mid = takeHi ? hi : lo
      }
    }
    if (mid <= box.start) mid = box.start + 1
    if (mid >= box.end) mid = box.end - 1

    const left: Box = { start: box.start, end: mid, range: 0, channel: 0 }
    const right: Box = { start: mid, end: box.end, range: 0, channel: 0 }
    measure(left)
    measure(right)
    boxes[best] = left
    boxes.push(right)
  }

  // Palette = average colour of each box; assign pixels by box membership so
  // every palette entry is used and every pixel maps to exactly one colour.
  const palette: [number, number, number][] = []
  const colorIndex = new Int32Array(N)
  for (let bIdx = 0; bIdx < boxes.length; bIdx++) {
    const bx = boxes[bIdx]
    let sr = 0,
      sg = 0,
      sb = 0
    const cnt = bx.end - bx.start
    for (let i = bx.start; i < bx.end; i++) {
      const p = idx[i]
      sr += r[p]
      sg += g[p]
      sb += b[p]
      colorIndex[p] = bIdx
    }
    palette.push([
      Math.round(sr / cnt),
      Math.round(sg / cnt),
      Math.round(sb / cnt),
    ])
  }

  // Spec 1e: dedup identical rounded centroids, keep only colours that own
  // >=1 pixel (every box does), SORT the palette ascending by (R,G,B) and
  // rewrite the per-pixel index map. This makes the palette order — and hence
  // every region's `n` — canonical and independent of box-split order.
  return canonicalizePalette(palette, colorIndex, N)
}

/**
 * Deduplicate + sort a raw per-box palette ascending by (R,G,B) and remap the
 * per-pixel colour-index map onto the sorted, deduplicated palette. Fully
 * deterministic (final order depends only on the RGB values).
 */
function canonicalizePalette(
  boxPalette: [number, number, number][],
  colorIndex: Int32Array,
  N: number,
): { palette: [number, number, number][]; colorIndex: Int32Array } {
  const key = (c: [number, number, number]) => (c[0] << 16) | (c[1] << 8) | c[2]

  // Distinct colours (dedup).
  const distinct = new Map<number, [number, number, number]>()
  for (const c of boxPalette) {
    const k = key(c)
    if (!distinct.has(k)) distinct.set(k, c)
  }
  const palette = Array.from(distinct.values())
  palette.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2])

  // old-box-index -> new-palette-index (via the box's colour key).
  const keyToNew = new Map<number, number>()
  for (let i = 0; i < palette.length; i++) keyToNew.set(key(palette[i]), i)
  const boxToNew = new Int32Array(boxPalette.length)
  for (let b = 0; b < boxPalette.length; b++) boxToNew[b] = keyToNew.get(key(boxPalette[b]))!

  const remapped = new Int32Array(N)
  for (let p = 0; p < N; p++) remapped[p] = boxToNew[colorIndex[p]]

  return { palette, colorIndex: remapped }
}

/**
 * Drop palette colours no longer owned by any facet after clean-up, preserving
 * the ascending-(R,G,B) order, and remap `facetColor` in place onto the
 * compacted palette. Returns the compacted palette. If every colour is still
 * used this is an identity (the original array is returned).
 */
function compactPalette(
  palette: [number, number, number][],
  facetColor: Int32Array,
  facetCount: number,
): [number, number, number][] {
  const used = new Uint8Array(palette.length)
  for (let f = 0; f < facetCount; f++) {
    const c = facetColor[f]
    if (c >= 0 && c < palette.length) used[c] = 1
  }
  let allUsed = true
  for (let c = 0; c < palette.length; c++) {
    if (!used[c]) {
      allUsed = false
      break
    }
  }
  if (allUsed) return palette

  const remap = new Int32Array(palette.length).fill(-1)
  const compact: [number, number, number][] = []
  for (let c = 0; c < palette.length; c++) {
    if (used[c]) {
      remap[c] = compact.length
      compact.push(palette[c])
    }
  }
  for (let f = 0; f < facetCount; f++) {
    if (facetColor[f] >= 0) facetColor[f] = remap[facetColor[f]]
  }
  return compact
}

/* ================================================================== *
 *  2 + 3. FACETS (connected components) + speckle clean-up
 * ================================================================== */

function buildFacets(
  colorIndex: Int32Array,
  w: number,
  h: number,
  minArea: number,
): { facetOf: Int32Array; facetColor: Int32Array; facetCount: number } {
  const N = w * h

  // Iterative clean-up: recompute connected components, merge any facet whose
  // area < minArea into a neighbour (grouped via union-find so cycles/chains
  // resolve to the largest facet's colour), repeat until stable.
  let passes = 0
  for (;;) {
    passes++
    const cc = connectedComponents(colorIndex, w, h)
    const fCount = cc.count
    const facetOf = cc.facetOf

    // Facet areas + colour.
    const area = new Int32Array(fCount)
    const fColor = new Int32Array(fCount)
    for (let p = 0; p < N; p++) {
      const f = facetOf[p]
      area[f]++
      fColor[f] = colorIndex[p]
    }

    // Any facet below threshold?
    let anySmall = false
    for (let f = 0; f < fCount; f++)
      if (area[f] < minArea) {
        anySmall = true
        break
      }
    if (!anySmall || minArea === 0 || fCount <= 1) {
      return { facetOf, facetColor: fColor, facetCount: fCount }
    }

    // Border-length adjacency for small facets: for each small facet find the
    // neighbour with the largest shared border.
    // bestNb[f] = neighbour facet with max shared border (only computed for small f)
    const bestNb = new Int32Array(fCount).fill(-1)
    const bestNbArea = new Int32Array(fCount) // tie-break by larger area

    // Aggregate shared-border counts per small facet using a Map.
    const borderMap = new Map<number, Map<number, number>>()
    const bump = (f: number, nb: number) => {
      if (area[f] >= minArea) return
      let m = borderMap.get(f)
      if (!m) {
        m = new Map()
        borderMap.set(f, m)
      }
      m.set(nb, (m.get(nb) ?? 0) + 1)
    }

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x
        const f = facetOf[p]
        if (x + 1 < w) {
          const nf = facetOf[p + 1]
          if (nf !== f) {
            bump(f, nf)
            bump(nf, f)
          }
        }
        if (y + 1 < h) {
          const nf = facetOf[p + w]
          if (nf !== f) {
            bump(f, nf)
            bump(nf, f)
          }
        }
      }
    }

    // Choose target neighbour for each small facet.
    borderMap.forEach((m, f) => {
      let bnb = -1
      let bb = -1
      m.forEach((cnt, nb) => {
        const better =
          cnt > bb ||
          (cnt === bb &&
            (area[nb] > bestNbArea[f] ||
              (area[nb] === bestNbArea[f] && nb < bnb)))
        if (better) {
          bb = cnt
          bnb = nb
          bestNbArea[f] = area[nb]
        }
      })
      bestNb[f] = bnb
    })

    // Union-find over facets to resolve merge groups; representative = the
    // largest-area facet in the group (deterministic tie-break: lower index).
    const parent = new Int32Array(fCount)
    for (let f = 0; f < fCount; f++) parent[f] = f
    const find = (x: number): number => {
      while (parent[x] !== x) {
        parent[x] = parent[parent[x]]
        x = parent[x]
      }
      return x
    }
    const betterRep = (a: number, b: number) =>
      area[a] > area[b] || (area[a] === area[b] && a < b) ? a : b
    const union = (a: number, b: number) => {
      const ra = find(a)
      const rb = find(b)
      if (ra === rb) return
      const rep = betterRep(ra, rb)
      const other = rep === ra ? rb : ra
      parent[other] = rep
    }

    for (let f = 0; f < fCount; f++) {
      if (area[f] < minArea && bestNb[f] >= 0) union(f, bestNb[f])
    }

    // Recolour every pixel to its group representative's colour.
    let changed = false
    // Cache representative colour per root.
    const repColor = new Int32Array(fCount).fill(-1)
    for (let p = 0; p < N; p++) {
      const root = find(facetOf[p])
      let rc = repColor[root]
      if (rc < 0) {
        rc = fColor[root]
        repColor[root] = rc
      }
      if (colorIndex[p] !== rc) {
        colorIndex[p] = rc
        changed = true
      }
    }

    if (!changed) {
      // No progress possible (e.g. a small facet with no differing neighbour).
      return { facetOf, facetColor: fColor, facetCount: fCount }
    }
    // Safety valve against pathological inputs.
    if (passes > 64) {
      const cc2 = connectedComponents(colorIndex, w, h)
      const fc = new Int32Array(cc2.count)
      for (let p = 0; p < N; p++) fc[cc2.facetOf[p]] = colorIndex[p]
      return { facetOf: cc2.facetOf, facetColor: fc, facetCount: cc2.count }
    }
  }
}

/** 4-connectivity connected components via union-find (iterative). */
function connectedComponents(
  colorIndex: Int32Array,
  w: number,
  h: number,
): { facetOf: Int32Array; count: number } {
  const N = w * h
  const parent = new Int32Array(N)
  for (let i = 0; i < N; i++) parent[i] = i
  const rank = new Uint8Array(N)

  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]
      x = parent[x]
    }
    return x
  }
  const union = (a: number, b: number) => {
    let ra = find(a)
    let rb = find(b)
    if (ra === rb) return
    if (rank[ra] < rank[rb]) {
      const t = ra
      ra = rb
      rb = t
    }
    parent[rb] = ra
    if (rank[ra] === rank[rb]) rank[ra]++
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x
      const c = colorIndex[p]
      if (x + 1 < w && colorIndex[p + 1] === c) union(p, p + 1)
      if (y + 1 < h && colorIndex[p + w] === c) union(p, p + w)
    }
  }

  // Compact roots -> facet ids.
  const facetOf = new Int32Array(N)
  const label = new Int32Array(N).fill(-1)
  let count = 0
  for (let p = 0; p < N; p++) {
    const root = find(p)
    let l = label[root]
    if (l < 0) {
      l = count++
      label[root] = l
    }
    facetOf[p] = l
  }
  return { facetOf, count }
}

/* ================================================================== *
 *  Node map (grid vertices that anchor border-segment endpoints)
 * ================================================================== */

function computeNodes(facetOf: Int32Array, w: number, h: number): Uint8Array {
  const gw = w + 1
  const gh = h + 1
  const nodes = new Uint8Array(gw * gh)

  const at = (x: number, y: number) =>
    x < 0 || y < 0 || x >= w || y >= h ? -1 : facetOf[y * w + x]

  for (let vy = 0; vy < gh; vy++) {
    for (let vx = 0; vx < gw; vx++) {
      const tl = at(vx - 1, vy - 1)
      const tr = at(vx, vy - 1)
      const bl = at(vx - 1, vy)
      const br = at(vx, vy)

      // Distinct region count around this vertex (outside == -1 is a region).
      const vals = [tl, tr, bl, br]
      let uniq = 0
      for (let i = 0; i < 4; i++) {
        let seen = false
        for (let j = 0; j < i; j++)
          if (vals[j] === vals[i]) {
            seen = true
            break
          }
        if (!seen) uniq++
      }

      const isCorner = (vx === 0 || vx === w) && (vy === 0 || vy === h)
      // Diagonal pinch: TL==BR, TR==BL, but the two diagonals differ.
      const pinch = tl === br && tr === bl && tl !== tr

      if (uniq >= 3 || pinch || isCorner) nodes[vy * gw + vx] = 1
    }
  }
  return nodes
}

/* ================================================================== *
 *  4. BOUNDARY TRACING — grid-edge turtle keeping the facet on the right.
 * ================================================================== */

// Direction encoding (clockwise in screen coords, y-down):
//   0 = +x (right), 1 = +y (down), 2 = -x (left), 3 = -y (up)
const DX = [1, 0, -1, 0]
const DY = [0, 1, 0, -1]

/**
 * Trace the outer boundary of facet `f`, starting from its top-left pixel
 * (sx,sy). Returns the closed list of unit grid vertices [x,y] with the first
 * vertex repeated at the end.
 */
function traceOuterLoop(
  facetOf: Int32Array,
  w: number,
  h: number,
  f: number,
  sx: number,
  sy: number,
): number[][] {
  const inFacet = (px: number, py: number) =>
    px >= 0 && py >= 0 && px < w && py < h && facetOf[py * w + px] === f

  // Interior (facet-side) pixel of the boundary edge leaving vertex (vx,vy)
  // in direction dir, keeping the facet on the right of travel.
  const interiorPix = (vx: number, vy: number, dir: number): [number, number] => {
    switch (dir) {
      case 0:
        return [vx, vy] // +x -> facet below
      case 1:
        return [vx - 1, vy] // +y -> facet to the west
      case 2:
        return [vx - 1, vy - 1] // -x -> facet above
      default:
        return [vx, vy - 1] // -y -> facet to the east
    }
  }
  const exteriorPix = (vx: number, vy: number, dir: number): [number, number] => {
    switch (dir) {
      case 0:
        return [vx, vy - 1]
      case 1:
        return [vx, vy]
      case 2:
        return [vx - 1, vy]
      default:
        return [vx - 1, vy - 1]
    }
  }

  const isBoundary = (vx: number, vy: number, dir: number) => {
    const [ix, iy] = interiorPix(vx, vy, dir)
    if (!inFacet(ix, iy)) return false
    const [ex, ey] = exteriorPix(vx, vy, dir)
    return !inFacet(ex, ey)
  }

  // Start: the top edge of the top-left facet pixel goes +x with the facet
  // below and empty above (guaranteed for the row-major-first pixel).
  const startX = sx
  const startY = sy
  const startDir = 0

  const verts: number[][] = []
  let vx = startX
  let vy = startY
  let dir = startDir
  verts.push([vx, vy])

  // Guard against runaway loops on degenerate input.
  const maxSteps = (w + 1) * (h + 1) * 4 + 8
  let steps = 0

  for (;;) {
    // Advance along current edge.
    vx += DX[dir]
    vy += DY[dir]
    verts.push([vx, vy])

    if (vx === startX && vy === startY) {
      // Returned to start; close the loop.
      break
    }

    // Choose the next direction. Among the valid outgoing boundary edges
    // (excluding the reverse of how we arrived), prefer turning LEFT first
    // (counter-clockwise) so the outer contour hugs the boundary and does not
    // dive into holes. Preference order: left, straight, right.
    const back = (dir + 2) & 3
    const left = (dir + 3) & 3
    const straight = dir
    const right = (dir + 1) & 3

    let next = -1
    if (left !== back && isBoundary(vx, vy, left)) next = left
    else if (straight !== back && isBoundary(vx, vy, straight)) next = straight
    else if (right !== back && isBoundary(vx, vy, right)) next = right
    else if (isBoundary(vx, vy, back)) next = back // dead-end spur (1px tail)

    if (next < 0) break // should not happen on a well-formed facet
    dir = next

    if (++steps > maxSteps) break
  }

  return verts
}

/* ================================================================== *
 *  5. SIMPLIFICATION  (segment-aware collinear + Douglas-Peucker)
 * ================================================================== */

/**
 * Simplify a traced loop into a closed vertex ring (segment-aware so adjacent
 * facets stay gap-free). Returns the open ring of vertices (no repeated first
 * vertex), or null if the loop is degenerate.
 */
function buildPath(
  loop: number[][],
  nodes: Uint8Array,
  w: number,
  eps: number,
): number[][] | null {
  const gw = w + 1
  const isNode = (v: number[]) => nodes[v[1] * gw + v[0]] === 1

  // loop has first vertex repeated at the end; work with the open cycle.
  const m = loop.length - 1
  if (m < 2) return null // degenerate

  const cyc = loop.slice(0, m) // length m, no repeat

  // Collect node indices.
  const nodeIdx: number[] = []
  for (let i = 0; i < m; i++) if (isNode(cyc[i])) nodeIdx.push(i)

  let out: number[][]

  if (nodeIdx.length === 0) {
    // Pure closed loop (no junction): DP as a ring with a canonical anchor.
    out = simplifyRing(cyc, eps)
  } else {
    // Split at nodes; simplify each node-to-node run independently. A run is
    // the identical polyline (up to reversal) for the two facets sharing it,
    // so if both feed the *same* oriented array to the simplifier they get the
    // same output and their shared border stays perfectly aligned (no gaps).
    // We therefore canonicalize each run to a direction that depends only on
    // its geometry (lexicographically smaller endpoint first), simplify, then
    // flip back to this facet's traversal direction. This is robust even to
    // floating-point tie-breaks inside Douglas-Peucker.
    out = []
    const k = nodeIdx.length
    for (let s = 0; s < k; s++) {
      const iStart = nodeIdx[s]
      const iEnd = nodeIdx[(s + 1) % k]
      // Extract the run iStart .. iEnd (inclusive), wrapping.
      const run: number[][] = []
      let i = iStart
      run.push(cyc[i])
      while (i !== iEnd) {
        i = (i + 1) % m
        run.push(cyc[i])
      }
      const reversed = canonicalizeRun(run)
      let simp = douglasPeucker(collapseCollinear(run), eps)
      if (reversed) simp = simp.reverse()
      // Append, skipping the duplicated join vertex.
      for (let j = 0; j < simp.length - 1; j++) out.push(simp[j])
    }
  }

  if (out.length < 3) {
    // Fall back to axis-aligned corners to keep a valid closed area.
    out = collapseCollinear(cyc)
    if (out.length < 3) return null
  }

  return out
}

/** Emit a closed SVG path (grid-edge coords) from a simplified vertex ring. */
function pointsToPath(out: number[][]): string {
  let d = "M" + fmt(out[0][0]) + " " + fmt(out[0][1])
  for (let i = 1; i < out.length; i++) d += " L" + fmt(out[i][0]) + " " + fmt(out[i][1])
  d += " Z"
  return d
}

function fmt(n: number): string {
  // Coordinates are integers (DP keeps original grid vertices); keep compact.
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
}

/**
 * Even-odd point-in-polygon test on an open vertex ring (last vertex implicitly
 * joins the first). Used to guarantee a label sits inside its own drawn shape.
 */
function pointInPolygon(poly: number[][], x: number, y: number): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0]
    const yi = poly[i][1]
    const xj = poly[j][0]
    const yj = poly[j][1]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/**
 * Reverse a border run in place so its direction depends only on geometry, not
 * on which facet is walking it. Returns true if it was reversed. Two facets
 * sharing the run thus produce byte-identical simplifier input -> identical
 * output -> gap-free shared borders.
 */
function canonicalizeRun(run: number[][]): boolean {
  const n = run.length
  const a = run[0]
  const b = run[n - 1]
  let flip = b[0] < a[0] || (b[0] === a[0] && b[1] < a[1])
  if (!flip && a[0] === b[0] && a[1] === b[1] && n > 2) {
    // Closed run pinned at a single node: tie-break on the next vertices in.
    const a2 = run[1]
    const b2 = run[n - 2]
    flip = b2[0] < a2[0] || (b2[0] === a2[0] && b2[1] < a2[1])
  }
  if (flip) run.reverse()
  return flip
}

/** Remove points that lie on a straight line between their neighbours. */
function collapseCollinear(pts: number[][]): number[][] {
  if (pts.length <= 2) return pts.slice()
  const out: number[][] = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1]
    const b = pts[i]
    const c = pts[i + 1]
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
    if (cross !== 0) out.push(b)
    // if collinear, skip b
  }
  out.push(pts[pts.length - 1])
  return out
}

/** Classic Douglas-Peucker on an open polyline (endpoints preserved). */
function douglasPeucker(pts: number[][], eps: number): number[][] {
  const n = pts.length
  if (n <= 2 || eps <= 0) return pts.slice()
  const keep = new Uint8Array(n)
  keep[0] = 1
  keep[n - 1] = 1

  // Iterative stack to avoid recursion / stack overflow.
  const stack: [number, number][] = [[0, n - 1]]
  const eps2 = eps * eps
  while (stack.length) {
    const [lo, hi] = stack.pop()!
    if (hi - lo < 2) continue
    const ax = pts[lo][0]
    const ay = pts[lo][1]
    const bx = pts[hi][0]
    const by = pts[hi][1]
    const dx = bx - ax
    const dy = by - ay
    const segLen2 = dx * dx + dy * dy

    let maxD2 = -1
    let maxI = -1
    for (let i = lo + 1; i < hi; i++) {
      const px = pts[i][0]
      const py = pts[i][1]
      let d2: number
      if (segLen2 === 0) {
        const ex = px - ax
        const ey = py - ay
        d2 = ex * ex + ey * ey
      } else {
        // Perpendicular distance squared to segment (a,b).
        const t = ((px - ax) * dx + (py - ay) * dy) / segLen2
        const cx = ax + t * dx
        const cy = ay + t * dy
        const ex = px - cx
        const ey = py - cy
        d2 = ex * ex + ey * ey
      }
      if (d2 > maxD2) {
        maxD2 = d2
        maxI = i
      }
    }

    if (maxD2 > eps2 && maxI > lo) {
      keep[maxI] = 1
      stack.push([lo, maxI])
      stack.push([maxI, hi])
    }
  }

  const out: number[][] = []
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i])
  return out
}

/** DP for a closed ring: anchor at a deterministic vertex + the point
 *  farthest from it, then DP the two halves. */
function simplifyRing(cyc: number[][], eps: number): number[][] {
  const m = cyc.length
  if (m <= 3) return collapseCollinear(cyc)

  // Canonical anchor: topmost-then-leftmost vertex (identical regardless of
  // traversal direction, so shared rings stay consistent).
  let a0 = 0
  for (let i = 1; i < m; i++) {
    const v = cyc[i]
    const b = cyc[a0]
    if (v[1] < b[1] || (v[1] === b[1] && v[0] < b[0])) a0 = i
  }

  // Farthest vertex from the anchor.
  let a1 = a0
  let far = -1
  for (let i = 0; i < m; i++) {
    const dx = cyc[i][0] - cyc[a0][0]
    const dy = cyc[i][1] - cyc[a0][1]
    const d2 = dx * dx + dy * dy
    if (d2 > far) {
      far = d2
      a1 = i
    }
  }
  if (a1 === a0) return collapseCollinear(cyc)

  // Build the two open polylines a0..a1 and a1..a0 (wrapping).
  const half = (from: number, to: number): number[][] => {
    const arr: number[][] = []
    let i = from
    arr.push(cyc[i])
    while (i !== to) {
      i = (i + 1) % m
      arr.push(cyc[i])
    }
    return arr
  }

  const s1 = douglasPeucker(collapseCollinear(half(a0, a1)), eps)
  const s2 = douglasPeucker(collapseCollinear(half(a1, a0)), eps)

  const out: number[][] = []
  for (let i = 0; i < s1.length - 1; i++) out.push(s1[i])
  for (let i = 0; i < s2.length - 1; i++) out.push(s2[i])
  return out
}

/* ================================================================== *
 *  6. DISTANCE TRANSFORM (pole of inaccessibility, approx.)
 * ================================================================== */

/**
 * Two-pass chamfer distance transform for the pole of inaccessibility.
 * SOURCES (distance 0) = in-grid pixels that touch a DIFFERENT facet across a
 * 4-neighbour edge. Off-grid (the image border) is deliberately NOT a source,
 * so a facet that hugs the image edge is measured only against real facet
 * boundaries and its label is never sucked toward the image edge (spec
 * Stage 6 / bug #2). A facet that spans the whole image reaches no source and
 * stays at INF everywhere; the caller resolves that with a centre fallback.
 * dist[p] ~= distance from p to the nearest OTHER-facet boundary, so the
 * per-facet maximum is the pole of inaccessibility.
 */
function boundaryDistanceTransform(
  facetOf: Int32Array,
  w: number,
  h: number,
): Float32Array {
  const N = w * h
  const INF = 1e9
  const dist = new Float32Array(N)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x
      const f = facetOf[p]
      // Off-grid neighbours are OUTSIDE but are NOT sources.
      let seed = false
      if (x > 0 && facetOf[p - 1] !== f) seed = true
      else if (x + 1 < w && facetOf[p + 1] !== f) seed = true
      else if (y > 0 && facetOf[p - w] !== f) seed = true
      else if (y + 1 < h && facetOf[p + w] !== f) seed = true
      dist[p] = seed ? 0 : INF
    }
  }

  const D = 1 // orthogonal cost
  const D2 = 1.41421356 // diagonal cost

  // Forward pass.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x
      let d = dist[p]
      if (x > 0) d = Math.min(d, dist[p - 1] + D)
      if (y > 0) d = Math.min(d, dist[p - w] + D)
      if (x > 0 && y > 0) d = Math.min(d, dist[p - w - 1] + D2)
      if (x + 1 < w && y > 0) d = Math.min(d, dist[p - w + 1] + D2)
      dist[p] = d
    }
  }
  // Backward pass.
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const p = y * w + x
      let d = dist[p]
      if (x + 1 < w) d = Math.min(d, dist[p + 1] + D)
      if (y + 1 < h) d = Math.min(d, dist[p + w] + D)
      if (x + 1 < w && y + 1 < h) d = Math.min(d, dist[p + w + 1] + D2)
      if (x > 0 && y + 1 < h) d = Math.min(d, dist[p + w - 1] + D2)
      dist[p] = d
    }
  }

  return dist
}
