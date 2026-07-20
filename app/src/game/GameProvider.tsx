import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'
import { readConfig, type Config } from '../config'
import { Foley } from '../audio/foley'
import { useReducedMotion } from '../hooks/useReducedMotion'
import type { GalleryItem, KitId, Screen, Sound } from '../types'
import { buildParticles, poss } from '../utils'
import { GameContext, type FinishInput, type GameApi } from './context'
import { clearImages, deleteImage, getImages, putImage } from './imageStore'
import { createProfile, ensureProfiles, removeProfile, setActiveProfile, stateKey, writeRegistry } from './profiles'
import { reducer, type GameState } from './state'

/** Seed state from the active maker's localStorage (+ dev config) synchronously
 * — no first-paint flash. Migrates legacy single-user data on first run. */
function createInitialState(config: Config): GameState {
  const reg = ensureProfiles()
  const active = reg.list.find((p) => p.id === reg.activeId) ?? reg.list[0]
  let saved: Partial<GameState> = {}
  try {
    saved = JSON.parse(localStorage.getItem(stateKey(active.id)) || '{}') || {}
  } catch {
    /* corrupt / unavailable storage — fall back to defaults */
  }
  const name = active.name
  const screen: Screen = name ? 'home' : config.skipNameEntry ? 'home' : 'name'
  return {
    ready: true,
    name,
    screen,
    muted: saved.muted != null ? saved.muted : config.sound === false,
    calm: saved.calm != null ? saved.calm : config.calmMode,
    settingsOpen: false,
    gallery: saved.gallery ?? [], // start empty — only real creations, no fake samples
    toast: null,
    finishing: null,
    justAdded: false,
    profiles: reg.list,
    profileId: active.id,
  }
}

