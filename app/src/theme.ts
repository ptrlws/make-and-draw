/* ------------------------------------------------------------------ *
 * Design tokens — "quiet shell, loud work".
 *
 * The studio owns almost no colour. Chrome is warm paper, soft graphite
 * and hairline rules; there is no pure black and no brand accent. Every
 * saturated colour on screen is something the child actually made — a
 * marbled sheet, a scratched panel, a filled-in page. That is a
 * structural guarantee, not a discipline: if the shell has no palette to
 * shout with, the work is always the loudest thing in the room.
 *
 * Token NAMES are unchanged from the old print-shop direction so every
 * screen re-skins from this one file.
 * ------------------------------------------------------------------ */

import type { CSSProperties } from 'react'

export const c = {
  /** warm soft charcoal — never #000; outlines and body text share it */
  ink: '#40382F',
  inkSoft: '#6A6053',

  /* Spot inks. These are no longer chrome — they are the pigments the
   * activities themselves paint with (marble inks, CBN pots, stamps), so
   * they only ever appear inside the child's own work. */
  pink: '#D8447A',
  blue: '#3C6BC4',
  yellow: '#E0A33A',
  teal: '#3E9481',

  // legacy aliases kept so older screens still compile
  coral: '#D8447A',
  coralDark: '#B23561',
  sunshine: '#E0A33A',

  /* paper grounds — cartridge paper, faintly warm, never cream-yellow.
   * The ground sits a clear step below the cards so work reads as sheets
   * laid ON a surface, without needing an outline to separate them. */
  paper: '#E9E5DA',
  paperBody: '#E2DED1',
  paperBook: '#EFECE3',
  card: '#FCFBF7',
  cardAlt: '#FFFFFF',
  headerWash: 'rgba(233,229,218,.88)',

  /** hairline separations — replaces the old 3px black outline everywhere */
  line: 'rgba(64,56,47,.13)',
  lineStrong: 'rgba(64,56,47,.26)',

  disabled: '#D5D0C4',

  hint: '#6A6053',
  prompt: '#4A4235',
  sub: '#6A6053',
  faint: '#948B7C',

  green: '#3E9481', // success / toggle-on
  toggleOff: '#DCD7CB',
} as const

/** Spot inks in rotation order, for cycling tile accents. */
export const SPOT = [c.pink, c.blue, c.yellow, c.teal] as const

export const fonts = {
  /* A rounded humanist face: SF Rounded on Apple devices, a graceful
   * system fallback elsewhere. Warm and lowercase-friendly — the opposite
   * of the old condensed uppercase poster face, and it needs no webfont
   * (the CSP forbids font CDNs and we ship no extra bytes). */
  display: 'ui-rounded, "SF Pro Rounded", "Varela Round", "Hiragino Maru Gothic ProN", system-ui, sans-serif',
  body: "'Inter Variable', Inter, system-ui, sans-serif",
  hand: 'ui-rounded, "SF Pro Rounded", "Varela Round", system-ui, sans-serif',
} as const

/* ------------------------------------------------------------------ *
 * The type scale. ONE ladder, seven rungs, no in-between values:
 *
 *     11 · 13 · 15 · 17 · 20 · 25 · 32
 *
 * Three rules, and they are what make it cohere:
 *   1. Anything a person SAYS or TAPS is the rounded display face at 600
 *      (headings, control labels, names). Anything the app REPORTS is the
 *      body face at 500/600 (prose, counts, meta).
 *   2. Sentence case everywhere. `eyebrow` is the single exception and the
 *      only tracked uppercase in the app.
 *   3. Never write a raw fontSize in a screen — spread a role and override
 *      only fontSize, and only to another rung.
 * ------------------------------------------------------------------ */
