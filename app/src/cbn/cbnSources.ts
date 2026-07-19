/* ------------------------------------------------------------------ *
 * Source pictures for paint-by-numbers, bundled under public/cbn/. The
 * screen loads each (PNG or SVG — both decode through an <img> and draw
 * to the working canvas), then pbn.ts quantizes + facets the pixels into
 * numbered regions. PNGs carry painterly gradients that posterize into
 * many bands; SVGs give crisp flat regions. To add one: drop a .png/.svg
 * (portrait ~150×188) in public/cbn/ and add an entry here.
 * ------------------------------------------------------------------ */

export interface CbnAsset {
  id: string
  name: string
  src: string
}

const base = import.meta.env.BASE_URL || '/'

export const CBN_ASSETS: CbnAsset[] = [
  { id: 'sunset', name: 'Sunset', src: `${base}cbn/sunset.png` },
  { id: 'beach', name: 'Beach', src: `${base}cbn/beach.png` },
  { id: 'balloon', name: 'Balloon', src: `${base}cbn/balloon.svg` },
  { id: 'flower', name: 'Flower', src: `${base}cbn/flower.svg` },
  { id: 'rocket', name: 'Rocket', src: `${base}cbn/rocket.svg` },
  { id: 'cat', name: 'Cat', src: `${base}cbn/cat.svg` },
]
