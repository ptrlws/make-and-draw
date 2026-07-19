import type { CSSProperties, ReactNode } from 'react'
import { c, fonts, halftone } from '../theme'

/** Square taped-free control: back / sound / settings / page nav. */
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
        border: `2.5px solid ${c.ink}`,
        borderRadius: 8,
        background: '#fff',
        boxShadow: '0 3px 0 #16130f',
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

/** Bold print-shop button: pink primary, teal confirm, white plain. */
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
  const bg = variant === 'primary' ? c.pink : variant === 'confirm' ? c.teal : '#fff'
  // Ink labels on the fluoro fills: paper/white failed WCAG 1.4.3 on these
  // (teal 2.75:1, pink 3.1:1); ink is 5.95:1 / 5.24:1 and reads more letterpress.
  const col = c.ink
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: fonts.body,
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '.05em',
        fontSize: 15,
        background: bg,
        color: col,
        border: `2.5px solid ${c.ink}`,
        borderRadius: 6,
        padding: '12px 20px',
        boxShadow: '0 4px 0 #16130f',
        cursor: 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

/** Cut-card with a hard registration-offset shadow in a spot ink. */
export function Card({
  children,
  spot = c.pink,
  offset = 5,
  radius = 8,
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
        border: `3px solid ${c.ink}`,
        borderRadius: radius,
        boxShadow: `${offset}px ${offset}px 0 ${spot}`,
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
