/* ------------------------------------------------------------------ *
 * Gallery thumbnail store — IndexedDB (large quota) so localStorage
 * only carries small metadata. Every call degrades gracefully to a
 * no-op if IndexedDB is unavailable (private mode / old browser), so
 * the app still works; images just won't persist across reloads.
 * ------------------------------------------------------------------ */

const DB_NAME = 'emd_images'
const STORE = 'img'
let dbPromise: Promise<IDBDatabase | null> | null = null

function open(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

/** Store one thumbnail data-URL under its gallery-item id.
 * Resolves false when the write could not happen (no IDB / quota / abort) so
 * callers can be honest with the user instead of claiming a phantom save. */
export async function putImage(id: string, dataUrl: string): Promise<boolean> {
  const db = await open()
  if (!db) return false
  return new Promise<boolean>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(dataUrl, id)
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
      tx.onabort = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
}

/** Fetch thumbnails for the given ids → { id: dataUrl } (missing ids omitted). */
export async function getImages(ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  const db = await open()
  if (!db || ids.length === 0) return out
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly')
      const store = tx.objectStore(STORE)
      let pending = ids.length
      const done = () => {
        if (--pending === 0) resolve()
      }
      for (const id of ids) {
        const r = store.get(id)
        r.onsuccess = () => {
          if (typeof r.result === 'string') out[id] = r.result
          done()
        }
        r.onerror = done
      }
      tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
  return out
}

/** Remove a thumbnail (e.g. when its gallery item is deleted). */
export async function deleteImage(id: string): Promise<void> {
  const db = await open()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
}

/** Wipe every stored thumbnail (clear the whole collection). */
export async function clearImages(): Promise<void> {
  const db = await open()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
}
