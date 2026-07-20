/* ------------------------------------------------------------------ *
 * Per-activity drafts — a kid's half-finished work must survive a
 * reload, an accidental back-tap, or the app being closed. Drafts are
 * small replayable state (ops lists, fill orders, stroke lists), never
 * big bitmaps (the one exception: the CBN photo as a compact data-URL).
 * localStorage; every call degrades to a no-op if storage is missing.
 * ------------------------------------------------------------------ */

import { activeProfileId } from './profiles'

const key = (kit: string) => `emd_p_${activeProfileId()}_draft_${kit}`

export function loadDraft<T>(kit: string): T | null {
  try {
    const raw = localStorage.getItem(key(kit))
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function saveDraft(kit: string, data: unknown): void {
  try {
    localStorage.setItem(key(kit), JSON.stringify(data))
  } catch {
    /* quota / private mode — losing a draft beats breaking play */
  }
}

export function clearDraft(kit: string): void {
  try {
    localStorage.removeItem(key(kit))
  } catch {
    /* ignore */
  }
}
