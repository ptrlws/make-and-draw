import type { CSSProperties } from 'react'
import { Motif } from '../components/Motif'
import { useGame } from '../game/context'
import { fonts } from '../theme'
import type { GalleryItem } from '../types'

const artBase: CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '50%',
  transition: 'transform .8s cubic-bezier(.4,1.2,.3,1),opacity .6s',
}

/**
 * The shared signature moment: the artwork gathers to centre, bursts with
 * fireworks (or gentle confetti in calm mode), then flies off toward the
 * book. State choreography lives in the provider; this just renders phases.
 */
export function FinishingRitual() {
  const { state } = useGame()
  const f = state.finishing
  if (!f) return null

  const artStyle: CSSProperties = {
    ...artBase,
    ...(f.phase === 'gather'
      ? { transform: 'translate(-50%,-50%) scale(.6)', opacity: 0.9 }
      : f.phase === 'burst'
        ? { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, animation: 'popBurst .5s cubic-bezier(.3,1.4,.4,1) forwards', transition: 'none' }
        : { transform: 'translate(-50%,-50%) translate(40vw,-42vh) scale(.14) rotate(22deg)', opacity: 0, animation: 'flyToBook .95s cubic-bezier(.5,0,.5,1) forwards', transition: 'none' }),
  }

  const item: GalleryItem = {
    id: 'finish',
    type: f.type,
    title: f.title,
    tint: f.tint,
    img: f.img,
    fills: f.fills,
  }

  const anim = f.calm ? 'conf' : 'fw'
  const size = f.calm ? 11 : 13

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={f.text || 'saving your creation'}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 60,
        background: 'rgba(58,50,42,.55)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {f.phase === 'burst' && (
        <div style={{ position: 'absolute', left: '50%', top: '50%', pointerEvents: 'none' }}>
          {f.parts.map((p, i) => (
            <div
              key={i}
              style={
                {
                  position: 'absolute',
                  width: size,
                  height: size,
                  marginLeft: -6,
                  marginTop: -6,
                  borderRadius: i % 2 ? '50%' : 2,
                  background: p.c,
                  '--tx': `${p.tx}px`,
                  '--ty': `${p.ty}px`,
                  '--tr': p.tr,
                  animation: `${anim} ${p.d}s ${p.delay}s ease-out forwards`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}

      <div style={artStyle}>
        <div
          style={{
            width: 'min(52vw, 240px)',
            height: 'min(52vw, 240px)',
            border: '4px solid #fff',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 12px 30px rgba(0,0,0,.4)',
            background: '#fff',
          }}
        >
          <Motif item={item} />
        </div>
      </div>

      {f.text && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: '16%',
            textAlign: 'center',
            fontFamily: fonts.hand,
            fontSize: 25,
            color: '#fff',
            textShadow: '0 2px 6px rgba(0,0,0,.4)',
            animation: 'rise .4s ease',
          }}
        >
          {f.text}
        </div>
      )}
    </div>
  )
}
