import type {
  FinishPhase,
  Finishing,
  GalleryItem,
  Screen,
} from '../types'

/**
 * Global, cross-screen state. Per-activity state (marble ink/phase, CBN
 * fills, book page) lives locally in each screen component — this holds only
 * what is shared or persisted.
 */
export interface GameState {
  ready: boolean
  name: string | null
  screen: Screen
  muted: boolean
  calm: boolean
  settingsOpen: boolean
  gallery: GalleryItem[]
  toast: string | null
  finishing: Finishing | null
  /** true for the single render after a creation is committed, so the Book
   * opens straight onto the new piece instead of the cover. */
  justAdded: boolean
}

export const initialState: GameState = {
  ready: false,
  name: null,
  screen: 'name',
  muted: false,
  calm: false,
  settingsOpen: false,
  gallery: [],
  toast: null,
  finishing: null,
  justAdded: false,
}

export type Action =
  | { t: 'HYDRATE'; patch: Partial<GameState> }
  | { t: 'SET_SCREEN'; screen: Screen }
  | { t: 'CONFIRM_NAME'; name: string | null }
  | { t: 'TOGGLE_MUTED' }
  | { t: 'TOGGLE_CALM' }
  | { t: 'OPEN_SETTINGS' }
  | { t: 'CLOSE_SETTINGS' }
  | { t: 'SET_TOAST'; toast: string | null }
  | { t: 'FINISH_START'; finishing: Finishing }
  | { t: 'FINISH_PHASE'; phase: FinishPhase; text?: string }
  /** The piece is saved the instant the ritual starts — a crash or close
   * during the celebration can never lose it. */
  | { t: 'GALLERY_ADD'; item: GalleryItem }
  /** Undo of a remove: put the piece back where it was. */
  | { t: 'GALLERY_INSERT'; item: GalleryItem; index: number }
  /** Ritual finished: close the overlay and land in the book. */
  | { t: 'FINISH_LAND' }
  | { t: 'HYDRATE_IMAGES'; imgs: Record<string, string> }
  | { t: 'REMOVE_ITEM'; id: string }
  | { t: 'CLEAR_GALLERY' }

export function reducer(s: GameState, a: Action): GameState {
  switch (a.t) {
    case 'HYDRATE':
      return { ...s, ...a.patch }
    case 'SET_SCREEN':
      return { ...s, screen: a.screen, settingsOpen: false, justAdded: false }
    case 'CONFIRM_NAME':
      return { ...s, name: a.name, screen: 'home', settingsOpen: false }
    case 'TOGGLE_MUTED':
      return { ...s, muted: !s.muted }
    case 'TOGGLE_CALM':
      return { ...s, calm: !s.calm }
    case 'OPEN_SETTINGS':
      return { ...s, settingsOpen: true }
    case 'CLOSE_SETTINGS':
      return { ...s, settingsOpen: false }
    case 'SET_TOAST':
      return { ...s, toast: a.toast }
    case 'FINISH_START':
      return { ...s, finishing: a.finishing }
    case 'FINISH_PHASE':
      return s.finishing
        ? {
            ...s,
            finishing: {
              ...s.finishing,
              phase: a.phase,
              ...(a.text !== undefined ? { text: a.text } : {}),
            },
          }
        : s
    case 'HYDRATE_IMAGES':
      return {
        ...s,
        gallery: s.gallery.map((g) => (a.imgs[g.id] ? { ...g, img: a.imgs[g.id] } : g)),
      }
    case 'REMOVE_ITEM':
      return { ...s, gallery: s.gallery.filter((g) => g.id !== a.id) }
    case 'CLEAR_GALLERY':
      return { ...s, gallery: [], justAdded: false }
    case 'GALLERY_ADD':
      return { ...s, gallery: [a.item, ...s.gallery] }
    case 'GALLERY_INSERT': {
      const g = s.gallery.slice()
      g.splice(Math.max(0, Math.min(a.index, g.length)), 0, a.item)
      return { ...s, gallery: g }
    }
    case 'FINISH_LAND':
      return {
        ...s,
        finishing: null,
        screen: 'book',
        settingsOpen: false,
        justAdded: true,
      }
    default:
      return s
  }
}
