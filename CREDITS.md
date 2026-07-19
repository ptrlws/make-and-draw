# Credits & third-party attributions

## Origin

**Make & Draw was Esther's idea.** The whole app began with her — the concept
and the wish for a calm, ad-free craft studio for kids are hers. Primary
creative credit belongs to Esther.

## 3D models (marble dipping)

The marble activity can import STL models to "dip". The following models were
provided for testing and are credited here. **They are not bundled/redistributed
in the app** — they are loaded locally from the user's own device via the in‑app
STL import (personal use). Respect each author's license before shipping.

| Model | Author | Source | License / terms |
|---|---|---|---|
| Cute Low Poly Dog | Matthias L | Printables model **672586** (`printables.com/model/672586`) | Free for personal use; **commercial use requires the author's Patreon "Low Poly Commercial License" tier** (patreon.com/c/matthiasl). Attribution appreciated. |
| Cute Low Poly Cat (No Supports) | Matthias L | Printables model **594620** (`printables.com/model/594620`) | Same as above — free personal use, commercial gated behind the author's Patreon. |
| Balloon Dog | TheCraftyMaker | Printables model **406281** (`printables.com/model/406281`) | **© TheCraftyMaker. Personal use only — redistribution of the digital files and selling prints/reproductions is prohibited** without a "The Crafty Seller" Patreon licence. Do NOT bundle or redistribute this file. |

### Notes for shipping
- **Local import only.** The app never uploads or redistributes an imported model; STL bytes are cached in the user's own browser (IndexedDB) so their model persists across reloads.
- **Commercial release:** if Make & Draw is ever distributed commercially, the two Matthias L models require the author's commercial Patreon tier, and the Balloon Dog must not be included at all (its licence forbids redistributing the files).
- If you have obtained the appropriate rights (or the build is private/non‑commercial) and want the low‑poly cat & dog bundled as default objects, that's a one‑line change — say the word.

## Software / libraries
- **three.js** (MIT) — 3D marbling + STL loading (`STLLoader`, `BufferGeometryUtils`).
- **react-konva / konva** (MIT) — sticker collage.
- **perfect-freehand** (MIT) — free-paint brushes.
- **@dimforge/rapier2d** (Apache-2.0) — sticker "tumble" physics.
- **@fontsource** Anton + Inter (OFL-1.1) — self-hosted fonts.
