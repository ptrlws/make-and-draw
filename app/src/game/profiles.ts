/* ------------------------------------------------------------------ *
 * Multiple makers on one device. Each profile owns its own name,
 * collection, in-progress drafts, stock sheets and settings — all under
 * an `emd_p_<id>_…` key namespace. A tiny registry (`emd_profiles`)
 * tracks the list + who's active. On first run we migrate the old
 * single-user data (emd_v1 + emd_draft_* + emd_stock_*) into profile #1,
 * so nobody loses work.
 * ------------------------------------------------------------------ */

export interface Profile {
  id: string
  name: string | null
  color: string
}

interface Registry {
  v: 1
  activeId: string
  list: Profile[]
}

const REG_KEY = 'emd_profiles'
const LEGACY_STATE = 'emd_v1'
// bold spot inks, cycled so each maker gets a distinct colour to recognise
const COLORS = ['#ff2e7e', '#0a5af5', '#ffb800', '#00a58a', '#8f3ac0', '#ff7a1a']

let cache: Registry | null = null

function makeId(): string {
  return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function readReg(): Registry | null {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(REG_KEY)
    if (!raw) return null
    const r = JSON.parse(raw) as Registry
    if (r && Array.isArray(r.list) && r.list.length) {
      cache = r
      return r
    }
  } catch {
    /* corrupt registry — treated as absent */
  }
  return null
}

export function writeRegistry(activeId: string, list: Profile[]): void {
  const r: Registry = { v: 1, activeId, list }
  cache = r
  try {
    localStorage.setItem(REG_KEY, JSON.stringify(r))
  } catch {
    /* ignore quota / private mode */
  }
}

/** localStorage key holding a profile's persisted state ({muted,calm,gallery}). */
export function stateKey(id: string): string {
  return `emd_p_${id}`
}

/** The active maker's id — draftStore + stock namespace their keys by this. */
export function activeProfileId(): string {
  return readReg()?.activeId ?? 'default'
}

const newColor = (count: number) => COLORS[count % COLORS.length]

/** Ensure a registry exists; migrate legacy single-user data on first run. */
export function ensureProfiles(): Registry {
  const existing = readReg()
  if (existing) return existing
  const id = makeId()
  let name: string | null = null
  try {
    const legacy = localStorage.getItem(LEGACY_STATE)
    if (legacy) {
      // the old state blob is already the per-profile shape (muted/calm/gallery)
      localStorage.setItem(stateKey(id), legacy)
      try {
        name = (JSON.parse(legacy) as { name?: string | null }).name ?? null
      } catch {
        /* ignore */
      }
    }
    // carry any half-finished drafts + stock sheets into the new namespace
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k) continue
      if (k.startsWith('emd_draft_')) {
        const v = localStorage.getItem(k)
        if (v != null) localStorage.setItem(`emd_p_${id}_draft_${k.slice('emd_draft_'.length)}`, v)
      } else if (k.startsWith('emd_stock_')) {
        const v = localStorage.getItem(k)
        if (v != null) localStorage.setItem(`emd_p_${id}_stock_${k.slice('emd_stock_'.length)}`, v)
      }
    }
  } catch {
    /* storage unavailable — a fresh profile is still fine */
  }
  const reg: Registry = { v: 1, activeId: id, list: [{ id, name, color: COLORS[0] }] }
  cache = reg
  try {
    localStorage.setItem(REG_KEY, JSON.stringify(reg))
  } catch {
    /* ignore */
  }
  return reg
}

/** Create a new (unnamed) maker and make them active. Returns the new id. */
export function createProfile(): string {
  const reg = readReg() ?? ensureProfiles()
  const id = makeId()
  writeRegistry(id, [...reg.list, { id, name: null, color: newColor(reg.list.length) }])
  return id
}

export function setActiveProfile(id: string): void {
  const reg = readReg()
  if (reg && reg.list.some((p) => p.id === id)) writeRegistry(id, reg.list)
}

/** Wipe a maker's data + registry entry. `dropImages` removes their gallery
 * thumbnails from IndexedDB. Returns the id that should now be active. */
export function removeProfile(id: string, dropImages: (ids: string[]) => void): string {
  const reg = readReg() ?? ensureProfiles()
  // gather this profile's gallery image ids before wiping its state
  try {
    const raw = localStorage.getItem(stateKey(id))
    if (raw) {
      const g = (JSON.parse(raw) as { gallery?: { id: string }[] }).gallery ?? []
      dropImages(g.map((x) => x.id))
    }
  } catch {
    /* ignore */
  }
  // remove state + every draft/stock key under this profile
  try {
    const prefix = stateKey(id)
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && (k === prefix || k.startsWith(prefix + '_'))) toRemove.push(k)
    }
    for (const k of toRemove) localStorage.removeItem(k)
  } catch {
    /* ignore */
  }
  const list = reg.list.filter((p) => p.id !== id)
  if (list.length === 0) {
    // never leave zero makers — mint a fresh empty one
    const nid = makeId()
    writeRegistry(nid, [{ id: nid, name: null, color: COLORS[0] }])
    return nid
  }
  const activeId = reg.activeId === id ? list[0].id : reg.activeId
  writeRegistry(activeId, list)
  return activeId
}
