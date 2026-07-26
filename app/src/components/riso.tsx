import type { CSSProperties, ReactNode } from 'react'
import { c, halftone, shadows, text } from '../theme'

/* Shared controls for the "quiet shell" direction: no outlines, no hard
 * offset plates, no chroma. Separation comes from a paper-white fill and a
 * soft contact shadow, so the only saturated thing on any screen stays the
 * child's own work. */

/** Round-cornered control: back / sound / settings / page nav. */
export function IconButton({
  onClick,
  ariaLabel,
  size = 48,
  children,
  style,
}: {
  onClick?: () => void
  ariaLabel?: string
  size?: number
  children?: ReactNode
  style?: CSSProperties
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        width: size,
        height: size,
        flex: 'none',
        border: 'none',
        borderRadius: 12,
        background: c.card,
        boxShadow: shadows.dropSm,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: c.ink,
        ...style,
      }}
    >
      {children}
    </button>
  )
}

type Variant = 'primary' | 'confirm' | 'plain'

/** Primary actions are carried by weight and contrast rather than by a brand
 * colour: solid ink on paper. `confirm` keeps the one semantic green. */
export function RisoButton({
  onClick,
  children,
  variant = 'primary',
  style,
}: {
  onClick?: () => void
  children: ReactNode
  variant?: Variant
  style?: CSSProperties
}) {
  const primary = variant === 'primary'
  const confirm = variant === 'confirm'
  const bg = primary ? c.ink : confirm ? c.teal : c.card
  const col = primary || confirm ? '#FCFBF7' : c.ink
  return (
    <button
      onClick={onClick}
      style={{
        ...text.label,
        background: bg,
        color: col,
        border: 'none',
        borderRadius: 14,
        padding: '13px 22px',
        boxShadow: shadows.drop,
        cursor: 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

/** A sheet of paper laid on the surface. `spot`/`offset` are still accepted
 * so older callers compile, but the hard registration plate is gone. */
export function Card({
  children,
  radius = 16,
  style,
}: {
  children: ReactNode
  spot?: string
  offset?: number
  radius?: number
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        background: c.card,
        border: 'none',
        borderRadius: radius,
        boxShadow: shadows.card,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/** Overprinted halftone dot texture, sits inside a positioned parent. */
export function Halftone({ color = c.ink, opacity = 0.16, size = 5 }: { color?: string; opacity?: number; size?: number }) {
  return (
    <div
      aria-hidden
      style={{ position: 'absolute', inset: 0, ...halftone(color, size), opacity, mixBlendMode: 'multiply', pointerEvents: 'none' }}
    />
  )
}
