import { useGame } from '../game/context'
import { c, shadows, text } from '../theme'

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
            ...text.label,
            background: c.ink,
            color: '#FCFBF7',
            padding: '12px 20px',
            borderRadius: 999,
            boxShadow: shadows.dropLg,
            whiteSpace: 'nowrap',
          }}
        >
          {state.toast}
        </div>
      )}
    </div>
  )
}