export function GameProvider({ children }: { children: ReactNode }) {
  const config = useMemo(() => readConfig(), [])
  const reducedMotion = useReducedMotion()

  const [state, dispatch] = useReducer(reducer, config, createInitialState)

  // Latest state for callbacks that must not close over stale values.
  const stateRef = useRef(state)
  stateRef.current = state
  const reducedRef = useRef(reducedMotion)
  reducedRef.current = reducedMotion

  const foley = useMemo(() => new Foley(), [])
  const finishTimers = useRef<number[]>([])
  const toastTimer = useRef<number | undefined>(undefined)

  // ---- persist the saved subset whenever it changes ----
  // Gallery images live in IndexedDB (see imageStore); localStorage keeps only
  // small metadata so it never approaches the ~5MB quota.
  useEffect(() => {
    if (!state.ready) return
    try {
      localStorage.setItem(
        stateKey(state.profileId),
        JSON.stringify({
          muted: state.muted,
          calm: state.calm,
          gallery: state.gallery.map((g) => ({ id: g.id, type: g.type, title: g.title, tint: g.tint, fills: g.fills })),
        }),
      )
    } catch {
      /* ignore quota / private-mode errors */
    }
    // keep the maker registry's name/colour in sync (e.g. after a rename)
    writeRegistry(state.profileId, state.profiles)
  }, [state.ready, state.muted, state.calm, state.gallery, state.profileId, state.profiles])

  // ---- migrate any inline images to IndexedDB, then hydrate the rest ----
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const g = stateRef.current.gallery
      if (g.length === 0) return
      // one-time migration of the old localStorage format (images stored inline)
      for (const it of g) if (it.img) await putImage(it.id, it.img)
      // items loaded from metadata-only storage need their image fetched
      const missing = g.filter((it) => !it.img).map((it) => it.id)
      if (missing.length === 0) return
      const imgs = await getImages(missing)
      if (!cancelled && Object.keys(imgs).length) dispatch({ t: 'HYDRATE_IMAGES', imgs })
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // ---- tidy up timers on unmount ----
  useEffect(
    () => () => {
      finishTimers.current.forEach(clearTimeout)
      clearTimeout(toastTimer.current)
    },
    [],
  )

  const ensureAudio = useCallback(() => {
    foley.ensure()
    foley.resume()
  }, [foley])

  const play = useCallback(
    (sound: Sound, pitch = 1) => {
      // every play call is gesture-driven, so it may lazily unlock audio too —
      // otherwise the first sounds after a resumed session stay silent
      foley.ensure()
      foley.resume()
      foley.play(sound, stateRef.current.muted, stateRef.current.calm, pitch)
    },
    [foley],
  )

  const showToast = useCallback((msg: string) => {
    dispatch({ t: 'SET_TOAST', toast: msg })
    clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(
      () => dispatch({ t: 'SET_TOAST', toast: null }),
      1900,
    )
  }, [])

  // ---- browser-history integration: the system back button/gesture moves
  // within the app instead of exiting it (the #1 phone-first expectation). ----
  const pushNav = useCallback((screen: Screen) => {
    try {
      window.history.pushState({ emd: screen }, '')
    } catch {
      /* history unavailable (rare embeds) — in-app nav still works */
    }
  }, [])
  useEffect(() => {
    try {
      window.history.replaceState({ emd: stateRef.current.screen }, '')
    } catch {
      /* ignore */
    }
    const onPop = (e: PopStateEvent) => {
      const screen = (e.state && (e.state as { emd?: Screen }).emd) || 'home'
      dispatch({ t: 'SET_SCREEN', screen })
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const go = useCallback(
    (screen: Screen) => {
      ensureAudio()
      pushNav(screen)
      dispatch({ t: 'SET_SCREEN', screen })
    },
    [ensureAudio, pushNav],
  )

  const openKit = useCallback(
    (kit: KitId) => {
      ensureAudio()
      play('page')
      pushNav(kit)
      dispatch({ t: 'SET_SCREEN', screen: kit })
    },
    [ensureAudio, play, pushNav],
  )

  const confirmName = useCallback(
    (raw: string) => {
      ensureAudio()
      const name = raw.trim().slice(0, 14) || null
      pushNav('home')
      dispatch({ t: 'CONFIRM_NAME', name })
      play('pop')
    },
    [ensureAudio, play, pushNav],
  )

  const openBook = useCallback(() => {
    ensureAudio()
    pushNav('book')
    dispatch({ t: 'SET_SCREEN', screen: 'book' })
  }, [ensureAudio, pushNav])

  const openSettings = useCallback(() => dispatch({ t: 'OPEN_SETTINGS' }), [])
  const closeSettings = useCallback(() => dispatch({ t: 'CLOSE_SETTINGS' }), [])

  const toggleMute = useCallback(() => {
    ensureAudio()
    dispatch({ t: 'TOGGLE_MUTED' })
  }, [ensureAudio])

  const toggleCalm = useCallback(() => dispatch({ t: 'TOGGLE_CALM' }), [])

  // ---- the signature finishing ritual: gather -> burst -> fly -> book ----
  const startFinish = useCallback(
    (item: FinishInput) => {
      ensureAudio()
      const calm = stateRef.current.calm || reducedRef.current
      const parts = buildParticles(calm)

      // Save FIRST, celebrate after — closing the app mid-ritual can never
      // lose the piece. The ritual timers below are purely presentational.
      const gItem: GalleryItem = {
        id: 'g' + Date.now(),
        type: item.type,
        title: item.title,
        tint: item.tint,
        img: item.img,
        fills: item.fills,
      }
      dispatch({ t: 'GALLERY_ADD', item: gItem })
      if (gItem.img) {
        // thumbnail → IndexedDB; if the write fails, say so honestly instead
        // of celebrating a save that didn't happen
        void putImage(gItem.id, gItem.img).then((ok) => {
          if (!ok) showToast("heads up — this device couldn't store the picture")
        })
      }

      dispatch({
        t: 'FINISH_START',
        finishing: { ...item, phase: 'gather', parts, calm },
      })
      play('gather') // soft ascending swell opens the ritual

      finishTimers.current.forEach(clearTimeout)
      finishTimers.current = [
        window.setTimeout(() => {
          dispatch({ t: 'FINISH_PHASE', phase: 'burst' })
          play('fw')
        }, 420),
        window.setTimeout(() => {
          const name = stateRef.current.name
          dispatch({
            t: 'FINISH_PHASE',
            phase: 'fly',
            text: `into ${poss(name)} book!`,
          })
          play('page', 0.8) // paper whoosh as the piece flies to the book
        }, 1550),
        window.setTimeout(() => {
          const name = stateRef.current.name
          pushNav('book')
          dispatch({ t: 'FINISH_LAND' })
          play('chime') // warm "shelved" chime as it lands in the book
          // collection milestones land as their own little celebration
          const count = stateRef.current.gallery.length
          const M: Record<number, string> = {
            1: 'your very first make! ⭐',
            3: 'three things made! ✨',
            5: 'five! the shelf is filling up ⭐',
            10: 'TEN things made! ⭐⭐',
            20: 'twenty — a real collection! ⭐⭐⭐',
            50: 'FIFTY?! studio legend ⭐',
          }
          showToast(M[count] ?? `added to ${poss(name)} book!`)
        }, 2600),
      ]
    },
    [ensureAudio, play, showToast, pushNav],
  )

  const removeCreation = useCallback((id: string) => {
    dispatch({ t: 'REMOVE_ITEM', id })
    void deleteImage(id)
  }, [])

  // undo of a remove — puts the piece back exactly where it was
  const restoreCreation = useCallback((item: GalleryItem, index: number) => {
    dispatch({ t: 'GALLERY_INSERT', item, index })
    if (item.img) void putImage(item.id, item.img)
  }, [])

  // restore a backup file: append valid, non-duplicate pieces
  const importCollection = useCallback(async (items: GalleryItem[]): Promise<number> => {
    const have = new Set(stateRef.current.gallery.map((g) => g.id))
    let added = 0
    for (const raw of items) {
      if (!raw || typeof raw.id !== 'string' || typeof raw.title !== 'string' || have.has(raw.id)) continue
      const item: GalleryItem = {
        id: raw.id,
        type: raw.type,
        title: raw.title.slice(0, 60),
        tint: typeof raw.tint === 'string' ? raw.tint : '#f2779f',
        img: typeof raw.img === 'string' ? raw.img : undefined,
        fills: raw.fills,
      }
      dispatch({ t: 'GALLERY_INSERT', item, index: Number.MAX_SAFE_INTEGER })
      if (item.img) await putImage(item.id, item.img)
      have.add(item.id)
      added++
    }
    return added
  }, [])

  const clearCollection = useCallback(() => {
    dispatch({ t: 'CLEAR_GALLERY' })
    void clearImages()
  }, [])

  // ---- makers: switching / adding / deleting reloads into a clean studio, so
  // each maker's screen state, drafts and audio start from a known-good base ----
  const switchProfile = useCallback((id: string) => {
    if (id === stateRef.current.profileId) {
      go('home')
      return
    }
    setActiveProfile(id)
    location.reload()
  }, [go])

  const addProfile = useCallback(() => {
    createProfile() // unnamed + active → the reload lands on name entry
    location.reload()
  }, [])

  const deleteProfile = useCallback((id: string) => {
    const dropImages = (ids: string[]) => {
      for (const gid of ids) void deleteImage(gid)
    }
    removeProfile(id, dropImages)
    location.reload()
  }, [])

  const api = useMemo<GameApi>(
    () => ({
      state,
      config,
      reducedMotion,
      play,
      showToast,
      go,
      openKit,
      confirmName,
      openBook,
      openSettings,
      closeSettings,
      toggleMute,
      toggleCalm,
      startFinish,
      removeCreation,
      restoreCreation,
      importCollection,
      clearCollection,
      switchProfile,
      addProfile,
      deleteProfile,
    }),
    [
      state,
      config,
      reducedMotion,
      play,
      showToast,
      go,
      openKit,
      confirmName,
      openBook,
      openSettings,
      closeSettings,
      toggleMute,
      toggleCalm,
      startFinish,
      removeCreation,
      restoreCreation,
      importCollection,
      clearCollection,
      switchProfile,
      addProfile,
      deleteProfile,
    ],
  )

  return <GameContext.Provider value={api}>{children}</GameContext.Provider>
}
