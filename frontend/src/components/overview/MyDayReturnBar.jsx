export default function MyDayReturnBar({ panelOptions, onNavigate, label }) {
  const returnTo = panelOptions?.returnTo
  if (returnTo !== 'overview' && returnTo !== 'marketing') return null
  const backLabel =
    label || (returnTo === 'marketing' ? 'Back to Marketing' : 'Back to Dashboard')
  const target =
    returnTo === 'marketing'
      ? () => onNavigate?.('marketing', { tab: panelOptions?.marketingTab || 'analytics' })
      : () => onNavigate?.('overview')
  return (
    <div className="myday-return-bar">
      <button type="button" className="myday-return-bar__btn" onClick={target}>
        ← {backLabel}
      </button>
    </div>
  )
}
