/* ------------------------------------------------------------------ *
 * Getting art OFF the device — share sheets, PNG downloads, printable
 * pages. Everything is user-initiated and works from local data only.
 * ------------------------------------------------------------------ */

const PAPER = '#f4f1e7'

/** Data-URL (PNG or SVG) → PNG blob at a fridge-worthy resolution. */
export async function rasterizePng(dataUrl: string, size = 1024): Promise<Blob | null> {
  try {
    const img = new Image()
    await new Promise<void>((res, rej) => {
      img.onload = () => res()
      img.onerror = () => rej(new Error('decode'))
      img.src = dataUrl
    })
    const w = img.width || size
    const h = img.height || size
    const s = size / Math.max(w, h)
    const cv = document.createElement('canvas')
    cv.width = Math.round(w * s)
    cv.height = Math.round(h * s)
    const ctx = cv.getContext('2d')!
    ctx.fillStyle = PAPER // transparent art (dipped toys) gets warm paper behind it
    ctx.fillRect(0, 0, cv.width, cv.height)
    ctx.drawImage(img, 0, 0, cv.width, cv.height)
    return await new Promise<Blob | null>((res) => cv.toBlob(res, 'image/png'))
  } catch {
    return null
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'art'

/** Share via the OS sheet where available, otherwise save as a PNG file. */
export async function sharePiece(title: string, img: string): Promise<'shared' | 'saved' | 'failed'> {
  const blob = await rasterizePng(img)
  if (!blob) return 'failed'
  const file = new File([blob], `make-and-draw-${slug(title)}.png`, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: `Make & Draw — ${title}` })
      return 'shared'
    } catch (e) {
      // user closed the sheet — that's not a failure, and not a download either
      if ((e as Error).name === 'AbortError') return 'shared'
      /* fall through to download */
    }
  }
  downloadBlob(blob, `make-and-draw-${slug(title)}.png`)
  return 'saved'
}

/** Open the browser's print dialog on a fully-formed printable page. */
export function printHtml(bodyHtml: string, title: string): void {
  const frame = document.createElement('iframe')
  frame.style.position = 'fixed'
  frame.style.right = '0'
  frame.style.bottom = '0'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  @page { margin: 12mm; }
  body { font-family: -apple-system, 'Segoe UI', sans-serif; color: #16130f; margin: 0; }
  h1 { font-size: 20px; letter-spacing: .04em; text-transform: uppercase; margin: 0 0 2mm; }
  .sub { font-size: 11px; color: #6f675a; margin: 0 0 5mm; }
  svg { width: 100%; height: auto; }
  .legend { display: flex; flex-wrap: wrap; gap: 4mm; margin-top: 5mm; }
  .swatch { display: flex; align-items: center; gap: 2mm; font-size: 12px; font-weight: 700; }
  .swatch i { width: 8mm; height: 8mm; border: 1px solid #16130f; border-radius: 2mm; display: inline-block; }
</style></head><body>${bodyHtml}</body></html>`
  document.body.appendChild(frame)
  frame.onload = () => {
    try {
      frame.contentWindow?.focus()
      frame.contentWindow?.print()
    } catch {
      /* print unavailable */
    }
    // leave the frame until printing dialogs close; clean up quietly later
    setTimeout(() => frame.remove(), 60000)
  }
}
