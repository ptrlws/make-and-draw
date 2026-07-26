import { INKS, POTS } from '../theme'
import type { KitId } from '../types'

/* ------------------------------------------------------------------ *
 * A kit, laid out ready, before anything has been made in it.
 *
 * Not decorative swatches: each tile shows that activity's REAL
 * materials — the tray of water and its ink pots, the numbered page and
 * its paint pots, the foil with a corner already scratched. Every colour
 * here is a pigment the child is about to paint with (drawn straight
 * from INKS / POTS), so nothing is invented for variety. It reads as an
 * open box of materials, which is an invitation, rather than a label.
 *
 * The moment a piece is finished, Home swaps this for the child's real
 * artwork and this surface is never seen for that kit again.
 * ------------------------------------------------------------------ */

const PAPER = '#F8F6F1'
const GRAPHITE = 'rgba(64,56,47,.40)'
const GRAPHITE_SOFT = 'rgba(64,56,47,.17)'

const ink = (i: number) => INKS[i % INKS.length].c
const pot = (i: number) => POTS[i % POTS.length].c

/** a row of pigment pots along the bottom — the tools, ready */
function Pots({ colors, y = 84, r = 6.4 }: { colors: string[]; y?: number; r?: number }) {
  const gap = 17
  const start = 50 - ((colors.length - 1) * gap) / 2
  return (
    <g>
      {colors.map((col, i) => (
        <g key={i}>
          <ellipse cx={start + i * gap} cy={y + r * 0.86} rx={r * 0.95} ry={r * 0.30} fill="rgba(64,56,47,.13)" />
          <circle cx={start + i * gap} cy={y} r={r} fill={col} />
          <path
            d={`M ${start + i * gap - r * 0.55} ${y - r * 0.45} a ${r * 0.62} ${r * 0.62} 0 0 1 ${r * 0.7} ${-r * 0.18}`}
            stroke="rgba(255,255,255,.55)"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      ))}
    </g>
  )
}

function Sheet({ children }: { children?: React.ReactNode }) {
  return (
    <>
      <rect width="100" height="100" fill={PAPER} />
      {children}
    </>
  )
}

