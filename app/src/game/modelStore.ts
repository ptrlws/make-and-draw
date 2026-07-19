/* ------------------------------------------------------------------ *
 * Persists the user's last-imported STL model (their own local file —
 * never uploaded/redistributed) in IndexedDB so it survives reloads.
 * Degrades to a no-op if IndexedDB is unavailable.
 * ------------------------------------------------------------------ */

const DB_NAME = 'emd_model'
const STORE = 'stl'
const KEY = 'current'
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

export interface StoredModel {
  name: string
  bytes: ArrayBuffer
}

export async function putModel(name: string, bytes: ArrayBuffer): Promise<void> {
  const db = await open()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put({ name, bytes }, KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
}

export async function getModel(): Promise<StoredModel | null> {
  const db = await open()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly')
      const r = tx.objectStore(STORE).get(KEY)
      r.onsuccess = () => {
        const v = r.result
        resolve(v && v.bytes ? (v as StoredModel) : null)
      }
      r.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

export async function clearModel(): Promise<void> {
  const db = await open()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}
