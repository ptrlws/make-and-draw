import { Component, lazy, Suspense, type ReactNode } from 'react'
import { GameProvider } from './game/GameProvider'
import { useGame } from './game/context'
import { Book } from './screens/Book'
import { GrownUps } from './screens/GrownUps'
import { Home } from './screens/Home'
import { NameEntry } from './screens/NameEntry'
import { FinishingRitual } from './overlays/FinishingRitual'
import { Settings } from './overlays/Settings'
import { Toast } from './overlays/Toast'
import { c, fonts, paperTexture } from './theme'

// Heavy engines are loaded only when their activity is opened:
//   Marble → three.js, ColourByNumber → konva, PatternLab → canvas 2d.
const Marble = lazy(() => import('./screens/Marble').then((m) => ({ default: m.Marble })))
const ColourByNumber = lazy(() => import('./screens/ColourByNumber').then((m) => ({ default: m.ColourByNumber })))
const PatternLab = lazy(() => import('./screens/PatternLab').then((m) => ({ default: m.PatternLab })))
const PrintShop = lazy(() => import('./screens/PrintShop').then((m) => ({ default: m.PrintShop })))
const StickerCollage = lazy(() => import('./screens/StickerCollage').then((m) => ({ default: m.StickerCollage })))
const DotToDot = lazy(() => import('./screens/DotToDot').then((m) => ({ default: m.DotToDot })))
const Butterfly = lazy(() => import('./screens/Butterfly').then((m) => ({ default: m.Butterfly })))
const ScratchOff = lazy(() => import('./screens/ScratchOff').then((m) => ({ default: m.ScratchOff })))

function Loading() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: fonts.display,
        fontSize: 22,
        textTransform: 'uppercase',
        letterSpacing: '.12em',
        color: c.hint,
      }}
    >
      loading…
    </div>
  )
}

function CurrentScreen() {
  const { state } = useGame()
  switch (state.screen) {
    case 'name':
      return <NameEntry />
    case 'home':
      return <Home />
    case 'marble':
      return <Marble />
    case 'cbn':
      return <ColourByNumber />
    case 'pattern':
      return <PatternLab />
    case 'print':
      return <PrintShop />
    case 'sticker':
      return <StickerCollage />
    case 'dot':
      return <DotToDot />
    case 'butterfly':
      return <Butterfly />
    case 'scratch':
      return <ScratchOff />
    case 'book':
      return <Book />
    case 'grownups':
      return <GrownUps />
    default:
      return null
  }
}

/** Friendly full-screen recovery card — a crash in one kit must never take
 * the whole studio (or the collection) down with it. */
function CrashCard({ onReset }: { onReset: () => void }) {
  const { go } = useGame()
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div
        role="alert"
        style={{
          maxWidth: 400,
          textAlign: 'center',
          background: c.card,
          border: `3px solid ${c.ink}`,
          borderRadius: 10,
          boxShadow: `7px 7px 0 ${c.pink}`,
          padding: '30px 26px',
        }}
      >
        <div style={{ fontFamily: fonts.display, fontSize: 30, textTransform: 'uppercase', lineHeight: 1 }}>Whoops — ink spill!</div>
        <div style={{ fontFamily: fonts.body, fontWeight: 700, fontSize: 15, color: c.sub, margin: '12px 0 20px' }}>
          That bit went wrong, but your collection is safe.
        </div>
        <button
          onClick={() => {
            go('home')
            onReset()
          }}
          style={{
            fontFamily: fonts.body,
            fontWeight: 800,
            fontSize: 16,
            textTransform: 'uppercase',
            letterSpacing: '.04em',
            color: c.ink,
            background: c.teal,
            border: `3px solid ${c.ink}`,
            borderRadius: 8,
            padding: '13px 24px',
            boxShadow: '0 4px 0 #16130f',
            cursor: 'pointer',
          }}
        >
          Back to the shelf
        </button>
      </div>
    </div>
  )
}

class Boundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false }
  static getDerivedStateFromError() {
    return { crashed: true }
  }
  render() {
    if (this.state.crashed) return <CrashCard onReset={() => this.setState({ crashed: false })} />
    return this.props.children
  }
}

function Studio() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', ...paperTexture }}>
      <Boundary>
        <Suspense fallback={<Loading />}>
          <CurrentScreen />
        </Suspense>
      </Boundary>
      {/* overlays render above the active screen */}
      <Settings />
      <FinishingRitual />
      <Toast />
    </div>
  )
}

export default function App() {
  return (
    <GameProvider>
      <Studio />
    </GameProvider>
  )
}
