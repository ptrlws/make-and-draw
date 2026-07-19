import { fonts } from '../theme'
import type { GalleryItem } from '../types'

/**
 * A gallery creation's picture. Every real save carries a rendered image
 * (marble collectible, CBN print, pattern, etc.); the tiny per-type motif is
 * only a defensive fallback for an item that somehow lacks one.
 */
export function Motif({ item }: { item: GalleryItem }) {
  if (item.img) {
    return (
      <img
        src={item.img}
        alt={item.title}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
      />
    )
  }

  const t = item.tint || '#2fb8b3'
  const bg: Partial<Record<GalleryItem['type'], string>> = {
    marble: `repeating-linear-gradient(45deg,${t} 0 10px,#ffffff88 10px 20px)`,
    sticker: `repeating-linear-gradient(-45deg,${t} 0 12px,#ffffff99 12px 24px)`,
    jigsaw: `repeating-linear-gradient(45deg,${t} 0 10px,#ffffff88 10px 20px)`,
    dot: '#fdfaf0',
    butterfly: t,
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: bg[item.type] || t,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {item.type === 'dot' ? (
        <div style={{ fontFamily: fonts.display, fontWeight: 800, fontSize: 26, color: '#d9a81a' }}>
          1·2·3
        </div>
      ) : null}
    </div>
  )
}
