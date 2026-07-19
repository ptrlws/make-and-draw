/* ------------------------------------------------------------------ *
 * Design tokens — "Print-shop / Riso" direction (C).
 * Limited fluoro spot inks, hard ink outlines, offset registration
 * shadows, paper + halftone grain, bold poster type.
 * ------------------------------------------------------------------ */

import type { CSSProperties } from 'react'

export const c = {
  ink: '#16130f', // text + all outlines
  inkSoft: '#3a352c',

  // spot inks (overprint via multiply)
  pink: '#ff2e7e',
  blue: '#0a5af5',
  yellow: '#ffb800',
  teal: '#00a58a',

  // primary accent = pink (legacy name `coral` kept so older screens still compile)
  coral: '#ff2e7e',
  coralDark: '#d81b60',
  sunshine: '#ffb800',

  // paper grounds
  paper: '#f4f1e7',
  paperBody: '#ebe7d9',
  paperBook: '#efe9da',
  card: '#faf8f0',
  cardAlt: '#ffffff',
  headerWash: 'rgba(244,241,231,.92)',

  disabled: '#c7c1b2',

  hint: '#6f675a',
  prompt: '#4a4335',
  sub: '#6f675a',
  faint: '#9a9078',

  green: '#00a58a', // success / toggle-on (teal ink)
  toggleOff: '#d9d3c4',
} as const

/** Spot inks in rotation order, for cycling tile accents. */
export const SPOT = [c.pink, c.blue, c.yellow, c.teal] as const

export const fonts = {
  display: "'Anton', 'Arial Narrow', 'Haettenschweiler', sans-serif", // heavy condensed poster
  body: "'Inter Variable', Inter, system-ui, sans-serif",
  // legacy alias (there is no more hand-lettering in the Riso direction)
  hand: "'Inter Variable', Inter, system-ui, sans-serif",
} as const

export const shadows = {
  card: '5px 5px 0 #16130f', // hard registration-offset
  cardSoft: '4px 4px 0 rgba(22,19,15,.85)',
  drop: '0 4px 0 #16130f',
  dropSm: '0 3px 0 #16130f',
  dropLg: '0 5px 0 #16130f',
} as const

/** Warm paper with a faint halftone grain. */
export const paperTexture: CSSProperties = {
  background: c.paper,
  backgroundImage: 'radial-gradient(rgba(22,19,15,.05) 0.5px, transparent 0.6px)',
  backgroundSize: '3px 3px',
}

/** A tileable halftone dot overlay in a given ink, for print texture. */
export function halftone(color: string, size = 5): CSSProperties {
  return {
    backgroundImage: `radial-gradient(${color} 22%, transparent 23%)`,
    backgroundSize: `${size}px ${size}px`,
  }
}

/* ---- Activity palettes (consumed by the canvas + CBN logic) ---- */

export interface Ink {
  c: string
  d: string
}

/** Marble inks — the riso spot set. */
export const INKS: Ink[] = [
  { c: '#ff2e7e', d: '#d81b60' },
  { c: '#0a5af5', d: '#0842b0' },
  { c: '#ffb800', d: '#d99500' },
  { c: '#00a58a', d: '#007a66' },
]

export interface Pot {
  c: string
  d: string
  n: number
}

/** Colour-by-number pots, keyed by numeral. */
export const POTS: Pot[] = [
  { c: '#ffb800', d: '#d99500', n: 1 },
  { c: '#ff2e7e', d: '#d81b60', n: 2 },
  { c: '#00a58a', d: '#007a66', n: 3 },
  { c: '#0a5af5', d: '#0842b0', n: 4 },
]

export function regionColor(n: number): string {
  return POTS.find((p) => p.n === n)?.c ?? '#fff'
}
