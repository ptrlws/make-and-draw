/* ------------------------------------------------------------------ *
 * The studio's paper stock — kits feed each other. A kept Pattern tile
 * becomes a sticker-board background; kept marbled paper becomes Print
 * Shop stock. Stored small (512px JPEG) in localStorage.
 * ------------------------------------------------------------------ */

import { activeProfileId } from './profiles'

export type StockKey = 'pattern' | 'marble'

const key = (k: StockKey) => `emd_p_${activeProfileId()}_stock_${k}`

export function loadStock(k: StockKey): string | null {
  try {
    return localStorage.getItem(key(k))
  } catch {
    return null
  }
}

/** Shrink + store a stock sheet (fire-and-forget). */
export function saveStock(k: StockKey, dataUrl: string): void {
  const img = new Image()
  img.onload = () => {
    try {
      const s = 512 / Math.max(img.width, img.height, 1)
      const cv = document.createElement('canvas')
      cv.width = Math.max(2, Math.round(img.width * Math.min(1, s)))
      cv.height = Math.max(2, Math.round(img.height * Math.min(1, s)))
      const ctx = cv.getContext('2d')!
      ctx.fillStyle = '#f4f1e7'
      ctx.fillRect(0, 0, cv.width, cv.height)
      ctx.drawImage(img, 0, 0, cv.width, cv.height)
      localStorage.setItem(key(k), cv.toDataURL('image/jpeg', 0.82))
    } catch {
      /* quota — the link is a bonus, never an error */
    }
  }
  img.src = dataUrl
}
