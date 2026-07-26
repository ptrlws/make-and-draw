import { Card, IconButton, RisoButton } from '../components/riso'
import { useGame } from '../game/context'
import { c, fonts, shadows } from '../theme'

/** A promise, in plain words, of what the app does and does not do — every
 * point here is verified against the actual code, not aspirational. */
interface Point {
  icon: string
  title: string
  body: string
  spot: string
}

const POINTS: Point[] = [
  {
    icon: '🔌',
    title: 'No tracking. Nothing phones home.',
    body:
      "Make & Draw makes no calls to any outside server — no analytics, no telemetry, no third-party scripts. The fonts, the 3D toys, everything the app needs is built in. Once it has loaded, it works with the Wi-Fi switched off.",
    spot: c.teal,
  },
  {
    icon: '📱',
    title: 'No cookies. It all stays on this device.',
    body:
      "The only things saved are your child's own creations, their works-in-progress, the name on the cover, and two settings (sound and calm mode). They live in this browser, on this device, and are never uploaded. There are no cookies and no hidden identifiers. Clear everything any time in Settings.",
    spot: c.pink,
  },
  {
    icon: '👋',
    title: 'A space for each maker.',
    body:
      "If more than one child shares this device, each can have their own maker — their own name, collection and works-in-progress, kept apart. It isn't an account: there's no sign-up, email or password, and it never leaves the device.",
    spot: '#8f3ac0',
  },
  {
    icon: '🚫',
    title: 'No advertising. Ever.',
    body: "No ads, no promoted content, no “watch a video to unlock.” Nothing is trying to sell to your child while they make things.",
    spot: c.yellow,
  },
  {
    icon: '🎁',
    title: 'Nothing to buy.',
    body: "No in-app purchases, no subscriptions, no paywalls, no store. Every kit and tool is simply here.",
    spot: c.blue,
  },
]

export function GrownUps() {
  const { go, openSettings } = useGame()

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto' }}>
      <div style={{ maxWidth: 620, margin: '0 auto', minHeight: '100%', padding: '0 18px 40px' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0 8px' }}>
          <IconButton onClick={() => go('home')} ariaLabel="back" size={52} style={{ fontFamily: fonts.display, fontSize: 25 }}>
            ‹
          </IconButton>
          <div>
            <div style={{ fontFamily: fonts.body, fontWeight: 700, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: c.faint }}>
              A promise to
            </div>
            <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 'clamp(25px, 6.5vw, 32px)', lineHeight: 1.05, letterSpacing: '-.015em', color: c.ink }}>
              Grown-ups
            </div>
          </div>
        </div>

        {/* primary attribution: the whole thing started with Esther */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '15px 17px',
            background: c.card,
            border: 'none',
            borderRadius: 16,
            boxShadow: shadows.card,
            margin: '4px 0 18px',
          }}
        >
          <span aria-hidden style={{ fontSize: 25, lineHeight: 1 }}>💡</span>
          <div style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: 13, lineHeight: 1.45, color: c.sub }}>
            Make &amp; Draw was{' '}
            <span style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 20, color: c.ink }}>Esther&rsquo;s</span> idea.
            <br />
            The whole studio began with her.
          </div>
        </div>

        <div style={{ fontFamily: fonts.body, fontWeight: 700, fontSize: 15, lineHeight: 1.5, color: c.sub, margin: '4px 0 20px' }}>
          Make &amp; Draw is a quiet, ad-free corner for one child and their imagination. Here is exactly how it treats your family — and every word of it is built into the app, not just a promise.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {POINTS.map((p) => (
            <Card key={p.title} radius={16} style={{ padding: 18, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div
                aria-hidden
                style={{
                  flex: 'none',
                  width: 44,
                  height: 44,
                  borderRadius: 13,
                  background: c.paperBody,
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                }}
              >
                {p.icon}
              </div>
              <div>
                <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 17, lineHeight: 1.2, letterSpacing: '-.01em', color: c.ink }}>{p.title}</div>
                <div style={{ fontFamily: fonts.body, fontWeight: 500, fontSize: 13, lineHeight: 1.55, color: c.sub, marginTop: 6 }}>{p.body}</div>
              </div>
            </Card>
          ))}
        </div>

        {/* the one nuance worth stating plainly */}
        <div
          style={{
            fontFamily: fonts.body,
            fontWeight: 700,
            fontSize: 13,
            lineHeight: 1.5,
            color: c.sub,
            textAlign: 'center',
            margin: '20px 0 6px',
            padding: '14px 16px',
            background: 'rgba(0,165,138,.1)',
            border: `1.5px solid rgba(0,165,138,.45)`,
            borderRadius: 10,
          }}
        >
          Art leaves this device only when <em>you</em> choose to — when you print it, or use Share. You can also back the whole collection up to a file you keep, in Settings.
        </div>

        <div style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: 11, lineHeight: 1.4, color: c.faint, textAlign: 'center', margin: '10px 0 18px' }}>
          Because it saves to this browser, clearing the browser's data (or using private browsing) will remove saved pictures — so back up anything precious. Imported 3D models © their authors; personal use — see CREDITS.
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <RisoButton onClick={openSettings} variant="plain" style={{ flex: 1 }}>
            Open settings
          </RisoButton>
          <RisoButton onClick={() => go('home')} variant="primary" style={{ flex: 1 }}>
            Back to the studio
          </RisoButton>
        </div>
      </div>
    </div>
  )
}
