import { IconButton, RisoButton } from '../components/riso'
import { useGame } from '../game/context'
import { c, text } from '../theme'

/* ------------------------------------------------------------------ *
 * For grown-ups.
 *
 * Deliberately NOT a feature grid. This is a plain statement of fact from
 * one adult to another, so it is set like the colophon on the back of a
 * printed book: a claim, then the specifics, ruled off, in the smallest
 * type that is still comfortable. Every line here is verified against the
 * code — no icons, no cards, nothing dressed up.
 * ------------------------------------------------------------------ */

/** label / value pairs, read as a spec sheet rather than sold as features */
const FACTS: [string, string][] = [
  [
    'Tracking',
    'None. No analytics, no telemetry, no third-party scripts, no calls to any outside server. Once it has loaded, it works with the Wi-Fi switched off.',
  ],
  [
    'Stored here',
    "The pictures your child finishes, whatever they are halfway through, the name on the cover, and two settings. In this browser, on this device. No cookies, no identifiers, nothing uploaded.",
  ],
  [
    'Advertising',
    'None, and there never will be. Nothing in here is trying to sell to your child.',
  ],
  ['Purchases', 'None. No subscriptions, no paywalls, no store. Every kit and tool is simply here.'],
  [
    'Several children',
    "Each can have their own space on the device — their own name, collection and unfinished work, kept apart. Not accounts: no sign-up, no email, no password.",
  ],
]

export function GrownUps() {
  const { go, openSettings } = useGame()

  const rule = { height: 1, background: c.line, border: 'none', margin: 0 } as const

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', minHeight: '100%', padding: '0 22px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 0 6px' }}>
          <IconButton onClick={() => go('home')} ariaLabel="back" size={44} style={{ ...text.display }}>
            ‹
          </IconButton>
          <span style={{ ...text.eyebrow, color: c.faint }}>For grown-ups</span>
        </div>

        {/* the claim, stated once, plainly */}
        <h1 style={{ ...text.hero, color: c.ink, margin: '18px 0 0', maxWidth: '18ch' }}>
          This app collects nothing.
        </h1>
        <p style={{ ...text.body, color: c.sub, margin: '14px 0 4px', maxWidth: '60ch' }}>
          No account, no ads, no purchases, and nothing sent anywhere. Everything your child makes stays
          on this device unless you choose to print or share it. Each line below is how the app is built,
          not a policy we intend to follow.
        </p>

        {/* the specifics, as a spec sheet */}
        <dl style={{ margin: '26px 0 0' }}>
          {FACTS.map(([label, value], i) => (
            <div key={label}>
              {i > 0 && <hr style={rule} />}
              <div style={{ padding: '15px 0' }}>
                <dt style={{ ...text.eyebrow, color: c.faint, marginBottom: 5 }}>{label}</dt>
                <dd style={{ ...text.body, color: c.ink, margin: 0, maxWidth: '58ch' }}>{value}</dd>
              </div>
            </div>
          ))}
        </dl>

        <hr style={rule} />

        {/* the caveats — the honest bit most apps leave out */}
        <div style={{ padding: '15px 0 0' }}>
          <div style={{ ...text.eyebrow, color: c.faint, marginBottom: 5 }}>Worth knowing</div>
          <p style={{ ...text.meta, color: c.sub, margin: 0, maxWidth: '58ch' }}>
            Because everything is kept in this browser, clearing the browser's data — or using private
            browsing — will delete saved pictures. Back up anything precious from Settings, which also
            clears the collection whenever you want. The child's first name is the only personal detail
            stored, and it never leaves the device.
          </p>
        </div>

        <hr style={{ ...rule, margin: '22px 0 0' }} />

        {/* attribution, set as a colophon rather than a badge */}
        <p style={{ ...text.meta, color: c.faint, margin: '16px 0 26px', maxWidth: '58ch' }}>
          Make &amp; Draw was <span style={{ color: c.ink }}>Esther&rsquo;s</span> idea, and is built for
          her. Imported 3D models remain © their authors and are included for personal use only — see
          CREDITS.
        </p>

        <div style={{ display: 'flex', gap: 10 }}>
          <RisoButton onClick={openSettings} variant="plain" style={{ flex: 1 }}>
            Settings
          </RisoButton>
          <RisoButton onClick={() => go('home')} variant="primary" style={{ flex: 1 }}>
            Back to the studio
          </RisoButton>
        </div>
      </div>
    </div>
  )
}
