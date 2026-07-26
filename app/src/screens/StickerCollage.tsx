import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type Konva from 'konva'
import { Group, Image as KImage, Layer, Path, Rect, Ring, Stage, Star } from 'react-konva'
import { IconButton } from '../components/riso'
import { useGame } from '../game/context'
import { clearDraft, loadDraft, saveDraft } from '../game/draftStore'
import { loadStock } from '../game/stock'
import { INKS, c, shadows, text } from '../theme'

const MOTIFS = ['Star', 'Heart', 'Flower', 'Cloud', 'Blob', 'Bolt', 'Ring'] as const
type Motif = (typeof MOTIFS)[number]
const PAPER = '#f4f1e7'
const PPM = 46 // pixels per physics-metre

interface Sticker {
  id: number
  motif: Motif
  ink: number
  x: number
  y: number
  rot: number
  sc: number
}

const chip: CSSProperties = {
  ...text.labelSm,
  color: c.ink,
  background: c.card,
  border: 'none',
  borderRadius: 14,
  padding: '11px 15px',
  minHeight: 44,
  boxShadow: shadows.dropSm,
  cursor: 'pointer',
}

function Shape({ motif, S, ink }: { motif: Motif; S: number; ink: string }) {
  const common = {
    fill: ink,
    stroke: '#ffffff',
    strokeWidth: 5,
    strokeScaleEnabled: false,
    shadowColor: c.ink,
    shadowBlur: 8,
    shadowOpacity: 0.25,
    shadowOffsetY: 3,
    lineJoin: 'round' as const,
  }
  if (motif === 'Star') return <Star numPoints={5} innerRadius={S * 0.44} outerRadius={S} {...common} />
  if (motif === 'Ring') return <Ring innerRadius={S * 0.5} outerRadius={S} {...common} />
  const k = S / 24
  const d =
    motif === 'Heart'
      ? 'M0 19 C -28 -7 -17 -32 0 -13 C 17 -32 28 -7 0 19 Z'
      : motif === 'Flower'
        ? // five petals around a centre
          'M0 -24 C 8 -24 8 -10 2 -7 C 8 -12 20 -19 24 -12 C 28 -5 15 -2 8 -2 C 15 0 25 6 21 13 C 17 20 6 12 2 6 C 4 13 3 26 -5 25 C -13 24 -9 10 -4 5 C -10 10 -22 14 -25 6 C -28 -2 -14 -6 -7 -5 C -14 -8 -22 -16 -16 -21 C -10 -26 -2 -15 0 -9 C -2 -16 -8 -24 0 -24 Z'
        : motif === 'Cloud'
          ? 'M-24 8 C -30 -2 -20 -10 -12 -8 C -12 -18 2 -22 8 -14 C 16 -20 28 -12 24 -3 C 30 2 26 12 18 12 L -16 12 C -21 12 -23 11 -24 8 Z'
          : motif === 'Blob'
            ? 'M0 -22 C 18 -24 27 -6 20 11 C 12 27 -12 29 -22 12 C -31 -6 -18 -20 0 -22 Z'
            : 'M-5 -26 L13 -5 L2 -5 L7 27 L-13 3 L-2 3 Z' // Bolt
  return <Path data={d} scaleX={k} scaleY={k} {...common} />
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function StickerCollage() {
  const { go, play, startFinish } = useGame()
  const [motif, setMotif] = useState(0)
  const [ink, setInk] = useState(0)
  const [stickers, setStickers] = useState<Sticker[]>([])
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [tumble, setTumble] = useState(false)

  const wrapRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const bgRef = useRef<Konva.Rect>(null)
  const nextId = useRef(1)
  const seeded = useRef(false)

  // pattern paper from the Pattern Lab — kits feed each other
  const [patternPaper, setPatternPaper] = useState<HTMLImageElement | null>(null)
  const [usePaper, setUsePaper] = useState(false)
  useEffect(() => {
    const url = loadStock('pattern')
    if (!url) return
    const im = new Image()
    im.onload = () => setPatternPaper(im)
    im.src = url
  }, [])

  // physics (loaded on demand)
  const RAPIER = useRef<any>(null)
  const world = useRef<any>(null)
  const bodies = useRef<Map<number, any>>(new Map())
  const eventQ = useRef<any>(null)
  const lastClatter = useRef(0)
  const raf = useRef(0)
  const grab = useRef<{ id: number; lx: number; ly: number; vx: number; vy: number; t: number; moved: boolean } | null>(null)
  const stickersRef = useRef<Sticker[]>([])
  stickersRef.current = stickers

  const S = size.w * 0.13

  useEffect(() => {
    const measure = () => {
      const el = wrapRef.current
      if (!el) return
      setSize({ w: el.clientWidth, h: el.clientHeight })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // restore a draft, else seed a starter collage, once we know the board size
  useEffect(() => {
    if (seeded.current || size.w < 2) return
    seeded.current = true
    const W = size.w
    const H = size.h
    const draft = loadDraft<{ stickers: { motif: Motif; ink: number; nx: number; ny: number; rot: number; sc: number }[] }>('sticker')
    if (draft?.stickers?.length) {
      setStickers(
        draft.stickers.map((s) => ({
          id: nextId.current++,
          motif: s.motif,
          ink: s.ink,
          x: s.nx * W,
          y: s.ny * H,
          rot: s.rot,
          sc: s.sc,
        })),
      )
      return
    }
    const seeds: [Motif, number, number, number][] = [
      ['Star', 0, 0.32, 0.34],
      ['Blob', 2, 0.64, 0.3],
      ['Heart', 1, 0.5, 0.52],
      ['Bolt', 3, 0.3, 0.66],
      ['Ring', 0, 0.7, 0.66],
    ]
    setStickers(
      seeds.map(([m, ci, nx, ny]) => ({
        id: nextId.current++,
        motif: m,
        ink: ci,
        x: nx * W,
        y: ny * H,
        rot: (Math.random() * 2 - 1) * 22,
        sc: 0.9 + Math.random() * 0.35,
      })),
    )
  }, [size])

  // persist the scene: debounced (tumble updates every frame) but with a
  // max interval so a long tumble still checkpoints, and trailing-edge so
  // the final arrangement is never lost
  const lastSave = useRef(0)
  useEffect(() => {
    if (!seeded.current || size.w < 2 || stickers.length === 0) return
    const doSave = () => {
      lastSave.current = performance.now()
      saveDraft('sticker', {
        stickers: stickers.map((s) => ({ motif: s.motif, ink: s.ink, nx: s.x / size.w, ny: s.y / size.h, rot: s.rot, sc: s.sc })),
      })
    }
    if (performance.now() - lastSave.current > 1500) {
      doSave()
      return
    }
    const t = window.setTimeout(doSave, 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stickers])

  // ---- physics helpers ----
  const addBody = (s: Sticker) => {
    const R = RAPIER.current
    const w = world.current
    if (!R || !w) return
    const r = (S * s.sc * 0.7) / PPM
    const body = w.createRigidBody(
      R.RigidBodyDesc.dynamic().setTranslation(s.x / PPM, s.y / PPM).setLinearDamping(0.15).setAngularDamping(0.5),
    )
    w.createCollider(
      R.ColliderDesc.ball(r).setRestitution(0.3).setFriction(0.7).setDensity(1.2).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),
      body,
    )
    body.setAngvel((Math.random() * 2 - 1) * 4, true)
    bodies.current.set(s.id, body)
  }

  const step = () => {
    const w = world.current
    if (!w) return
    w.step(eventQ.current ?? undefined)
    // tumble clatter: real collisions make real little knocks (throttled)
    if (eventQ.current) {
      let hit = false
      eventQ.current.drainCollisionEvents((_a: number, _b: number, started: boolean) => {
        if (started) hit = true
      })
      const now = performance.now()
      if (hit && now - lastClatter.current > 110) {
        lastClatter.current = now
        play('pop', 0.55 + Math.random() * 0.45)
      }
    }
    setStickers((prev) =>
      prev.map((s) => {
        const b = bodies.current.get(s.id)
        if (!b) return s
        const t = b.translation()
        return { ...s, x: t.x * PPM, y: t.y * PPM, rot: (b.rotation() * 180) / Math.PI }
      }),
    )
    raf.current = requestAnimationFrame(step)
  }

  const enableTumble = async () => {
    if (world.current) return
    try {
      const mod: any = await import('@dimforge/rapier2d-compat')
      const R = mod.default ?? mod
      await R.init()
      RAPIER.current = R
      const w = new R.World({ x: 0, y: 13 })
      world.current = w
      eventQ.current = new R.EventQueue(true)
      const Wm = size.w / PPM
      const Hm = size.h / PPM
      const t = 0.4
      const wall = (x: number, y: number, hx: number, hy: number) => {
        const b = w.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(x, y))
        w.createCollider(R.ColliderDesc.cuboid(hx, hy).setRestitution(0.05).setFriction(0.9), b)
      }
      wall(Wm / 2, Hm + t, Wm / 2 + t, t) // floor
      wall(-t, Hm / 2, t, Hm / 2 + t) // left
      wall(Wm + t, Hm / 2, t, Hm / 2 + t) // right
      wall(Wm / 2, -t, Wm / 2 + t, t) // ceiling
      bodies.current.clear()
      for (const s of stickersRef.current) addBody(s)
      setTumble(true)
      play('page')
      raf.current = requestAnimationFrame(step)
    } catch {
      /* physics unavailable — stay in arrange mode */
      setTumble(false)
    }
  }

  const disableTumble = () => {
    cancelAnimationFrame(raf.current)
    if (world.current) world.current.free()
    world.current = null
    bodies.current.clear()
    grab.current = null
    setTumble(false)
    play('page')
  }

  useEffect(() => {
    return () => {
      cancelAnimationFrame(raf.current)
      if (world.current) world.current.free()
      world.current = null
    }
  }, [])

  const addAt = (x: number, y: number, toss = false) => {
    const s: Sticker = { id: nextId.current++, motif: MOTIFS[motif], ink, x, y, rot: (Math.random() * 2 - 1) * 24, sc: 0.9 + Math.random() * 0.35 }
    setStickers((prev) => [...prev, s])
    if (tumble && world.current) {
      addBody(s)
      if (toss) {
        const b = bodies.current.get(s.id)
        b?.setLinvel({ x: (Math.random() * 2 - 1) * 3, y: 2 }, true)
      }
    }
    play('peel', 0.9 + Math.random() * 0.25) // stickers PEEL off the sheet
  }

  // ---- arrange-mode pointer (Konva draggable) ----
  const onBoardClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (tumble) return
    if (e.target !== bgRef.current) return
    const pos = e.target.getStage()?.getPointerPosition()
    if (pos) addAt(pos.x, pos.y)
  }
  const updatePos = (id: number, x: number, y: number) => {
    setStickers((prev) => prev.map((s) => (s.id === id ? { ...s, x, y } : s)))
  }

  // ---- tumble-mode pointer (grab / toss / drop-in) ----
  const findNear = (x: number, y: number) => {
    let best: number | null = null
    let bestD = S * 1.2
    for (const s of stickersRef.current) {
      const d = Math.hypot(s.x - x, s.y - y)
      if (d < bestD) {
        bestD = d
        best = s.id
      }
    }
    return best
  }
  const onTumbleDown = () => {
    const p = stageRef.current?.getPointerPosition()
    if (!p) return
    const id = findNear(p.x, p.y)
    if (id == null) {
      addAt(p.x, p.y, true)
      return
    }
    const b = bodies.current.get(id)
    if (!b) return
    b.setBodyType(RAPIER.current.RigidBodyType.KinematicPositionBased, true)
    grab.current = { id, lx: p.x, ly: p.y, vx: 0, vy: 0, t: performance.now(), moved: false }
  }
  const onTumbleMove = () => {
    const g = grab.current
    if (!g) return
    const p = stageRef.current?.getPointerPosition()
    if (!p) return
    const b = bodies.current.get(g.id)
    if (!b) return
    b.setNextKinematicTranslation({ x: p.x / PPM, y: p.y / PPM })
    const now = performance.now()
    const dt = Math.max(0.001, (now - g.t) / 1000)
    g.vx = (p.x - g.lx) / PPM / dt
    g.vy = (p.y - g.ly) / PPM / dt
    g.lx = p.x
    g.ly = p.y
    g.t = now
    g.moved = true
  }
  const onTumbleUp = () => {
    const g = grab.current
    if (!g) return
    const b = bodies.current.get(g.id)
    if (b) {
      b.setBodyType(RAPIER.current.RigidBodyType.Dynamic, true)
      const cl = (v: number) => Math.max(-22, Math.min(22, v))
      b.setLinvel({ x: cl(g.vx), y: cl(g.vy) }, true)
      b.setAngvel((Math.random() * 2 - 1) * 6, true)
    }
    grab.current = null
  }

  const undo = () => {
    const last = stickersRef.current[stickersRef.current.length - 1]
    if (!last) return
    setStickers((prev) => prev.slice(0, -1))
    const b = bodies.current.get(last.id)
    if (b && world.current) {
      world.current.removeRigidBody(b)
      bodies.current.delete(last.id)
    }
    play('select')
  }
  const clear = () => {
    setStickers([])
    bodies.current.clear()
    if (world.current) {
      // rebuild an empty world to drop all bodies cleanly
      disableTumble()
    }
    clearDraft('sticker')
    play('page')
  }
  const keep = () => {
    const url = stageRef.current?.toDataURL({ pixelRatio: 2, mimeType: 'image/png' })
    clearDraft('sticker') // kept — next visit starts fresh
    startFinish({ type: 'sticker', title: tumble ? 'Sticker pile' : 'Collage', img: url, tint: INKS[ink].c })
  }

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px' }}>
        <IconButton onClick={() => go('home')} ariaLabel="back" size={44} style={{ ...text.display }}>
          ‹
        </IconButton>
        <div style={{ ...text.display, color: c.ink, flex: 1 }}>Sticker collage</div>
        <IconButton onClick={undo} ariaLabel="undo" size={44} style={{ ...text.title }}>
          ↶
        </IconButton>
        <IconButton onClick={clear} ariaLabel="start again" size={44} style={{ ...text.title }}>
          ↻
        </IconButton>
        <button onClick={keep} style={{ ...chip, background: c.ink, color: c.card, boxShadow: shadows.drop }}>
          Keep ✓
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ position: 'relative', background: c.card, border: 'none', borderRadius: 18, boxShadow: shadows.dropLg, padding: 10 }}>
          <div
            ref={wrapRef}
            style={{
              width: 'min(560px, 88vw, 74vh)',
              aspectRatio: '1 / 1',
              borderRadius: 10,
              overflow: 'hidden',
              touchAction: 'none',
              boxShadow: `0 0 0 1px ${c.line}`,
            }}
          >
            {size.w > 0 && (
              <Stage
                ref={stageRef}
                width={size.w}
                height={size.h}
                onClick={onBoardClick}
                onTap={onBoardClick}
                onMouseDown={tumble ? onTumbleDown : undefined}
                onMouseMove={tumble ? onTumbleMove : undefined}
                onMouseUp={tumble ? onTumbleUp : undefined}
                onTouchStart={tumble ? onTumbleDown : undefined}
                onTouchMove={tumble ? onTumbleMove : undefined}
                onTouchEnd={tumble ? onTumbleUp : undefined}
              >
                <Layer>
                  <Rect ref={bgRef} x={0} y={0} width={size.w} height={size.h} fill={PAPER} />
                  {usePaper && patternPaper && (
                    <KImage image={patternPaper} x={0} y={0} width={size.w} height={size.h} listening={false} opacity={0.85} />
                  )}
                  {stickers.map((s) => (
                    <Group
                      key={s.id}
                      x={s.x}
                      y={s.y}
                      rotation={s.rot}
                      scaleX={s.sc}
                      scaleY={s.sc}
                      draggable={!tumble}
                      onDragEnd={(e) => updatePos(s.id, e.target.x(), e.target.y())}
                    >
                      <Shape motif={s.motif} S={S} ink={INKS[s.ink].c} />
                    </Group>
                  ))}
                </Layer>
              </Stage>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', padding: '4px 16px 22px' }}>
        <div style={{ ...text.meta, color: c.hint }}>
          {tumble ? 'toss & pile them — grab to fling' : 'tap to add · drag to arrange'}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
          {INKS.map((k, i) => (
            <button
              key={i}
              aria-label={`ink ${i + 1}`}
              aria-pressed={ink === i}
              onClick={() => {
                setInk(i)
                play('select')
              }}
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: k.c,
                border: 'none',
                boxShadow:
                  ink === i
                    ? `0 0 0 3px ${c.card}, 0 0 0 4.5px ${c.ink}, ${shadows.drop}`
                    : `inset 0 0 0 1px rgba(64,56,47,.10), ${shadows.dropSm}`,
                transform: ink === i ? 'scale(1.12)' : undefined,
                transition: 'transform .12s',
                cursor: 'pointer',
              }}
            />
          ))}
          <button
            onClick={() => (tumble ? disableTumble() : enableTumble())}
            aria-pressed={tumble}
            style={{ ...chip, marginLeft: 6, background: tumble ? c.ink : c.card, color: tumble ? c.card : c.ink }}
          >
            {tumble ? '✦ tumble' : '↯ tumble'}
          </button>
          {patternPaper && (
            <button
              onClick={() => {
                setUsePaper((v) => !v)
                play('page')
              }}
              aria-pressed={usePaper}
              style={{ ...chip, background: usePaper ? c.ink : c.card, color: usePaper ? c.card : c.ink }}
            >
              ❖ your paper
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ ...text.eyebrow, color: c.faint }}>Sticker</span>
          {MOTIFS.map((label, i) => (
            <button
              key={label}
              onClick={() => setMotif(i)}
              aria-pressed={i === motif}
              style={{ ...chip, padding: '9px 14px', borderRadius: 12, background: i === motif ? c.ink : c.card, color: i === motif ? c.card : c.ink }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
