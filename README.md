# Handoff: EMakeDraw — children's craft-play studio

## Overview
EMakeDraw is a touch-first creative studio for children (~4–9). The child browses a wall of craft "kits" on shelves, opens one, makes something, and every session ends with a finishing ritual that tucks the creation into a personal **gallery book**. No accounts, no reading required, everything saved on-device.

This bundle delivers the **core loop end-to-end**: first-launch name entry → shelves home → two fully playable activities (**marble painting**, **colour by number**) → gallery book. The other six kits open a friendly "still drying" stub. Chosen visual direction: **"Esther's scrapbook"** — cut-paper cards, washi tape, wobbly ink outlines, hand lettering.

## About the design files
`EMakeDraw.dc.html` is a **design reference built in HTML/JS** — a working prototype showing intended look and behavior. It is **not production code to ship as-is**. The task is to **recreate it in the target codebase's environment** (React/Vue/SwiftUI/native) using that project's established patterns, component library, state, and asset pipeline. If no environment exists yet, pick the most appropriate stack (a component-based framework such as React is a natural fit given the screen/state model below) and implement there.

> Built as a single "Design Component" (`.dc.html`) with an inline template + a `Component` logic class. Treat the logic class as a spec of behavior, not a file to port verbatim.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, copy, motion, and interactions are all defined here and should be recreated faithfully. The only intentional placeholders are the **kit artwork** (rendered as diagonal-stripe swatches) — these mark where **Esther's own drawings** go. Do not ship the stripe placeholders; wire real illustrations into those slots.

---

## Screens / Views

### 1. Name entry (first launch only)
- **Purpose**: child types their name — the *only* typing in the app; it titles the gallery book.
- **Layout**: centered card, `min(440px, 92vw)`, on the paper background. Card padding `34px 28px 30px`.
- **Components**:
  - Card: `#fffdf6`, `3px solid #3a322a`, wobbly radius `26px 30px 24px 28px`, shadow `5px 7px 0 rgba(58,50,42,.16)`; a washi-tape strip (`90×26`, `rgba(244,192,38,.6)`, rotated -3°) pinned at top.
  - Three "crayon" bars (simple rounded rects in `#f2779f / #2fb8b3 / #f4c026`, each `2.5px` ink border, slight rotations).
  - Title lockup: "Esther's" in **Gochi Hand** 24px `#c85a3c` rotated -2°; "Make & Draw" in **Baloo 2 800** 38px `#3a322a`.
  - Prompt: "Hello! what's your name?" Gochi Hand 20px `#6b5d48`.
  - Text input: centered, Baloo 2 700 26px, `#fff` bg, `3px solid #3a322a`, radius 16px, `maxlength=14`, placeholder "type here".
  - Button "that's me! →": Baloo 2 800 22px, `#fff` on `#c85a3c`, `3px` ink border, radius 18px, shadow `0 5px 0 #3a322a`, min-height 64px.
  - Footnote: "it goes on the cover of your gallery book" Nunito 600 12px `#a8956f`.
- **Behavior**: Enter key or button confirms. Empty → defaults to "Esther". On confirm → save name, go to home.

### 2. Shelves home
- **Purpose**: pick a kit or open the book.
- **Layout**: scrollable column, content `max-width:640px` centered. Sticky header (`rgba(243,235,216,.94)`, blur). Kit grid: **2 columns**, `gap:16px`, padding `6px 15px 26px`.
- **Header**: title lockup (Gochi "Esther's" 19px `#c85a3c` + Baloo 800 30px "Make & Draw"); right cluster of two 48px taped-circle buttons — **sound** (speaker glyph; struck-through coral bar when muted) and **settings** (three dots). Greeting line "Hi {name}! let's make a mess →" Gochi 18px `#7a6a52`.
- **Kit cards (×8)**: `#fffdf6`, `2.5px solid #3a322a`, wobbly asymmetric radii, offset shadow `3px 4px 0 rgba(58,50,42,.16)`, rotations alternating ~-2°/+2°. Each: a washi-tape strip on top, an 84px-tall artwork swatch (`2px` ink border, radius 9px), and a Gochi Hand 18px label. Full card is the tap target.
  - Kits & routes: **marble inks**→marble, **colour by number**→cbn, **moulds / squishies / dot-to-dot / jigsaws / stickers / butterflies**→stub.