export const text = {
  /** the one-per-screen hero (wordmark, "who's making?") */
  hero: { fontFamily: fonts.display, fontWeight: 600, fontSize: 32, lineHeight: 1.08, letterSpacing: '-.022em' },
  /** screen titles, book cover, big numbers */
  display: { fontFamily: fonts.display, fontWeight: 600, fontSize: 25, lineHeight: 1.12, letterSpacing: '-.018em' },
  /** card + section titles, kit names */
  title: { fontFamily: fonts.display, fontWeight: 600, fontSize: 20, lineHeight: 1.2, letterSpacing: '-.012em' },
  /** the one-line question or intro under a title */
  lede: { fontFamily: fonts.body, fontWeight: 500, fontSize: 17, lineHeight: 1.45 },
  /** buttons and primary controls — anything you tap */
  label: { fontFamily: fonts.display, fontWeight: 600, fontSize: 15, lineHeight: 1.2, letterSpacing: '-.005em' },
  /** compact controls: chips, tool pills, toolbar buttons */
  labelSm: { fontFamily: fonts.display, fontWeight: 600, fontSize: 13, lineHeight: 1.2, letterSpacing: '-.005em' },
  /** running prose */
  body: { fontFamily: fonts.body, fontWeight: 500, fontSize: 15, lineHeight: 1.55 },
  /** secondary text: blurbs, counts, hints */
  meta: { fontFamily: fonts.body, fontWeight: 500, fontSize: 13, lineHeight: 1.4 },
  /** the smallest text in the app: badge counts, footnotes */
  micro: { fontFamily: fonts.body, fontWeight: 500, fontSize: 11, lineHeight: 1.35 },
  /** hero that must survive a narrow phone — same rungs, fluid between them */
  heroFluid: { fontFamily: fonts.display, fontWeight: 600, fontSize: 'clamp(25px, 6.5vw, 32px)', lineHeight: 1.08, letterSpacing: '-.022em' },
  /** activity-header title: long kit names must shrink rather than truncate */
  titleFluid: { fontFamily: fonts.display, fontWeight: 600, fontSize: 'clamp(15px, 4.4vw, 20px)', lineHeight: 1.2, letterSpacing: '-.012em' },
  /** the ONLY uppercase in the app — tiny group labels */
  eyebrow: {
    fontFamily: fonts.body,
    fontWeight: 600,
    fontSize: 11,
    lineHeight: 1.3,
    letterSpacing: '.14em',
    textTransform: 'uppercase',
  },
} as const satisfies Record<string, CSSProperties>

/* Depth now comes from light and contact, not from a hard offset plate. */
export const shadows = {
  card: '0 1px 2px rgba(64,56,47,.07), 0 10px 22px -12px rgba(64,56,47,.30)',
  cardSoft: '0 1px 2px rgba(64,56,47,.06), 0 6px 16px -10px rgba(64,56,47,.24)',
  drop: '0 1px 2px rgba(64,56,47,.10), 0 4px 10px -4px rgba(64,56,47,.22)',
  dropSm: '0 1px 2px rgba(64,56,47,.10), 0 3px 8px -4px rgba(64,56,47,.20)',
  dropLg: '0 2px 4px rgba(64,56,47,.10), 0 14px 28px -14px rgba(64,56,47,.34)',
} as const

/** Warm paper with the faintest tooth — no halftone dots. */
export const paperTexture: CSSProperties = {
  // longhand only — mixing `background` with backgroundImage/Size/Position
  // makes React warn about shorthand/longhand conflicts on re-render
  backgroundColor: c.paper,
  backgroundImage:
    'radial-gradient(rgba(64,56,47,.028) 0.5px, transparent 0.6px), radial-gradient(rgba(64,56,47,.02) 0.5px, transparent 0.6px)',
  backgroundSize: '7px 7px, 11px 11px',
  backgroundPosition: '0 0, 3px 5px',
}

/** A tileable halftone dot overlay in a given ink (legacy; used sparingly). */
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

/** Marble inks — pigments, mixed a touch off-primary so they overlap well. */
export const INKS: Ink[] = [
  { c: '#D8447A', d: '#B23561' },
  { c: '#3C6BC4', d: '#2C4F94' },
  { c: '#E0A33A', d: '#B8822A' },
  { c: '#3E9481', d: '#2E7060' },
]

export interface Pot {
  c: string
  d: string
  n: number
}

/** Colour-by-number pots, keyed by numeral. */
export const POTS: Pot[] = [
  { c: '#E0A33A', d: '#B8822A', n: 1 },
  { c: '#D8447A', d: '#B23561', n: 2 },
  { c: '#3E9481', d: '#2E7060', n: 3 },
  { c: '#3C6BC4', d: '#2C4F94', n: 4 },
]

export function regionColor(n: number): string {
  return POTS.find((p) => p.n === n)?.c ?? '#fff'
}
