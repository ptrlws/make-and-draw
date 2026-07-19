import type { KitId } from '../types'
import { c } from '../theme'

/**
 * A bold, legible poster emblem per kit — the print-shop answer to the
 * "don't ship the stripe placeholders" note. Two-colour, flat, readable at a
 * glance so a pre-reader can tell activities apart without the label.
 * `ink` is the line/shape colour, `paper` the ground the tile paints behind it.
 */
export function KitEmblem({ id, ink = c.paper, accent = c.ink }: { id: KitId; ink?: string; accent?: string }) {
  const common = { width: '100%', height: '100%', viewBox: '0 0 120 72', fill: 'none' as const, style: { display: 'block' } }
  const S = 3.4 // stroke weight

  switch (id) {
    case 'marble':
      // nested swirling ink filaments
      return (
        <svg {...common}>
          {[26, 20, 14, 8].map((r, i) => (
            <path
              key={i}
              d={`M${60 - r} 36 a${r} ${r * 0.82} 0 1 1 ${r * 2} 0`}
              stroke={i % 2 ? accent : ink}
              strokeWidth={S}
              strokeLinecap="round"
              transform={`rotate(${i * 18} 60 36)`}
            />
          ))}
          <circle cx={60} cy={36} r={4} fill={ink} />
        </svg>
      )
    case 'cbn':
      // numbered screenprint grid
      return (
        <svg {...common}>
          {[
            [30, 16, '1'],
            [62, 16, '2'],
            [30, 40, '3'],
            [62, 40, '4'],
          ].map(([x, y, n], i) => (
            <g key={i}>
              <rect x={x as number} y={y as number} width={28} height={18} rx={3} stroke={ink} strokeWidth={S} />
              <text x={(x as number) + 14} y={(y as number) + 14} textAnchor="middle" fontFamily="Anton, sans-serif" fontSize={15} fill={ink}>
                {n}
              </text>
            </g>
          ))}
        </svg>
      )
    case 'pattern':
      // 4-fold kaleidoscope petals
      return (
        <svg {...common}>
          {[0, 90, 180, 270].map((a, i) => (
            <path key={i} d="M60 36 C 74 22 92 26 96 12 C 78 16 70 24 60 36 Z" fill={i % 2 ? ink : accent} transform={`rotate(${a} 60 36)`} />
          ))}
          <circle cx={60} cy={36} r={6} fill={ink} />
        </svg>
      )
    case 'print':
      // overlapping overprint stamps
      return (
        <svg {...common}>
          <circle cx={48} cy={38} r={18} fill={ink} opacity={0.9} />
          <rect x={54} y={16} width={30} height={30} rx={4} fill={accent} opacity={0.75} />
          <path d="M74 50 l14 -22 14 22 Z" fill={ink} opacity={0.8} />
        </svg>
      )
    case 'sticker':
      // die-cut sticker cluster
      return (
        <svg {...common}>
          <path d="M40 14 l4.5 9 10 1.5 -7.5 7 2 10 -9 -5 -9 5 2 -10 -7.5 -7 10 -1.5 Z" fill={accent} stroke={ink} strokeWidth={2} />
          <path d="M80 20 c 6 -8 18 -2 0 14 c -18 -16 -6 -22 0 -14 Z" fill={ink} />
          <circle cx={64} cy={50} r={11} fill={accent} stroke={ink} strokeWidth={2} />
        </svg>
      )
    case 'dot':
      // join-the-dots constellation 1-2-3
      return (
        <svg {...common}>
          <path d="M28 46 L52 20 L82 30 L96 52" stroke={ink} strokeWidth={2} strokeDasharray="3 4" />
          {[
            [28, 46],
            [52, 20],
            [82, 30],
            [96, 52],
          ].map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r={6} fill={ink} />
              <text x={x} y={y + 4} textAnchor="middle" fontFamily="Anton, sans-serif" fontSize={9} fill={accent}>
                {i + 1}
              </text>
            </g>
          ))}
        </svg>
      )
    case 'butterfly':
      // symmetric butterfly (mirror-paint)
      return (
        <svg {...common}>
          {[1, -1].map((sx, i) => (
            <g key={i} transform={`translate(60 36) scale(${sx} 1)`}>
              <path d="M2 0 C 20 -22 42 -18 34 -2 C 42 2 40 16 24 14 C 14 12 6 6 2 0 Z" fill={i ? accent : ink} stroke={ink} strokeWidth={1.5} />
            </g>
          ))}
          <rect x={58.5} y={16} width={3} height={40} rx={1.5} fill={ink} />
        </svg>
      )
    default:
      return null
  }
}