- **Gallery book card** (full width): taped, holds a mini book graphic (`#e0a63f` with darker spine) + "Esther's gallery book" (Gochi 22px) + "{n} things you've made →". Taps → book.
- **"more kits coming soon!"** sticky note (`#f7e07a`, rotated, gentle bob animation).

### 3. Marble painting
- **Purpose**: swirl inks, then take a print or dip a toy.
- **Layout**: column header + body. Body is **responsive**: landscape → tray (flex:1, centered) beside a fixed 204px tool panel; portrait → tray on top, tool panel below (wrapping rows). Layout switch driven by JS (`landscape = innerWidth > innerHeight && innerWidth > 760`).
- **Header**: back ‹ (52px taped circle), title "marble painting" (Gochi 22px), "start again" button, **Finish** button (Baloo 800 16px, `#fff` on `#c85a3c`, diamond icon, min-height 52px).
- **Tray**: square, `4px solid #3a322a`, radius 18px, inset `0 0 0 6px #fff`, base liquid `#eef3f0`. A `<canvas>` fills it; `touch-action:none`.
- **Tool panel** (`rgba(255,253,246,.92)`, `2.5px` border, radius 20px): hint line; 4 **ink** swatches (52px circles, teal `#2fb8b3` / orange `#f2913d` / pink `#f2779f` / yellow `#f4c026`, selected = 4px ink border + scale 1.12 + `0 4px 0` colored drop); **comb** toggle (56px, inverts to `#3a322a` when on); **undo** (↶); **make a print** (yellow); **dip a toy** (blue). All ≥56px.
- **Canvas behavior** (see Interactions): tap = drip concentric rings of selected ink; drag = smear/swirl existing paint.

### 4. Colour by number
- **Purpose**: fill numbered regions with matching paint pots.
- **Layout**: same responsive body pattern as marble. Picture stage aspect `300/348` inside a `#fffdf6` framed card.
- **Picture** = a **flower composed of simple CSS shapes** (no illustration needed): background rect (region n=4), N petals (circles, n=2), a stem (rect, n=3), 2 leaves (diamonds, n=3), a center (circle, n=1). Petal count by difficulty: easy 4 / medium 6 / hard 8. Each region is a button with an ink border and a large centered numeral (**Baloo 2 800**, `clamp(13px,3.6vw,22px)`); diamond leaves counter-rotate their numeral so it reads upright.
- **Paint pots** (edge tray): 4 pots — 1 `#f4c026`, 2 `#f2779f`, 3 `#63b34a`, 4 `#7cc0e8` — 56px, Baloo 800 numeral, selected = 4px border + lift.
- **Header**: back ‹; "• dots / 1·2·3" toggle (pre-reader mode shows a colored ● instead of the numeral); **Finish** (disabled grey `#c9bfa6` until complete).

### 5. Gallery book
- **Purpose**: browse finished creations; turns like a real book.
- **Cover** (closed): `min(360px,80vw)`, aspect `3/3.7`, `#d98a3c`, `4px` ink border, radius `8px 20px 20px 8px`, spine + page-edge detail, "Esther's / Gallery / Book" lettering, diamond crest, "tap to open", gentle bob.
- **Open spread**: two pages. **Left** = caption page ("you coloured / you painted…" kicker in Gochi 22px `#c85a3c`, title Baloo 800 26px, note Gochi 16px). **Right** = artwork in a rotated framed card. Inner-gutter shadows sell the fold. Prev/next 60px circle buttons + "{i} of {n}" counter.
- **Thumbnails**: real saves store an image (marble print / marbled-toy PNG); colour-by-number renders the finished flower; samples use per-type motifs.
- **Header**: back ‹, title "{name}'s gallery book", share button (placeholder → toast "sharing is for grown-ups").

