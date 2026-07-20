# Make & Draw

A calm, ad-free **craft-play studio for kids** — marble inks, colour-by-number, scratch art and more, right in the browser. No accounts, no tracking, nothing to buy. Every creation is saved on the device and never leaves it unless you choose to print or share.

**Make & Draw was Esther's idea.** The whole studio began with her.

🔗 **Live:** https://ptrlws.github.io/make-and-draw/ *(after Pages is enabled — see [Deploying](#deploying))*

---

## What's inside

Eight activities, each ending in a little "finishing ritual" that tucks the piece into the child's own **collection book**:

| Activity | What it is |
| --- | --- |
| 🎨 **Marble inks** | Swirl inks on water, then dip toys to print the pattern (powered by bundled 3D models) |
| 🔢 **Colour by number** | Fill the numbered regions, then print it — pictures come from a bundled PNG/SVG library or your own photo |
| 🌀 **Pattern lab** | Spin a kaleidoscope tile |
| 🖨️ **Print shop** | Overprint bold stamps |
| ✳️ **Dot-to-dot** | Join the dots to reveal a picture |
| 🌈 **Scratch art** | Scratch off a black coat to find holographic foil or a real coloured picture underneath — with fine pick, flat and comb tools |
| 🦋 **Butterflies** | Paint one wing and it mirrors symmetrically |
| ✨ **Stickers** | Peel and arrange a sticker collage, with playful "tumble" physics |

Multiple children can share one device: each **maker** has their own name, collection, works-in-progress and settings. When there's more than one, the app opens with a friendly "who's making?" picker.

## For grown-ups

The app carries a "For grown-ups" page stating exactly how it behaves — and every line is built into the code, not just a promise:

- **No tracking, nothing phones home.** No analytics, no telemetry, no third-party scripts. Fonts and 3D toys are bundled, so it keeps working with the Wi-Fi switched off.
- **No cookies; everything stays on the device.** Only the child's own creations, works-in-progress, cover name and two settings (sound + calm mode) are saved — in this browser, never uploaded. Clear it any time in Settings.
- **A space for each maker** — separate local collections, not accounts. No sign-up, email or password.
- **No advertising, ever. Nothing to buy** — no ads, no promoted content, no in-app purchases, no paywalls.

## Run it locally

The app lives in [`app/`](app/):

```bash
cd app
npm install
npm run dev        # start the dev server
```

```bash
npm run build      # production build → app/dist
npm run typecheck  # tsc --noEmit
```

## Tech

React 18 + TypeScript + [Vite](https://vite.dev). [three.js](https://threejs.org) for the marbling fluid and STL dipping, [react-konva](https://konvajs.org/docs/react/) + [Rapier](https://rapier.rs) for the sticker physics, [perfect-freehand](https://github.com/steveruizok/perfect-freehand) for the brushes. Fonts (Anton + Inter) are self-hosted via `@fontsource`. A service worker provides offline support. There is **no backend** — all state is `localStorage` + IndexedDB on the device.

## Deploying

Pushes to `main` build the app and publish `app/dist` to **GitHub Pages** via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). One-time setup: in the repo's **Settings → Pages**, set **Source: GitHub Actions**. The Vite `base` is relative (`./`), so it works from the project sub-path (`/make-and-draw/`) as-is.

For a custom domain (e.g. `make.estherlew.is`), add a `CNAME` file to `app/public/` and point a DNS `CNAME` record at `ptrlws.github.io`.

## Credits

Make & Draw was **Esther's** idea. Third-party assets and their licences are documented in [CREDITS.md](CREDITS.md) — note the bundled 3D models are **personal-use only**, so keep that in mind before any commercial use.
