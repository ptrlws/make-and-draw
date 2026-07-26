import type { KitId } from '../types'

/**
 * The eight kits on the shelf.
 *
 * There is no artwork field any more: a kit's tile is either the child's own
 * most recent piece from it, or that activity's real materials laid out ready
 * (see components/KitSurface.tsx). Nothing here needs a colour, because the
 * shell owns none.
 */
export interface KitDef {
  id: KitId
  label: string
  /** playable now vs "in the press" (coming soon) */
  ready: boolean
  /** one-line studio-voice description shown on the tile */
  blurb: string
}

export const KITS: KitDef[] = [
  { id: 'marble', label: 'marble inks', ready: true, blurb: 'dip toys in swirling ink' },
  { id: 'cbn', label: 'colour by number', ready: true, blurb: 'fill the numbers, print it' },
  { id: 'pattern', label: 'pattern lab', ready: true, blurb: 'spin a kaleidoscope tile' },
  { id: 'print', label: 'print shop', ready: true, blurb: 'overprint bold stamps' },
  { id: 'dot', label: 'dot-to-dot', ready: true, blurb: 'join the dots, reveal it' },
  { id: 'sticker', label: 'stickers', ready: true, blurb: 'peel & arrange stickers' },
  { id: 'butterfly', label: 'butterflies', ready: true, blurb: 'paint one wing, mirror it' },
  { id: 'scratch', label: 'scratch art', ready: true, blurb: 'scratch off to find rainbows' },
]