### 6. Stub easel ("still drying")
- Friendly placeholder for the six unbuilt kits: an easel (paper card on two legs), a wobbling colored disc, "still drying!" (Gochi 26px `#c85a3c`), "this kit is nearly ready. come back very soon!", and a "back to the shelves" button.

### Overlays
- **Settings** (grown-ups): modal card with **Sound** and **Calm mode** toggle rows (pill switches; on = `#63b34a`), "Playing as {name} · saved on this device", "all done" button. Tap scrim to close.
- **Finishing ritual**: dark scrim; the artwork **gathers** to center (scale up), **bursts** with fireworks particles, then **flies** toward the book and is added to the gallery; text "into {name}'s book!" → returns home with a toast. **Calm mode** replaces fireworks with a gentle confetti fall.
- **Toast**: pill at bottom-center, `#3a322a`/white, Baloo 700 15px, auto-dismiss ~1.9s.

---

## Interactions & Behavior

- **Finishing ritual** (shared, signature moment): `gather` (~420ms) → `burst` (~1.1s, particle divs animated out via CSS `fw` keyframe using per-particle `--tx/--ty` custom props) → `fly` (art transforms toward book corner) → add to gallery, go home, toast. Calm/reduced-motion → confetti (`conf` keyframe) + softened sound.
- **Marble drip**: tap → 4 concentric rings `[26px ink, 17px darker, 9px white@60%, 4px ink]` at the point.
- **Marble swirl**: pointer-drag → clip a disc (radius 22px, comb 36px) at the new point and `drawImage` the canvas from the previous point into it, dragging paint into streaks.
- **Marble print**: snapshot canvas → `paint`→`lower` (paper slides over tray, 700ms)→`peel` (paper lifts showing the transferred pattern, ~950ms)→`print`. Finish saves the print PNG.
- **Marble dip-a-toy**: snapshot canvas; a car (rounded-rect body + window + two wheels) lifts in via `dipLift` keyframe wearing the pattern; a matching PNG is composited on an offscreen canvas (pattern clipped to the car body) and saved.
- **Colour by number**: tap pot → arm color; tap region → if number matches, fill + `popin`; if not, region does a `wob` shake + soft "wrong" tone (never a fail state); if no pot armed, toast "pick a paint pot first!". All filled → `shim` shimmer sweep + Finish enabled.
- **Book**: tap cover to open; prev/next flip pages (clamped); back → shelves.
- **Undo / start again**: marble keeps up to 10 canvas snapshots (one per gesture); "start again" clears the tray.
- **Sound**: WebAudio synth foley — `drip / swirl / pop / page / wrong / fw`. Lazily created on first gesture. Global mute; calm mode lowers volume and softens fireworks.
- **Responsive**: JS-driven `landscape` flag toggles tool trays between side (landscape) and below (portrait). Touch targets ≥48–64px throughout.
- **Reduced motion**: `@media (prefers-reduced-motion:reduce)` collapses animations/transitions; calm mode also honored programmatically.

## State Management
Single component state (persisted subset in `localStorage` key `emd_v1` = `{name, muted, calm, gallery}`):
- `name`, `screen` (`name|home|marble|cbn|book|stub`), `stubKit`, `landscape`
- `muted`, `calm`, `settingsOpen`, `toast`, `finishing` (`{type,title,img,tint,phase,parts,text}`)
- Marble: `mkInk` (0–3), `mkComb`, `mkPhase` (`paint|lower|peel|print|toy`); canvas + undo stack held on an instance object, not React state.
- CBN: `cbnPot`, `cbnFills` (`{regionId:number}`), `cbnDots`, `cbnDone`, `cbnWobble`
- Book: `bookOpened`, `bookIdx`
- `gallery`: array of `{id, type, title, tint, img?, fills?, petals?}`. Prefilled with sample creations so the book feels alive; new work is prepended.
- Tweakable props (dev-facing): `calmMode`, `sound`, `difficulty` (easy|medium|hard), `skipNameEntry`.

