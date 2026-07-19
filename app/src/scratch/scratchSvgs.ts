/* ------------------------------------------------------------------ *
 * Scratch-off colouring pages, bundled under public/scratch/. Each is a
 * proper colouring page: closed shapes carry a `fill` (the real picture to
 * reveal, and the silhouette scratches are clipped to) plus the shared
 * black outline; detail lines use fill="none". ScratchOff fetches each,
 * reads the <path> d + fill, and renders in the 100x100 box. To add one:
 * drop a .svg (viewBox 0 0 100 100; filled shapes + fill="none" details)
 * in public/scratch/ and add an entry here.
 * ------------------------------------------------------------------ */

export interface ScratchPic {
  id: string
  name: string
  src: string
}

const base = import.meta.env.BASE_URL || '/'

export const SCRATCH_SVGS: ScratchPic[] = [
  { id: 'star', name: 'Star', src: `${base}scratch/star.svg` },
  { id: 'heart', name: 'Heart', src: `${base}scratch/heart.svg` },
  { id: 'sun', name: 'Sun', src: `${base}scratch/sun.svg` },
  { id: 'cat', name: 'Cat', src: `${base}scratch/cat.svg` },
  { id: 'rocket', name: 'Rocket', src: `${base}scratch/rocket.svg` },
  { id: 'flower', name: 'Flower', src: `${base}scratch/flower.svg` },
]
