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
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '')
  } catch {
    return String(url || '').slice(0, 24)
  }
}

function starsDisplay(n = 2) {
  const filled = Math.min(5, Math.max(0, n))
  return `${'★'.repeat(filled)}${'☆'.repeat(5 - filled)}`
}

function CompanyRow({ company, onAction, knowledgeMode = false }) {
  const name = company.company || company.name
  const website = company.website || company.companyDomain
  const href = website ? (website.startsWith('http') ? website : `https://${website}`) : null

  return (
    <article className="ci-copilot-list__card">
      <div className="ci-copilot-list__card-head">
        <span className="ci-copilot-list__logo" aria-hidden>
          {initials(name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="ci-copilot-list__name">{name}</p>
          {company.contactName || company.title ? (
            <p className="ci-copilot-list__contact">
              {[company.contactName, company.title].filter(Boolean).join(' · ')}
            </p>
          ) : null}
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className="ci-copilot-list__web">
              {hostFromUrl(href)}
            </a>
          ) : null}
        </div>
        {!knowledgeMode ? (
          <span
            className={`ci-copilot-list__crm${company.inCrm ? ' ci-copilot-list__crm--in' : ''}`}
          >
            {company.crmStatus || (company.inCrm ? 'In CRM' : 'New')}
          </span>
        ) : null}
      </div>

      {!knowledgeMode && company.tierLabel ? (
        <div className="ci-copilot-list__tier-row">
          <span className={`ci-copilot-list__tier ci-copilot-list__tier--${company.tier || 'possible'}`}>
            <span className="ci-copilot-list__stars" aria-hidden>
              {starsDisplay(company.stars)}
            </span>
            {company.tierLabel}
          </span>
          {company.confidence ? (
            <span className={`ci-copilot-list__confidence ci-copilot-list__confidence--${company.confidence}`}>
              {company.confidence} confidence
            </span>
          ) : null}
        </div>
      ) : null}

      {company.rankReason && !knowledgeMode ? <p className="ci-copilot-list__reason">{company.rankReason}</p> : null}

      <div className="ci-copilot-list__meta">
        {company.season ? <span>Season {company.season}</span> : null}
        {company.city || company.state ? (
          <span>{[company.city, company.state].filter(Boolean).join(', ')}</span>
        ) : null}
        {company.industry ? <span>{company.industry}</span> : null}
        {company.exportMarkets ? <span>Exports: {company.exportMarkets}</span> : null}
        {!knowledgeMode && company.email ? <span>{company.email}</span> : null}
        {!knowledgeMode && company.phone ? <span>{company.phone}</span> : null}
      </div>

      <div className="ci-copilot-list__actions">
        {company.leadId ? (
          <button
            type="button"
            className="ci-copilot-list__btn"
            onClick={() =>
              onAction?.({ type: 'navigate', panel: 'pipeline', leadId: company.leadId, label: 'Open' })
            }
          >
            Open CRM
          </button>
        ) : (
          <button
            type="button"
            className="ci-copilot-list__btn ci-copilot-list__btn--primary"
            onClick={() =>
              onAction?.({
                type: 'create_lead',
                label: 'Add lead',
                payload: {
                  company: name,
                  website: company.website || company.companyDomain || '',
                  industry: company.industry || '',
                  city: company.city || '',
                  state: company.state || '',
                  email: company.email || '',
                  phone: company.phone || '',
                  firstName: company.firstName || '',
                  lastName: company.lastName || '',
                },
              })
            }
          >
            Add to CRM
          </button>
        )}
        {company.linkedinUrl ? (
          <a
            href={company.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ci-copilot-list__btn ci-copilot-list__btn--ghost"
          >
            LinkedIn
          </a>
        ) : null}
        {company.leadId ? (
          <button
            type="button"
            className="ci-copilot-list__btn ci-copilot-list__btn--ghost"
            onClick={() =>
              onAction?.({
                type: 'navigate',
                panel: 'pipeline',
                leadId: company.leadId,
                leadTab: 'email',
                label: 'Email',
              })
            }
          >
            Draft email
          </button>
        ) : null}
      </div>
    </article>
  )
}

export default function CopilotCompanyList({ companies, discoveryMeta, onAction }) {
  if (!companies?.length) return null
  const total = discoveryMeta?.total || companies.length
  const isKnowledge = discoveryMeta?.intent === 'knowledge_lookup'
  const topCount = companies.filter((c) => c.tier === 'top').length
  const goodCount = companies.filter((c) => c.tier === 'good').length
  const linkedinCount =
    discoveryMeta?.linkedinCount ?? companies.filter((c) => c.linkedinUrl).length

  return (
    <div className="ci-copilot-list">
      <div className="ci-copilot-list__header">
        <p className="ci-copilot-list__title">
          {isKnowledge ? (
            <>
              Contestants — <strong>{total}</strong>
            </>
          ) : (
            <>
              What I found — <strong>{total}</strong> companies
            </>
          )}
        </p>
        {isKnowledge ? (
          <p className="ci-copilot-list__sub">
            {linkedinCount > 0 ? `${linkedinCount} LinkedIn` : 'LinkedIn where public'}
            {discoveryMeta?.inCrm != null
              ? ` · ${discoveryMeta.inCrm} in CRM · ${discoveryMeta.newLeads ?? total - discoveryMeta.inCrm} new`
              : null}
          </p>
        ) : topCount > 0 || goodCount > 0 ? (
          <p className="ci-copilot-list__sub">
            {topCount > 0 ? `${topCount} top recommended` : null}
            {topCount > 0 && goodCount > 0 ? ' · ' : null}
            {goodCount > 0 ? `${goodCount} good matches` : null}
          </p>
        ) : discoveryMeta?.inCrm != null ? (
          <p className="ci-copilot-list__sub">
            {discoveryMeta.inCrm} in CRM · {discoveryMeta.newLeads ?? total - discoveryMeta.inCrm} new
          </p>
        ) : null}
      </div>
      <div className="ci-copilot-list__scroll">
        {companies.map((c) => (
          <CompanyRow
            key={c.id || c.company || c.name}
            company={c}
            onAction={onAction}
            knowledgeMode={isKnowledge}
          />
        ))}
      </div>
    </div>
  )
}

export function CopilotPlanSteps({ steps }) {
  if (!steps?.length) return null
  return (
    <ul className="ci-copilot-plan" aria-label="Search progress">
      {steps.map((step) => (
        <li key={step.id} className={`ci-copilot-plan__step ci-copilot-plan__step--${step.status || 'done'}`}>
          <span className="ci-copilot-plan__check" aria-hidden>
            ✓
          </span>
          {step.label}
        </li>
      ))}
    </ul>
  )
}
