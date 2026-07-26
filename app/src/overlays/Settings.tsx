import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Card, RisoButton } from '../components/riso'
import { useGame } from '../game/context'
import { downloadBlob } from '../game/exporter'
import { getImages } from '../game/imageStore'
import { c, shadows, text } from '../theme'
import type { GalleryItem } from '../types'
import { plural } from '../utils'

/* ------------------------------------------------------------------ *
 * Grown-ups' settings.
 *
 * One sheet of paper, ruled into rows — not a stack of floating cards
 * inside another card. The hierarchy is the point: switches read as
 * switches, the collection tools are grouped under their own heading,
 * and the one destructive action is deliberately the quietest thing on
 * the panel until it is armed.
 * ------------------------------------------------------------------ */

const pill = (on: boolean): CSSProperties => ({
  width: 50,
  height: 30,
  flex: 'none',
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
  boxShadow: shadows.dropSm,
  transform: `translateX(${on ? 20 : 0}px)`,
  transition: 'transform .15s',
})

/** a ruled row on the sheet — no card, no shadow, just a hairline above it */
const row = (first = false): CSSProperties => ({
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 14,
  background: 'none',
  border: 'none',
  borderTop: first ? 'none' : `1px solid ${c.line}`,
  padding: '14px 0',
  textAlign: 'left',
  color: c.ink,
  cursor: 'pointer',
})

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

  /** a plain text action — used for anything that isn't a switch */
  const link: CSSProperties = {
    ...text.meta,
    color: c.hint,
    background: 'none',
    border: 'none',
    padding: 0,
    textDecoration: 'underline',
    textUnderlineOffset: 3,
    cursor: 'pointer',
  }

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
        style={{ width: 'min(380px, 92vw)', maxHeight: '92dvh', overflowY: 'auto', outline: 'none' }}
      >
        <Card radius={18} style={{ padding: '22px 22px 20px', color: c.ink, boxShadow: shadows.dropLg }}>
          <div style={{ ...text.eyebrow, color: c.faint }}>For grown-ups</div>
          <div style={{ ...text.hero, color: c.ink, margin: '4px 0 14px' }}>Settings</div>

          <button onClick={toggleMute} role="switch" aria-checked={soundOn} aria-label="Sound" style={row(true)}>
            <span style={{ ...text.label }}>Sound</span>
            <span style={pill(soundOn)}>
              <span style={knob(soundOn)} />
            </span>
          </button>

          <button onClick={toggleCalm} role="switch" aria-checked={state.calm} aria-label="Calm mode" style={row()}>
            <span>
              <span style={{ ...text.label, display: 'block' }}>Calm mode</span>
              <span style={{ ...text.meta, color: c.hint }}>gentle confetti, less motion</span>
            </span>
            <span style={pill(state.calm)}>
              <span style={knob(state.calm)} />
            </span>
          </button>

          <button
            onClick={() => {
              closeSettings()
              go('profiles')
            }}
            style={row()}
          >
            <span>
              <span style={{ ...text.label, display: 'block' }}>Makers</span>
              <span style={{ ...text.meta, color: c.hint }}>
                {state.profiles.length > 1 ? `${state.profiles.length} on this device` : 'add another child'}
              </span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {state.profiles.slice(0, 4).map((p, i) => (
                <span
                  key={p.id}
                  style={{ width: 18, height: 18, borderRadius: '50%', background: p.color, boxShadow: `0 0 0 2px ${c.card}`, marginLeft: i ? -9 : 0 }}
                />
              ))}
              <span style={{ ...text.title, color: c.faint, lineHeight: 1 }}>›</span>
            </span>
          </button>

          {/* the collection: file operations grouped, destructive one set apart */}
          <div style={{ borderTop: `1px solid ${c.line}`, padding: '14px 0 0' }}>
            <div style={{ ...text.eyebrow, color: c.faint, marginBottom: 8 }}>The collection</div>
            <div style={{ display: 'flex', gap: 18, alignItems: 'baseline', flexWrap: 'wrap' }}>
              {state.gallery.length > 0 && (
                <button onClick={() => void backup()} style={link}>
                  Back up to a file
                </button>
              )}
              <button onClick={() => fileRef.current?.click()} style={link}>
                Restore from a file
              </button>
              {state.gallery.length > 0 && (
                <button
                  onClick={() => (confirmClear ? (clearCollection(), setConfirmClear(false)) : setConfirmClear(true))}
                  style={{ ...link, color: confirmClear ? c.pink : c.faint, fontWeight: confirmClear ? 700 : 500 }}
                >
                  {confirmClear ? `tap again to delete ${plural(state.gallery.length, 'piece')}` : 'Clear it'}
                </button>
              )}
            </div>
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

          <div style={{ borderTop: `1px solid ${c.line}`, margin: '16px 0 0', padding: '14px 0 0' }}>
            <div style={{ ...text.meta, color: c.faint }}>
              {state.name ? `Playing as ${state.name}` : 'No name on the cover yet'} ·{' '}
              <button
                onClick={() => {
                  closeSettings()
                  go('name')
                }}
                style={{ ...link, ...text.meta, color: c.hint }}
              >
                {state.name ? 'change name' : 'add a name'}
              </button>
            </div>
            <div style={{ ...text.meta, color: c.faint, marginTop: 6 }}>
              Nothing here is tracked, sold or uploaded ·{' '}
              <button
                onClick={() => {
                  closeSettings()
                  go('grownups')
                }}
                style={{ ...link, ...text.meta, color: c.hint }}
              >
                the full promise
              </button>
            </div>
          </div>

          <RisoButton onClick={closeSettings} variant="primary" style={{ width: '100%', marginTop: 18 }}>
            All done
          </RisoButton>
        </Card>
      </div>
    </div>
  )
}
