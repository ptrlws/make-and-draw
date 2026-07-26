import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { IconButton, RisoButton } from '../components/riso'
import { useGame } from '../game/context'
import { loadDraft, saveDraft } from '../game/draftStore'
import { saveStock } from '../game/stock'
import { MarbleStudio, type Op } from '../marble/MarbleStudio'
import { STL_MODELS } from '../marble/models'
import { INKS, c, shadows, text } from '../theme'

const chip: CSSProperties = {
  ...text.labelSm,
  color: c.ink,
  background: c.card,
  border: 'none',
  borderRadius: 14,
  padding: '10px 14px',
  boxShadow: shadows.dropSm,
  cursor: 'pointer',
}

export function Marble() {
  const { go, play, startFinish, reducedMotion, state } = useGame()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const studioRef = useRef<MarbleStudio | null>(null)

  const [ink, setInk] = useState(0)
  const [tool, setTool] = useState(0)
  const [phase, setPhase] = useState<'tray' | 'collectible'>('tray')
  const [dipped, setDipped] = useState<string>('cat')
  const [noGl, setNoGl] = useState(false)

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    let studio: MarbleStudio
    try {
      studio = new MarbleStudio(cv)
    } catch {
      // WebGL unavailable (old device, GPU blocklist) — friendly card, no crash
      setNoGl(true)
      return
    }
    studio.onReveal = () => setPhase('collectible')
    studio.onSound = play
    studio.setReduced(reducedMotion || state.calm)
    // drafts: restore the child's swirls, then persist after every gesture
    const draft = loadDraft<{ gs: Op[][] }>('marble')
    if (draft?.gs?.length) studio.importGestures(draft.gs)
    studio.onOps = () => saveDraft('marble', { gs: studio.exportGestures() })
    studioRef.current = studio
    const onResize = () => studio.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      studio.dispose()
      studioRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // keep the engine's reduced-motion flag in sync with the live preference
  useEffect(() => {
    studioRef.current?.setReduced(reducedMotion || state.calm)
  }, [reducedMotion, state.calm])

  const pickInk = (i: number) => {
    setInk(i)
    studioRef.current?.setInk(i)
    play('select')
  }
  const pickTool = (i: number) => {
    setTool(i)
    studioRef.current?.setTool(i)
    play('select')
  }
  const dip = (id: string) => {
    setDipped(id)
    studioRef.current?.dip(id)
  }
  const backToTray = () => {
    studioRef.current?.backToTray()
    setPhase('tray')
  }
  const dipLabel = STL_MODELS.find((m) => m.id === dipped)?.name ?? 'thing'
  const addToCollection = () => {
    const studio = studioRef.current
    if (!studio) return
    const img = studio.snapshotCollectible()
    startFinish({ type: 'marble', title: `Marbled ${dipLabel}`, img, tint: INKS[ink].c })
  }
  // the tray painting IS an artwork — keep the marbled paper itself
  const keepPaper = () => {
    const studio = studioRef.current
    if (!studio) return
    const img = studio.snapshotTray()
    saveStock('marble', img) // kept paper becomes Print Shop stock
    startFinish({ type: 'marble', title: 'Marbled paper', img, tint: INKS[ink].c })
  }

  // load the bundled STL models (public/models/, listed in marble/models.ts)
  // into the dip tray — the dip shelf is powered entirely by these assets
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js')
        const loader = new STLLoader()
        for (const m of STL_MODELS) {
          try {
            const res = await fetch(m.src)
            if (!res.ok) continue
            const buf = await res.arrayBuffer()
            if (cancelled || !studioRef.current) return
            studioRef.current.registerGeometry(m.id, loader.parse(buf))
          } catch {
            /* skip a model that fails to load */
          }
        }
      } catch {
        /* STLLoader unavailable */
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px' }}>
        <IconButton
          onClick={() => go('home')}
          ariaLabel="back"
          size={46}
          style={{ ...text.title }}
        >
          ‹
        </IconButton>
        <div style={{ ...text.titleFluid, color: c.ink, flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          Marbling
        </div>
        {phase === 'tray' && !noGl && (
          <>
            <button onClick={() => studioRef.current?.undo()} style={{ ...chip, padding: '9px 12px' }}>
              Undo
            </button>
            <button onClick={() => studioRef.current?.reset()} style={{ ...chip, padding: '9px 12px' }}>
              Reset
            </button>
            <button onClick={keepPaper} style={{ ...chip, padding: '9px 12px', background: c.teal, color: c.card }}>
              Keep ✓
            </button>
          </>
        )}
      </div>

      {/* tray */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div
          style={{
            position: 'relative',
            width: 'min(560px, 92vw, 74vh)',
            aspectRatio: '1 / 1',
            maxHeight: '100%',
            background: c.card,
            border: 'none',
            borderRadius: 18,
            boxShadow: shadows.dropLg,
            padding: 10,
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              borderRadius: 10,
              boxShadow: `inset 0 0 0 1px ${c.line}`,
              touchAction: 'none',
              cursor: 'crosshair',
            }}
          />
          {noGl && (
            <div
              style={{
                position: 'absolute',
                inset: 10,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                textAlign: 'center',
                background: c.paper,
                borderRadius: 10,
                padding: 20,
              }}
            >
              <div style={{ ...text.display, color: c.ink }}>
                No ink today
              </div>
              <div style={{ ...text.meta, color: c.hint }}>
                this device can't run the marbling tray — the other kits all still work!
              </div>
            </div>
          )}
          {phase === 'tray' && !noGl && (
            <div
              style={{
                ...text.meta,
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 14,
                textAlign: 'center',
                color: c.faint,
                pointerEvents: 'none',
              }}
            >
              tap to drop • drag to swirl
            </div>
          )}
        </div>
      </div>

      {/* tools */}
      {noGl ? null : phase === 'tray' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', padding: '4px 16px 22px' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
            {INKS.map((k, i) => (
              <button
                key={i}
                aria-label={`ink ${i + 1}`}
                aria-pressed={ink === i}
                onClick={() => pickInk(i)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: k.c,
                  border: 'none',
                  boxShadow:
                    ink === i
                      ? `0 0 0 3px ${c.paper}, 0 0 0 5px ${c.ink}, ${shadows.dropSm}`
                      : shadows.dropSm,
                  transform: ink === i ? 'scale(1.12)' : undefined,
                  transition: 'transform .12s',
                  cursor: 'pointer',
                }}
              />
            ))}
            {['✒ Swirl', '▤ Rake', '▥ Comb'].map((label, i) => (
              <button
                key={label}
                onClick={() => pickTool(i)}
                aria-pressed={tool === i}
                style={{ ...chip, background: tool === i ? c.ink : c.card, color: tool === i ? c.card : c.ink }}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
            <span
              style={{
                ...text.eyebrow,
                color: c.faint,
              }}
            >
              Dip
            </span>
            {STL_MODELS.map((m) => (
              <button key={m.id} onClick={() => dip(m.id)} style={chip}>
                {m.emoji} {m.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', padding: '4px 16px 26px' }}>
          <div style={{ ...text.body, color: c.ink }}>
            a marbled {dipLabel.toLowerCase()} — one of a kind
          </div>
          <div style={{ ...text.micro, color: c.hint, marginTop: -4 }}>
            drag to turn it around
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <RisoButton onClick={backToTray} variant="plain">
              ‹ Tray
            </RisoButton>
            <RisoButton onClick={addToCollection} variant="confirm">
              Add to collection ✓
            </RisoButton>
          </div>
        </div>
      )}
    </div>
  )
}
