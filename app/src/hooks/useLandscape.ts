import { useEffect, useState } from 'react'

/**
 * Drives the responsive activity layout. Landscape = tool tray beside the
 * stage; portrait = tool tray below it. (Matches the prototype's rule:
 * wide AND actually landscape.)
 */
export function useLandscape(): boolean {
  const compute = () =>
    typeof window !== 'undefined' &&
    window.innerWidth > window.innerHeight &&
    window.innerWidth > 760

  const [landscape, setLandscape] = useState(compute)

  useEffect(() => {
    const onResize = () => setLandscape(compute())
    window.addEventListener('resize', onResize)
    onResize()
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return landscape
}
