import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Card, RisoButton } from '../components/riso'
import { useGame } from '../game/context'
import { downloadBlob } from '../game/exporter'
import { getImages } from '../game/imageStore'
import { c, fonts, shadows } from '../theme'
import type { GalleryItem } from '../types'
import { plural } from '../utils'

const pill = (on: boolean): CSSProperties => ({
  width: 52,
  height: 30,
  borderRadius: 15,
  border: 'none',
  background: on ? c.green : c.toggleOff,
  boxShadow: on ? 'none' : `inset 0 0 0 1px ${c.line}`,
  display: 'flex',
  alignItems: 'center',
  padding: 3,
  transition: 'background .15s',
})
const knob = (on: boolean): CSSProperties => ({
  width: 24,
  height: 24,
  borderRadius: '50%',
  background: c.card,
  border: 'none',
  boxShadow: shadows.dropSm,
  transform: `translateX(${on ? 22 : 0}px)`,
  transition: 'transform .15s',
})
const row: CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  background: c.card,
  color: c.ink,
  border: 'none',
  borderRadius: 14,
  padding: '14px 16px',
  boxShadow: `inset 0 0 0 1px ${c.line}, ${shadows.dropSm}`,
  cursor: 'pointer',
}

/** Grown-ups' settings: sound + calm mode. */
export function Settings() {
  const { state, closeSettings, toggleMute, toggleCalm, clearCollection, go, importCollection, showToast } = useGame()
  const panelRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  // ---- backup & restore: the collection is precious — let it leave the device ----
  const backup = async () => {
    const items = state.gallery
    const ids = items.map((g) => g.id)
    const imgs = await getImages(ids)
    const payload = {
      v: 1,
      app: 'make-and-draw',
      name: state.name,
      items: items.map((g) => ({ id: g.id, type: g.type, title: g.title, tint: g.tint, fills: g.fills, img: g.img ?? imgs[g.id] })),
    }
    downloadBlob(new Blob([JSON.stringify(payload)], { type: 'application/json' }), 'make-and-draw-backup.json')
    showToast('backup saved!')
  }
  const restore = async (f: File) => {
    try {
      const data = JSON.parse(await f.text()) as { v?: number; app?: string; items?: GalleryItem[] }
      if (data.app !== 'make-and-draw' || !Array.isArray(data.items)) {
        showToast("that file isn't a Make & Draw backup")
        return
      }
      const added = await importCollection(data.items)
      showToast(added > 0 ? `restored ${plural(added, 'piece')}!` : 'nothing new in that backup')
    } catch {
      showToast("couldn't read that backup")
    }
  }

  useEffect(() => {
    if (!confirmClear) return
    const t = window.setTimeout(() => setConfirmClear(false), 3500)
    return () => clearTimeout(t)
  }, [confirmClear])

  useEffect(() => {
    if (!state.settingsOpen) return
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSettings()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.settingsOpen, closeSettings])

  if (!state.settingsOpen) return null
  const soundOn = !state.muted

  return (
    <div
      onClick={closeSettings}
      style={{ position: 'absolute', inset: 0, zIndex: 40, background: 'rgba(64,56,47,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22 }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(380px, 92vw)', outline: 'none' }}
      >
        <Card radius={18} style={{ padding: 24, color: c.ink, boxShadow: shadows.dropLg }}>
          <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 32, letterSpacing: '-.02em', lineHeight: 1.05, color: c.ink }}>Settings</div>
          <div style={{ fontFamily: fonts.body, fontWeight: 700, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: c.faint, margin: '5px 0 18px' }}>
            for grown-ups
          </div>

          <button onClick={toggleMute} role="switch" aria-checked={soundOn} aria-label="Sound" style={{ ...row, marginBottom: 12 }}>
            <span style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 15, letterSpacing: '-.005em' }}>Sound</span>
            <span style={pill(soundOn)}>
              <span style={knob(soundOn)} />
            </span>
          </button>
          <button onClick={toggleCalm} role="switch" aria-checked={state.calm} aria-label="Calm mode" style={row}>
            <span style={{ textAlign: 'left' }}>
              <span style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 15, letterSpacing: '-.005em', display: 'block' }}>Calm mode</span>
              <span style={{ fontFamily: fonts.body, fontWeight: 500, fontSize: 11, color: c.hint }}>gentle confetti, less motion</span>
            </span>
            <span style={pill(state.calm)}>
              <span style={knob(state.calm)} />
            </span>
          </button>

          {/* switch between the makers who share this device */}
          <button
            onClick={() => {
              closeSettings()
              go('profiles')
            }}
            style={{ ...row, marginTop: 12 }}
          >
            <span style={{ textAlign: 'left' }}>
              <span style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 15, letterSpacing: '-.005em', display: 'block' }}>Makers</span>
              <span style={{ fontFamily: fonts.body, fontWeight: 500, fontSize: 11, color: c.hint }}>
                {state.profiles.length > 1 ? `${state.profiles.length} on this device · switch or add` : 'add another maker'}
              </span>
            </span>
            <span style={{ display: 'flex' }}>
              {state.profiles.slice(0, 4).map((p, i) => (
                <span
                  key={p.id}
                  style={{ width: 22, height: 22, borderRadius: '50%', background: p.color, border: 'none', boxShadow: `0 0 0 2px ${c.card}`, marginLeft: i ? -6 : 0 }}
                />
              ))}
            </span>
          </button>

          {/* the collection can leave the device — and come back */}
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            {state.gallery.length > 0 && (
              <button onClick={() => void backup()} style={{ ...row, flex: 1, justifyContent: 'center' }}>
                <span style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 13, letterSpacing: '-.005em' }}>⬇ Back up</span>
              </button>
            )}
            <button onClick={() => fileRef.current?.click()} style={{ ...row, flex: 1, justifyContent: 'center' }}>
              <span style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 13, letterSpacing: '-.005em' }}>⬆ Restore</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) void restore(f)
              }}
            />
          </div>

          {state.gallery.length > 0 && (
            <button
              onClick={() => {
                if (confirmClear) {
                  clearCollection()
                  setConfirmClear(false)
                } else {
                  setConfirmClear(true)
                }
              }}
              style={{
                ...row,
                marginTop: 12,
                justifyContent: 'center',
                // armed state is a filled ink chip, not an outline or a pigment
                background: confirmClear ? c.ink : c.card,
                color: confirmClear ? c.card : c.ink,
                boxShadow: confirmClear ? shadows.drop : row.boxShadow,
              }}
            >
              <span style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 15, letterSpacing: '-.005em' }}>
                {confirmClear ? `tap again to clear ${plural(state.gallery.length, 'piece')}` : `Clear collection (${state.gallery.length})`}
              </span>
            </button>
          )}

          <div style={{ fontFamily: fonts.body, fontWeight: 500, fontSize: 11, color: c.faint, textAlign: 'center', margin: '16px 0 4px' }}>
            {state.name ? `Playing as ${state.name}` : 'No name on the cover yet'} · saved on this device ·{' '}
            <button
              onClick={() => {
                closeSettings()
                go('name')
              }}
              style={{
                fontFamily: fonts.body,
                fontWeight: 600,
                fontSize: 11,
                color: c.hint,
                background: 'none',
                border: 'none',
                textDecoration: 'underline',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {state.name ? 'change name' : 'add a name'}
            </button>
          </div>
          <button
            onClick={() => {
              closeSettings()
              go('grownups')
            }}
            style={{
              display: 'block',
              width: '100%',
              fontFamily: fonts.body,
              fontWeight: 500,
              fontSize: 11,
              lineHeight: 1.45,
              color: c.sub,
              textAlign: 'center',
              margin: '2px 0 8px',
              padding: '10px 12px',
              background: c.paper,
              border: 'none',
              boxShadow: `inset 0 0 0 1px ${c.line}`,
              borderRadius: 12,
              cursor: 'pointer',
            }}
          >
            No ads · no accounts · no tracking.
            <br />
            Art stays on this device unless <em>you</em> share it. <span style={{ textDecoration: 'underline' }}>Read more →</span>
          </button>
          <div style={{ fontFamily: fonts.body, fontWeight: 500, fontSize: 11, lineHeight: 1.4, color: c.faint, textAlign: 'center', marginBottom: 6 }}>
            Imported 3D models © their authors — low-poly cat &amp; dog by Matthias L, Balloon Dog by TheCraftyMaker (Printables). Personal use; see CREDITS.
          </div>
          <RisoButton onClick={closeSettings} variant="primary" style={{ width: '100%', marginTop: 6 }}>
            All done
          </RisoButton>
        </Card>
      </div>
    </div>
  )
}
