import { useEffect, useRef, useState, type ChangeEvent as RCE, type CSSProperties } from 'react'
import { useGame } from '../game/context'
import { loadDraft, saveDraft } from '../game/draftStore'
import { getModel, putModel } from '../game/modelStore'
import { saveStock } from '../game/stock'
import { MarbleStudio, type Op } from '../marble/MarbleStudio'
import { STL_MODELS } from '../marble/models'
import { INKS, c, fonts } from '../theme'

const chip: CSSProperties = {
  fontFamily: fonts.body,
  fontWeight: 800,
  fontSize: 13,
  textTransform: 'uppercase',
  letterSpacing: '.04em',
  color: c.ink,
  background: '#fff',
  border: `2.5px solid ${c.ink}`,
  borderRadius: 6,
  padding: '9px 13px',
  boxShadow: '0 3px 0 #16130f',
  cursor: 'pointer',
}
const squareBtn: CSSProperties = {
  width: 46,
  height: 46,
  flex: 'none',
  border: `2.5px solid ${c.ink}`,
  borderRadius: 8,
  background: '#fff',
  boxShadow: '0 3px 0 #16130f',
  fontFamily: fonts.display,
  fontSize: 22,
  color: c.ink,
  lineHeight: 1,
  cursor: 'pointer',
}

export function Marble() {
  const { go, play, showToast, startFinish, reducedMotion, state } = useGame()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const studioRef = useRef<MarbleStudio | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [ink, setInk] = useState(0)
  const [tool, setTool] = useState(0)
  const [phase, setPhase] = useState<'tray' | 'collectible'>('tray')
  const [dipped, setDipped] = useState<string>('cat')
  const [modelName, setModelName] = useState<string | null>(null)
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
  const dipLabel =
    dipped === 'custom' ? modelName || 'model' : (STL_MODELS.find((m) => m.id === dipped)?.name ?? 'thing')
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

  // ---- STL import (the file stays local; parsed to geometry, cached in IDB) ----
  const importStl = async (buffer: ArrayBuffer, name: string, persist: boolean): Promise<boolean> => {
    const studio = studioRef.current
    if (!studio) return false
    try {
      const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js')
      const geo = new STLLoader().parse(buffer)
      if (!studioRef.current) return false
      studio.registerGeometry('custom', geo)
      setModelName(name)
      if (persist) void putModel(name, buffer)
      return true
    } catch {
      return false
    }
  }
  const onStl = (e: RCE<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    void f.arrayBuffer().then(async (buf) => {
      const ok = await importStl(buf, f.name.replace(/\.stl$/i, '').slice(0, 24) || 'Model', true)
      if (ok) dip('custom')
      else showToast("couldn't read that model")
    })
  }
  // restore a previously-imported model on mount
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const m = await getModel()
      if (cancelled || !m) return
      await importStl(m.bytes, m.name, false)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // load the bundled default STL models into the dip tray
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
        <button onClick={() => go('home')} aria-label="back" style={{ ...squareBtn, fontWeight: 800 }}>
          ‹
        </button>
        <div style={{ fontFamily: fonts.display, fontSize: 'clamp(15px, 4.6vw, 26px)', textTransform: 'uppercase', letterSpacing: '.01em', flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          Marbling
        </div>
        {phase === 'tray' && !noGl && (
          <>
            <button onClick={() => studioRef.current?.undo()} style={{ ...chip, padding: '9px 10px' }}>
              Undo
            </button>
            <button onClick={() => studioRef.current?.reset()} style={{ ...chip, padding: '9px 10px' }}>
              Reset
            </button>
            <button onClick={keepPaper} style={{ ...chip, padding: '9px 10px', background: c.teal }}>
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
            background: '#fff',
            border: `3px solid ${c.ink}`,
            borderRadius: 6,
            boxShadow: `7px 7px 0 ${c.pink}, 14px 14px 0 rgba(10,90,245,.25)`,
            padding: 10,
          }}
        >
          <canvas
            ref={canvasRef}
            style={{ display: 'block', width: '100%', height: '100%', borderRadius: 3, touchAction: 'none', cursor: 'crosshair' }}
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
                borderRadius: 3,
                padding: 20,
              }}
            >
              <div style={{ fontFamily: fonts.display, fontSize: 24, textTransform: 'uppercase' }}>No ink today</div>
              <div style={{ fontFamily: fonts.body, fontWeight: 700, fontSize: 14, color: c.hint }}>
                this device can't run the marbling tray — the other kits all still work!
              </div>
            </div>
          )}
          {phase === 'tray' && !noGl && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 14,
                textAlign: 'center',
                fontFamily: fonts.body,
                fontWeight: 700,
                fontSize: 13,
                color: 'rgba(22,19,15,.5)',
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
                  border: ink === i ? `4px solid ${c.ink}` : '3px solid rgba(22,19,15,.3)',
                  boxShadow: `0 4px 0 ${k.d}`,
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
                style={{ ...chip, background: tool === i ? c.ink : '#fff', color: tool === i ? c.paper : c.ink }}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em', fontSize: 12, opacity: 0.55 }}>
              Dip
            </span>
            {STL_MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => dip(m.id)}
                style={{ ...chip, background: c.pink, color: c.ink, borderColor: c.ink }}
              >
                {m.emoji} {m.name}
              </button>
            ))}
            {modelName && (
              <button onClick={() => dip('custom')} style={{ ...chip, background: c.teal, color: c.ink, borderColor: c.ink }}>
                {modelName.length > 10 ? 'Model' : modelName}
              </button>
            )}
            <button onClick={() => fileRef.current?.click()} style={{ ...chip, background: '#fff', color: c.ink }}>
              ＋ STL
            </button>
            <input ref={fileRef} type="file" accept=".stl" onChange={onStl} style={{ display: 'none' }} />
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', padding: '4px 16px 26px' }}>
          <div style={{ fontFamily: fonts.body, fontWeight: 700, fontSize: 15, color: c.ink }}>
            a marbled {dipLabel.toLowerCase()} — one of a kind
          </div>
          <div style={{ fontFamily: fonts.body, fontWeight: 700, fontSize: 12, color: c.hint, marginTop: -4 }}>
            drag to turn it around
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={backToTray} style={chip}>
              ‹ Tray
            </button>
            <button
              onClick={addToCollection}
              style={{ ...chip, fontSize: 15, padding: '11px 18px', background: c.teal, color: c.ink, borderColor: c.ink }}
            >
              Add to collection ✓
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
