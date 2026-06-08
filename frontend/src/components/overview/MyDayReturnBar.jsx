export default function MyDayReturnBar({ panelOptions, onNavigate, label = 'Back to Dashboard' }) {
  if (panelOptions?.returnTo !== 'overview') return null
  return (
    <div className="myday-return-bar">
      <button type="button" className="myday-return-bar__btn" onClick={() => onNavigate?.('overview')}>
        ← {label}
      </button>
    </div>
  )
}