function surface(id: KitId) {
  switch (id) {
    // a tray of still water, lit from above, with the inks set out beside it
    case 'marble':
      return (
        <>
          <defs>
            <linearGradient id="ks-water" x1="0" y1="0" x2=".3" y2="1">
              <stop offset="0" stopColor="#DEE8EB" />
              <stop offset=".55" stopColor="#C9D8DE" />
              <stop offset="1" stopColor="#BACDD4" />
            </linearGradient>
          </defs>
          <rect width="100" height="100" fill="url(#ks-water)" />
          <ellipse cx="36" cy="24" rx="30" ry="10" fill="#fff" opacity=".38" />
          <ellipse cx="68" cy="58" rx="22" ry="7" fill="#fff" opacity=".16" />
          {/* one drop already floating — the water is live */}
          <circle cx="52" cy="44" r="9" fill={ink(0)} opacity=".92" />
          <circle cx="52" cy="44" r="4.6" fill={ink(3)} opacity=".95" />
          <Pots colors={[ink(0), ink(1), ink(2), ink(3)]} />
        </>
      )

    // a page of numbers nobody has filled, and the pots that fill it
    case 'cbn':
      return (
        <Sheet>
          <g fill="none" stroke={GRAPHITE} strokeWidth="1.2" strokeLinejoin="round">
            <circle cx="50" cy="34" r="16" />
            <path d="M50 50 L50 70" />
            <ellipse cx="31" cy="56" rx="11" ry="6" transform="rotate(-24 31 56)" />
            <ellipse cx="69" cy="56" rx="11" ry="6" transform="rotate(24 69 56)" />
          </g>
          <g fill={GRAPHITE} fontSize="8.5" fontFamily="system-ui, sans-serif" fontWeight="600" textAnchor="middle">
            <text x="50" y="37">1</text>
            <text x="31" y="59">2</text>
            <text x="69" y="59">2</text>
          </g>
          <Pots colors={[pot(0), pot(1), pot(2), pot(3)]} />
        </Sheet>
      )

    // foil, with the corner already scratched — every pack comes like this
    case 'scratch':
      return (
        <>
          <defs>
            <linearGradient id="ks-rainbow" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#E0A33A" />
              <stop offset=".33" stopColor="#D8447A" />
              <stop offset=".66" stopColor="#3C6BC4" />
              <stop offset="1" stopColor="#3E9481" />
            </linearGradient>
            <linearGradient id="ks-foil" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#282520" />
              <stop offset=".5" stopColor="#171512" />
              <stop offset="1" stopColor="#232019" />
            </linearGradient>
          </defs>
          <rect width="100" height="100" fill="url(#ks-rainbow)" />
          <rect width="100" height="100" fill="url(#ks-foil)" />
          {/* two scratched strokes revealing the foil beneath */}
          <path d="M18 78 Q34 58 44 66 Q54 74 72 46" stroke="url(#ks-rainbow)" strokeWidth="7" strokeLinecap="round" fill="none" />
          <path d="M26 34 Q44 24 62 30" stroke="url(#ks-rainbow)" strokeWidth="3.4" strokeLinecap="round" fill="none" opacity=".9" />
          {[
            [20, 22],
            [78, 20],
            [86, 62],
            [34, 90],
            [66, 86],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r=".9" fill="#fff" opacity=".32" />
          ))}
        </>
      )

    // dots and the pencil that joins them
    case 'dot':
      return (
        <Sheet>
          {[
            [26, 26],
            [48, 18],
            [68, 28],
            [78, 48],
            [66, 66],
            [44, 72],
            [24, 60],
            [17, 42],
          ].map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="2.5" fill={GRAPHITE} />
              <text x={x + 4.4} y={y + 1.6} fontSize="6.5" fill={GRAPHITE_SOFT} fontFamily="system-ui, sans-serif" fontWeight="600">
                {i + 1}
              </text>
            </g>
          ))}
          {/* the first two already joined — showing what to do */}
          <path d="M26 26 L48 18" stroke={ink(1)} strokeWidth="2.2" strokeLinecap="round" />
          <g transform="rotate(38 74 84)">
            <rect x="52" y="80" width="44" height="7" rx="2" fill={ink(2)} />
            <path d="M96 80 L104 83.5 L96 87 Z" fill="#E8DFC9" />
          </g>
        </Sheet>
      )

    // a tile mid-spin: the mirror lines, with pigment starting to repeat
    case 'pattern':
      return (
        <Sheet>
          <g stroke={GRAPHITE_SOFT} strokeWidth="1" strokeDasharray="3 3">
            <path d="M50 4 L50 96 M4 50 L96 50 M12 12 L88 88 M88 12 L12 88" />
          </g>
          {[0, 90, 180, 270].map((a) => (
            <g key={a} transform={`rotate(${a} 50 50)`}>
              <circle cx="66" cy="34" r="7.5" fill={ink(0)} opacity=".85" />
              <circle cx="76" cy="52" r="4.5" fill={ink(2)} opacity=".9" />
            </g>
          ))}
          <circle cx="50" cy="50" r="6" fill={ink(3)} />
        </Sheet>
      )

    // a stamp, its inked pad, and one impression already pulled
    case 'print':
      return (
        <Sheet>
          <rect x="12" y="16" width="34" height="34" rx="3" fill={ink(1)} opacity=".9" />
          <rect x="19" y="23" width="20" height="20" rx="2" fill={PAPER} opacity=".55" />
          <g transform="rotate(-9 66 62)">
            <rect x="48" y="44" width="38" height="34" rx="3" fill="#E9E3D6" />
            <rect x="55" y="51" width="24" height="20" rx="2" fill={ink(0)} />
          </g>
          <Pots colors={[ink(0), ink(1), ink(2)]} y={90} r={5.4} />
        </Sheet>
      )

    // a sheet of stickers — they're coloured long before you peel them
    case 'sticker':
      return (
        <Sheet>
          <circle cx="30" cy="30" r="14" fill={ink(0)} />
          <rect x="56" y="17" width="27" height="25" rx="6" fill={ink(1)} />
          <path d="M31 55 l14 23 h-28 z" fill={ink(2)} />
          <circle cx="68" cy="70" r="13.5" fill={ink(3)} />
          <g fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="1.2" strokeDasharray="2.5 2.5">
            <circle cx="30" cy="30" r="10.5" />
            <rect x="60" y="21" width="19" height="17" rx="4" />
            <circle cx="68" cy="70" r="10" />
          </g>
        </Sheet>
      )

    // paper folded down the middle, one wing painted, ready to press
    case 'butterfly':
      return (
        <Sheet>
          <rect x="0" y="0" width="50" height="100" fill="rgba(64,56,47,.03)" />
          <path d="M50 28 Q24 12 17 40 Q13 66 50 68 Z" fill={ink(0)} opacity=".92" />
          <circle cx="33" cy="38" r="6" fill={ink(2)} />
          <circle cx="28" cy="55" r="4" fill={ink(3)} />
          <path d="M50 2 L50 98" stroke={GRAPHITE} strokeWidth="1" strokeDasharray="5 4" />
        </Sheet>
      )

    default:
      return <Sheet />
  }
}

/** The kit's materials, laid out ready. */
export function KitSurface({ id }: { id: KitId }) {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      style={{ display: 'block', width: '100%', height: '100%' }}
    >
      {surface(id)}
    </svg>
  )
}
