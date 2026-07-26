import { useEffect, useRef, useState } from 'react'
import { c } from '../theme'

/* ------------------------------------------------------------------ *
 * Blot — the one who lives in the studio.
 *
 * A drop of ink that got curious. It is deliberately made of the app's
 * own substance rather than bolted-on illustration: the same drop shape
 * the marbling tray uses, wearing the colour of the child's most recent
 * piece. So the studio's companion is literally made of their work.
 *
 * It does almost nothing, on purpose — breathes, blinks, and looks at
 * wherever the finger is. Restraint is what keeps it from being twee;
 * eye contact is what makes a child believe someone is home.
 * ------------------------------------------------------------------ */

export type Mood = 'idle' | 'happy' | 'sleepy'

export function Blot({
  size = 48,
  color,
  mood = 'idle',
  still = false,
  name,
}: {
  size?: number
  /** usually the tint of the child's latest piece — Blot wears their colour */
  color?: string
  mood?: Mood
  /** calm mode / reduced motion: hold still, keep the eye contact */
  still?: boolean
  /** what this maker chose to call them; falls back to Blot */
  name?: string | null
}) {
  const ref = useRef<SVGSVGElement>(null)
  const [look, setLook] = useState({ x: 0, y: 0 })

  // follow the finger/pointer — the whole trick, in about ten lines
  useEffect(() => {
    let frame = 0
    const onMove = (e: PointerEvent) => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const el = ref.current
        if (!el) return
        const r = el.getBoundingClientRect()
        const dx = e.clientX - (r.left + r.width / 2)
        const dy = e.clientY - (r.top + r.height / 2)
        const d = Math.hypot(dx, dy) || 1
        // saturate quickly: Blot commits to looking, it doesn't creep
        const reach = Math.min(1, d / 220)
        setLook({ x: (dx / d) * reach, y: (dy / d) * reach })
      })
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  const body = color ?? c.ink
  const sleepy = mood === 'sleepy'
  const happy = mood === 'happy'

  // pupils travel a little further than the eyes themselves
  const px = look.x * 2.6
  const py = look.y * 2.2
  // The blink is a CSS animation rather than React state: it cannot get stuck
  // half-shut if a timer is interrupted, and it costs no re-renders. Two
  // co-prime-ish durations on the pair make it read as one irregular blink.
  const blink = still || sleepy ? undefined : 'blotBlink 5.4s steps(1, end) infinite'

  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={`${name || 'Blot'}, the studio's ink drop`}
      style={{
        display: 'block',
        overflow: 'visible',
        animation: still ? undefined : `${happy ? 'blotHop 1.1s' : 'blotBreathe 4.2s'} ease-in-out infinite`,
        transformOrigin: '50% 92%',
      }}
    >
      {/* the drop it sits in — a real contact shadow, not a drop-shadow filter */}
      <ellipse cx="50" cy="95" rx={happy ? 22 : 26} ry="4.5" fill="rgba(64,56,47,.16)" />

      {/* body: the marbling tray's own drop shape, settled */}
      <path
        d="M50 10 C 66 30, 87 45, 87 63 C 87 83, 70 95, 50 95 C 30 95, 13 83, 13 63 C 13 45, 34 30, 50 10 Z"
        fill={body}
      />
      {/* wet highlight — ink is glossy before it dries */}
      <ellipse cx="35" cy="40" rx="11" ry="7" fill="#fff" opacity=".22" transform="rotate(-28 35 40)" />
      {/* a satellite fleck, because a real drop never lands alone */}
      <circle cx="86" cy="30" r="3.4" fill={body} opacity=".85" />

      {/* eyes — set wide and high, which reads young rather than shifty */}
      <g
        transform={`translate(${look.x * 2.2} ${look.y * 1.8})`}
        style={{ animation: blink, transformBox: 'fill-box', transformOrigin: '50% 50%' }}
      >
        {[36, 64].map((cx) => (
          <g key={cx}>
            <ellipse cx={cx} cy="60" rx="9" ry={sleepy ? 3.8 : 9} fill="#FCFBF7" />
            <circle cx={cx + px} cy={60 + py} r={4.4} fill="#2B2620" />
          </g>
        ))}
      </g>

      {/* the smallest possible smile, only when there's something to smile about */}
      {happy && (
        <path d="M42 76 Q50 82 58 76" stroke="#2B2620" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".75" />
      )}
    </svg>
  )
}