## Design Tokens
**Type**: Baloo 2 (500–800) — display, numerals, buttons · Nunito (400–800) — body/UI · Gochi Hand — hand-lettered labels & greetings.

**Neutrals / paper**: bg `#f3ebd8` (with faint dot texture), `#e6d9bf`, `#e9dcbf`; cards `#fffdf6`, `#fdfaf0`; header wash `rgba(243,235,216,.94)`.
**Ink (text/outline)**: `#3a322a`. **Accent**: coral `#c85a3c`; sunshine `#f4c026`.
**Kit colors (base / shade)**: marble teal `#2fb8b3` / `#229a95` · moulds terracotta `#d9714e` / `#b34e2e` · squishy pink `#f2779f` / `#d94f7c` · dot-to-dot yellow `#f4c026` / `#d9a81a` · jigsaw green `#63b34a` / `#4a9636` · colour-by-number blue `#3f8fd6` / `#2f6fb0` · sticker purple `#9a6bd1` / `#7a4cc0` · butterfly orange `#f2913d` / `#d9702a`.
**CBN pots**: 1 `#f4c026`, 2 `#f2779f`, 3 `#63b34a`, 4 `#7cc0e8`. **Marble inks**: `#2fb8b3`, `#f2913d`, `#f2779f`, `#f4c026`.
**Book cover**: `#d98a3c` / spine `#c2762e`; sample book graphic `#e0a63f`.
**Card recipe**: `#fffdf6` fill, `2.5px solid #3a322a`, asymmetric wobbly `border-radius`, rotation ±0.6–2.2°, shadow `3px 4px 0 rgba(58,50,42,.16)`, washi-tape strip (semi-transparent kit color, `~54×20`, small rotation) pinned at top.
**Buttons**: taped circles 44–52px (`#fffdf6`, `2.5px` ink border, `0 4px 0 #3a322a`); primary actions Baloo 800 on `#c85a3c` with `0 5px 0 #3a322a`.
**Radii**: cards ~15–24px (asymmetric); tool buttons 14–16px; pills 16px. **Border widths**: 2–4px ink. **Spacing**: grid gap 16px; card padding ~11–14px. **Min touch target**: 48–64px.
**Motion keyframes**: `bob`, `wagg`, `wob` (wrong-tap), `popin` (fill), `shim` (complete shimmer), `fw` (fireworks), `conf` (calm confetti), `rise` (modal/toast in), `flutt` (future butterfly), `dipLift` (toy). Reward-only motion; ambient motion minimal.

## Assets
- **Fonts**: Google Fonts — Baloo 2, Nunito, Gochi Hand.
- **Kit artwork**: none supplied — currently diagonal-stripe placeholders. **Replace with Esther's illustrations** (one per kit; also usable for the logo lettering). Everything else (jars, cards, book, easel, car, flower, icons) is CSS/canvas primitives, no image assets.
- **Sound**: procedural WebAudio (no audio files).

## Files
- `EMakeDraw.dc.html` — the complete prototype (all screens, activities, book, overlays, logic).
- `screenshots/01–12` — key screens in order: name entry, home, marble tray, marble dip-a-toy, colour-by-number (empty), colour-by-number (filled), book cover, book spread, "still drying" stub, settings, and the finishing ritual. Note: the marble tray/car appear empty in static captures because a live `<canvas>` can't be read by the screenshot renderer — in the running app they show the swirled paint (see README interactions).

## Not yet built (roadmap, per the original spec)
- The other six activities (moulds, squishies, dot-to-dot, jigsaws, sticker scenes, butterfly painting) — currently the "still drying" stub.
- Book special sections tied to those: the **living butterfly house** spread, the **sticker section**, and **photographed/rotatable mould** pages.
- Real **share/download** via the device share sheet (currently a placeholder toast).
