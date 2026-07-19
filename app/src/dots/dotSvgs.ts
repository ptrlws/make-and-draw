/* ------------------------------------------------------------------ *
 * Dot-to-dot line drawings, bundled under public/dots/. Loaded at
 * runtime and turned into join-the-dots puzzles (see DotToDot's
 * svgToPuzzle: samples the longest path, fits it, auto-places numbered
 * dots). To add one: drop a single-outline .svg in public/dots/ and add
 * an entry here. Any SVG with one continuous outline path works best.
 * ------------------------------------------------------------------ */

export interface DotSvg {
  id: string
  name: string
  src: string
}

const base = import.meta.env.BASE_URL || '/'

export const DOT_SVGS: DotSvg[] = [
  { id: 'cat', name: 'Cat', src: `${base}dots/cat.svg` },
  { id: 'fish', name: 'Fish', src: `${base}dots/fish.svg` },
  { id: 'rocket', name: 'Rocket', src: `${base}dots/rocket.svg` },
  { id: 'star', name: 'Star', src: `${base}dots/star.svg` },
  { id: 'heart', name: 'Heart', src: `${base}dots/heart.svg` },
]
