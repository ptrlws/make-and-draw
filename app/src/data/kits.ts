import type { KitId } from '../types'

/**
 * Artwork slot for a shelf card. The diagonal-stripe swatches are the
 * documented placeholders for Esther's real drawings — swap any entry to
 * `{ kind: 'image', src }` (one illustration per kit) to drop real art in.
 * `numbers` / `dot` are bespoke non-placeholder motifs, as in the design.
 */
export type KitArt =
  | { kind: 'stripe'; color: string; color2: string }
  | { kind: 'numbers' }
  | { kind: 'dot' }
  | { kind: 'image'; src: string }

export interface KitDef {
  id: KitId
  label: string
  /** playable now (full card) vs "in the press" (muted, coming soon) */
  ready: boolean
  /** one-line studio-voice description shown on the tile */
  blurb: string
  /** washi-tape colour + rotation */
  tape: string
  tapeRot: number
  /** card wobble + asymmetric corner radii */
  cardRot: number
  radius: string
  art: KitArt
}

export const KITS: KitDef[] = [
  {
    id: 'marble',
    label: 'marble inks',
    ready: true,
    blurb: 'dip toys in swirling ink',
    tape: 'rgba(47,184,179,.5)',
    tapeRot: -4,
    cardRot: -2,
    radius: '20px 15px 22px 16px',
    art: { kind: 'stripe', color: '#2fb8b3', color2: '#5fd0cb' },
  },
  {
    id: 'cbn',
    label: 'colour by number',
    ready: true,
    blurb: 'fill the numbers, print it',
    tape: 'rgba(63,143,214,.5)',
    tapeRot: 5,
    cardRot: 1.8,
    radius: '16px 21px 15px 22px',
    art: { kind: 'numbers' },
  },
  {
    id: 'pattern',
    label: 'pattern lab',
    ready: true,
    blurb: 'spin a kaleidoscope tile',
    tape: 'rgba(255,46,126,.5)',
    tapeRot: -3,
    cardRot: 1.2,
    radius: '20px 16px 21px 15px',
    art: { kind: 'stripe', color: '#ff2e7e', color2: '#0a5af5' },
  },
  {
    id: 'print',
    label: 'print shop',
    ready: true,
    blurb: 'overprint bold stamps',
    tape: 'rgba(255,184,0,.5)',
    tapeRot: 4,
    cardRot: -1.4,
    radius: '16px 21px 16px 20px',
    art: { kind: 'stripe', color: '#ffb800', color2: '#00a58a' },
  },
  {
    id: 'dot',
    label: 'dot-to-dot',
    ready: true,
    blurb: 'join the dots, reveal it',
    tape: 'rgba(244,192,38,.55)',
    tapeRot: -5,
    cardRot: 2,
    radius: '21px 15px 22px 16px',
    art: { kind: 'dot' },
  },
  {
    id: 'sticker',
    label: 'stickers',
    ready: true,
    blurb: 'peel & arrange stickers',
    tape: 'rgba(154,107,209,.5)',
    tapeRot: -4,
    cardRot: 1.5,
    radius: '22px 16px 21px 15px',
    art: { kind: 'stripe', color: '#9a6bd1', color2: '#b795dd' },
  },
  {
    id: 'butterfly',
    label: 'butterflies',
    ready: true,
    blurb: 'paint one wing, mirror it',
    tape: 'rgba(242,145,61,.55)',
    tapeRot: 5,
    cardRot: -2,
    radius: '15px 22px 16px 21px',
    art: { kind: 'stripe', color: '#f2913d', color2: '#f7b479' },
  },
  {
    id: 'scratch',
    label: 'scratch art',
    ready: true,
    blurb: 'scratch off to find rainbows',
    tape: 'rgba(22,19,15,.5)',
    tapeRot: -5,
    cardRot: 1.6,
    radius: '20px 16px 21px 15px',
    art: { kind: 'stripe', color: '#16130f', color2: '#3a352c' },
  },
]
