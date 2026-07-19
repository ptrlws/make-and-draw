export type Screen = 'name' | 'home' | 'marble' | 'cbn' | 'pattern' | 'print' | 'sticker' | 'dot' | 'butterfly' | 'scratch' | 'book' | 'grownups'

/** Every kit tile on the shelf — all playable. */
export type KitId = 'marble' | 'cbn' | 'pattern' | 'print' | 'dot' | 'sticker' | 'butterfly' | 'scratch'

/** Creation types that can live in the gallery book. */
export type GalleryType = 'marble' | 'cbn' | 'pattern' | 'print' | 'dot' | 'sticker' | 'jigsaw' | 'butterfly' | 'scratch'

export type Difficulty = 'easy' | 'medium' | 'hard'

/** Marble activity phases: painting, then the print or dip-a-toy sequence. */
export type MarblePhase = 'paint' | 'lower' | 'peel' | 'print' | 'toy'

export type Sound =
  | 'drip'
  | 'swirl'
  | 'pop'
  | 'page'
  | 'wrong'
  | 'fw'
  | 'lift'
  | 'chime'
  | 'select'
  | 'gather'
  | 'fold'
  | 'press'
  | 'peel'
  | 'climax'
  | 'step'
  | 'scratch'

export interface GalleryItem {
  id: string
  type: GalleryType
  title: string
  tint: string
  /** data-URL thumbnail for marble prints / marbled toys */
  img?: string
  /** CBN region -> pot number (kept for possible re-render of the print) */
  fills?: Record<string, number>
}

/** One firework / confetti speck in the finishing ritual. */
export interface Particle {
  tx: number
  ty: number
  tr: string
  c: string
  d: number
  delay: number
}

export type FinishPhase = 'gather' | 'burst' | 'fly'

export interface Finishing {
  type: GalleryType
  title: string
  tint: string
  img?: string
  fills?: Record<string, number>
  phase: FinishPhase
  parts: Particle[]
  calm: boolean
  text?: string
}
