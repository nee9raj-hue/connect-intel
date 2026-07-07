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

function DetailRow({ label, value, href }) {
  if (!value) return null
  return (
    <div className="ci-copilot-card__row">
      <span className="ci-copilot-card__row-label">{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="ci-copilot-card__row-value ci-copilot-card__link">
          {value}
        </a>
      ) : (
        <span className="ci-copilot-card__row-value">{value}</span>
      )}
    </div>
  )
}

export default function CopilotCompanyCard({ card, onAction }) {
  if (!card?.name && !card?.company) return null
  const name = card.name || card.company
  const website = card.website
    ? card.website.startsWith('http')
      ? card.website
      : `https://${card.website}`
    : null

  return (
    <div className="ci-copilot-card">
      <div className="ci-copilot-card__head">
        <span className="ci-copilot-card__logo" aria-hidden>
          {initials(name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="ci-copilot-card__name">{name}</p>
          {website ? (
            <a href={website} target="_blank" rel="noopener noreferrer" className="ci-copilot-card__web">
              {hostFromUrl(website) || card.website}
            </a>
          ) : null}
        </div>
        {card.crmStatus ? (
          <span className="ci-copilot-card__tag ci-copilot-card__tag--crm">{card.crmStatus}</span>
        ) : null}
      </div>

      <div className="ci-copilot-card__grid">
        <DetailRow label="Industry" value={card.industry} />
        <DetailRow label="HQ" value={card.headquarters} />
        <DetailRow label="Size" value={card.employeeSize ? `${card.employeeSize} employees` : ''} />
        <DetailRow label="Products" value={card.products} />
        <DetailRow label="Export markets" value={card.exportMarkets} />
        <DetailRow label="Owner" value={card.ownerName} />
        <DetailRow
          label="LinkedIn"
          value={card.linkedinUrl ? 'Company page' : ''}
          href={card.linkedinUrl || undefined}
        />
      </div>

      {card.newsHeadline ? <p className="ci-copilot-card__news">{card.newsHeadline}</p> : null}

      <div className="ci-copilot-card__actions">
        {card.leadId && onAction ? (
          <button
            type="button"
            className="ci-copilot-card__cta"
            onClick={() =>
              onAction({ type: 'navigate', panel: 'pipeline', leadId: card.leadId, label: 'Open in Pipeline' })
            }
          >
            Open in CRM
          </button>
        ) : onAction ? (
          <button
            type="button"
            className="ci-copilot-card__cta"
            onClick={() =>
              onAction({
                type: 'create_lead',
                label: 'Add to CRM',
                payload: {
                  company: name,
                  website: card.website || '',
                  industry: card.industry || '',
                },
              })
            }
          >
            Add to CRM
          </button>
        ) : null}
      </div>
    </div>
  )
}
