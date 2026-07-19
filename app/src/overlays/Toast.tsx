import { useGame } from '../game/context'
import { c, fonts } from '../theme'

/** Bottom-centre pill, auto-dismissed by the provider (~1.9s).
 *  The live region is always mounted so assistive tech announces changes. */
export function Toast() {
  const { state } = useGame()
  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      {state.toast && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 30,
            transform: 'translateX(-50%)',
            zIndex: 80,
            background: c.ink,
            color: c.paper,
            fontFamily: fonts.body,
            fontWeight: 800,
            fontSize: 14,
            textTransform: 'uppercase',
            letterSpacing: '.04em',
            padding: '12px 20px',
            borderRadius: 6,
            boxShadow: `4px 4px 0 ${c.pink}`,
            whiteSpace: 'nowrap',
          }}
        >
          {state.toast}
        </div>
      )}
    </div>
  )
}
