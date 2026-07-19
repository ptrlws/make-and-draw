import type { Particle } from './types'

/** "Mabel" -> "Mabel's"; "Thomas" -> "Thomas'"; no name -> "your". */
export function poss(name: string | null): string {
  if (!name) return 'your'
  return name + (/s$/i.test(name) ? "'" : "'s")
}

/** "1 thing" / "3 things" — count with the correctly-inflected noun. */
export function plural(n: number, one: string, many = one + 's'): string {
  return `${n} ${n === 1 ? one : many}`
}

const CONFETTI = ['#f4c026', '#f2779f', '#2fb8b3', '#63b34a', '#f2913d', '#9a6bd1']

/**
 * Particles for the finishing ritual.
 * - fireworks: burst outward in all directions from the centre
 * - calm: a gentle confetti fall, drifting down and spread across the width
 */
export function buildParticles(calm: boolean): Particle[] {
  const n = calm ? 22 : 26
  const parts: Particle[] = []
  for (let i = 0; i < n; i++) {
    if (calm) {
      parts.push({
        tx: (Math.random() * 2 - 1) * 180,
        ty: -30 - Math.random() * 50,
        tr: `${Math.random() * 720 - 360}deg`,
        c: CONFETTI[i % 6],
        d: 1.5 + Math.random() * 0.9,
        delay: Math.random() * 0.5,
      })
    } else {
      const a = Math.random() * Math.PI * 2
      const dist = 120 + Math.random() * 220
      parts.push({
        tx: Math.cos(a) * dist,
        ty: Math.sin(a) * dist,
        tr: `${Math.random() * 720 - 360}deg`,
        c: CONFETTI[i % 6],
        d: 0.6 + Math.random() * 0.5,
        delay: Math.random() * 0.25,
      })
    }
  }
  return parts
}
