function initials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return '?'
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}

function hostFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export default function CopilotCompanyCard({ card, onAction }) {
  if (!card?.name && !card?.company) return null
  const name = card.name || card.company

  return (
    <div className="ci-copilot-card">
      <div className="ci-copilot-card__head">
        <span className="ci-copilot-card__logo" aria-hidden>
          {initials(name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="ci-copilot-card__name">{name}</p>
          {card.website ? (
            <a
              href={card.website.startsWith('http') ? card.website : `https://${card.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ci-copilot-card__web"
            >
              {hostFromUrl(card.website.startsWith('http') ? card.website : `https://${card.website}`) || card.website}
            </a>
          ) : null}
        </div>
      </div>
      <div className="ci-copilot-card__meta">
        {card.industry ? (
          <span className="ci-copilot-card__tag">{card.industry}</span>
        ) : null}
        {card.exportMarkets ? (
          <span className="ci-copilot-card__tag">{card.exportMarkets}</span>
        ) : null}
        {card.crmStatus ? (
          <span className="ci-copilot-card__tag ci-copilot-card__tag--crm">{card.crmStatus}</span>
        ) : null}
      </div>
      {card.newsHeadline ? <p className="ci-copilot-card__news">{card.newsHeadline}</p> : null}
      {card.leadId && onAction ? (
        <button
          type="button"
          className="ci-copilot-card__cta"
          onClick={() =>
            onAction({ type: 'navigate', panel: 'pipeline', leadId: card.leadId, label: 'Open in Pipeline' })
          }
        >
          Open in Pipeline
        </button>
      ) : null}
    </div>
  )
}
