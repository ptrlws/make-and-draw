import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Card, RisoButton } from '../components/riso'
import { useGame } from '../game/context'
import { downloadBlob } from '../game/exporter'
import { getImages } from '../game/imageStore'
import { c, fonts } from '../theme'
import type { GalleryItem } from '../types'
import { plural } from '../utils'

const pill = (on: boolean): CSSProperties => ({
  width: 52,
  height: 30,
  borderRadius: 6,
  border: `2.5px solid ${c.ink}`,
  background: on ? c.teal : c.toggleOff,
  display: 'flex',
  alignItems: 'center',
  padding: 2,
  transition: 'background .15s',
})
const knob = (on: boolean): CSSProperties => ({
  width: 22,
  height: 22,
  borderRadius: 4,
  background: '#fff',
  border: `2px solid ${c.ink}`,
  transform: `translateX(${on ? 22 : 0}px)`,
  transition: 'transform .15s',
})
const row: CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  background: '#fff',
  border: `2.5px solid ${c.ink}`,
  borderRadius: 6,
  padding: '14px 16px',
  boxShadow: '0 3px 0 #16130f',
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
      style={{ position: 'absolute', inset: 0, zIndex: 40, background: 'rgba(22,19,15,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22 }}
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
        <Card spot={c.pink} offset={7} radius={10} style={{ padding: 24 }}>
          <div style={{ fontFamily: fonts.display, fontSize: 30, textTransform: 'uppercase', lineHeight: 1 }}>Settings</div>
          <div style={{ fontFamily: fonts.body, fontWeight: 700, fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase', color: c.sub, margin: '4px 0 18px' }}>
            for grown-ups
          </div>

          <button onClick={toggleMute} role="switch" aria-checked={soundOn} aria-label="Sound" style={{ ...row, marginBottom: 12 }}>
            <span style={{ fontFamily: fonts.body, fontWeight: 800, fontSize: 16 }}>Sound</span>
            <span style={pill(soundOn)}>
              <span style={knob(soundOn)} />
            </span>
          </button>
          <button onClick={toggleCalm} role="switch" aria-checked={state.calm} aria-label="Calm mode" style={row}>
            <span style={{ textAlign: 'left' }}>
              <span style={{ fontFamily: fonts.body, fontWeight: 800, fontSize: 16, display: 'block' }}>Calm mode</span>
              <span style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: 12, color: c.sub }}>gentle confetti, less motion</span>
            </span>
            <span style={pill(state.calm)}>
              <span style={knob(state.calm)} />
            </span>
          </button>

          {/* the collection can leave the device — and come back */}
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            {state.gallery.length > 0 && (
              <button onClick={() => void backup()} style={{ ...row, flex: 1, justifyContent: 'center' }}>
                <span style={{ fontFamily: fonts.body, fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '.04em' }}>⬇ Back up</span>
              </button>
            )}
            <button onClick={() => fileRef.current?.click()} style={{ ...row, flex: 1, justifyContent: 'center' }}>
              <span style={{ fontFamily: fonts.body, fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '.04em' }}>⬆ Restore</span>
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
                background: confirmClear ? c.pink : '#fff',
                color: confirmClear ? c.paper : c.ink,
              }}
            >
              <span style={{ fontFamily: fonts.body, fontWeight: 800, fontSize: 14, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                {confirmClear ? `tap again to clear ${plural(state.gallery.length, 'piece')}` : `Clear collection (${state.gallery.length})`}
              </span>
            </button>
          )}

          <div style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: 12, color: c.faint, textAlign: 'center', margin: '16px 0 4px' }}>
            {state.name ? `Playing as ${state.name}` : 'No name on the cover yet'} · saved on this device ·{' '}
            <button
              onClick={() => {
                closeSettings()
                go('name')
              }}
              style={{
                fontFamily: fonts.body,
                fontWeight: 700,
                fontSize: 12,
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
            style={{ display: 'block', width: '100%', fontFamily: fonts.body, fontWeight: 700, fontSize: 12, lineHeight: 1.4, color: c.sub, textAlign: 'center', margin: '2px 0 8px', padding: '8px 10px', background: 'rgba(47,184,179,.1)', border: `1.5px solid rgba(47,184,179,.45)`, borderRadius: 8, cursor: 'pointer' }}
          >
            No ads · no accounts · no tracking.
            <br />
            Art stays on this device unless <em>you</em> share it. <span style={{ textDecoration: 'underline' }}>Read more →</span>
          </button>
          <div style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: 10.5, lineHeight: 1.35, color: c.faint, textAlign: 'center', marginBottom: 6 }}>
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
