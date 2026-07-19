import type { Difficulty } from './types'

/**
 * Dev-facing tweakables (the original design component's "Play" props).
 * Overridable from the URL query so they're easy to demo, e.g.
 *   ?difficulty=hard&calm=1&sound=0&skipName=1
 */
export interface Config {
  /** start in calm mode (gentle confetti, softened sound) */
  calmMode: boolean
  /** sound on by default */
  sound: boolean
  /** colour-by-number petal count: easy 4 / medium 6 / hard 8 */
  difficulty: Difficulty
  /** jump straight to the shelves, skipping first-launch name entry */
  skipNameEntry: boolean
}

function bool(v: string | null, dflt: boolean): boolean {
  if (v == null) return dflt
  return v === '1' || v === 'true' || v === 'yes'
}

export function readConfig(): Config {
  const q = new URLSearchParams(
    typeof window !== 'undefined' ? window.location.search : '',
  )
  const d = q.get('difficulty')
  const difficulty: Difficulty =
    d === 'easy' || d === 'medium' || d === 'hard' ? d : 'medium'

  return {
    calmMode: bool(q.get('calm'), false),
    sound: bool(q.get('sound'), true),
    difficulty,
    skipNameEntry: bool(q.get('skipName') ?? q.get('skip'), false),
  }
}
