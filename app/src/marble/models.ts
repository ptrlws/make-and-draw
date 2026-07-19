/* ------------------------------------------------------------------ *
 * Default dippable STL models, bundled under public/models/. Loaded at
 * runtime and registered with the MarbleStudio so they appear in the
 * dip tray. Add an entry + drop an .stl in public/models/ to add one.
 *
 * Attribution (see /CREDITS.md): low-poly cat & dog © Matthias L
 * (Printables) — free for personal use; commercial use needs the
 * author's Patreon "Low Poly Commercial License" tier.
 * ------------------------------------------------------------------ */

export interface DipModel {
  /** cache id used by MarbleStudio.dip(id) */
  id: string
  /** child-facing chip label */
  name: string
  /** pictorial chip prefix so pre-readers can pick without reading */
  emoji: string
  /** URL under the served public/ root */
  src: string
}

const base = import.meta.env.BASE_URL || '/'

export const STL_MODELS: DipModel[] = [
  { id: 'cat', name: 'Cat', emoji: '🐈', src: `${base}models/cat.stl` },
  { id: 'dog', name: 'Dog', emoji: '🐕', src: `${base}models/dog.stl` },
]
