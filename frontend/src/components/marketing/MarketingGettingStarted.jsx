const STEPS = [
  {
    id: 'contacts',
    title: 'Add your contacts',
    body: 'Import pipeline leads or build audience lists so campaigns have someone to reach.',
    action: { tab: 'audiences', audienceTab: 'lists' },
    actionLabel: 'Add contacts',
  },
  {
    id: 'campaign',
    title: 'Create your first campaign',
    body: 'Use the step-by-step checklist to pick an audience, subject, and email design.',
    action: { tab: 'campaigns' },
    actionLabel: 'Create campaign',
  },
  {
    id: 'domain',
    title: 'Authenticate your domain',
    body: 'Improve deliverability with SPF/DKIM and a verified sending domain.',
    action: { tab: 'domains' },
    actionLabel: 'Set up domain',
  },
  {
    id: 'brand',
    title: 'Import your brand',
    body: 'Set logo colors and fonts so every email matches your company look.',
    action: { tab: 'templates' },
    actionLabel: 'Brand kit',
  },
  {
    id: 'analytics',
    title: 'Review performance',
    body: 'Track opens, clicks, and drill down to pipeline from campaign reports.',
    action: { tab: 'analytics' },
    actionLabel: 'View analytics',
  },
]

export default function MarketingGettingStarted({
  lists = [],
  reportCampaigns = [],
  onNavigate,
  onCreateCampaign,
  onDismiss,
}) {
  const hasLists = (lists || []).length > 0
  const hasCampaigns = (reportCampaigns || []).some((c) =>
    ['active', 'completed', 'scheduled'].includes(c.status)
  )

  const done = {
    contacts: hasLists,
    campaign: hasCampaigns,
    domain: false,
    brand: false,
    analytics: hasCampaigns,
  }

  const completed = STEPS.filter((s) => done[s.id]).length
  const activeStep = STEPS.find((s) => !done[s.id]) || STEPS[STEPS.length - 1]

  const run = (step) => {
    if (step.id === 'campaign') {
      onCreateCampaign?.()
      return
    }
    if (step.action) onNavigate?.('marketing', step.action)
  }

  return (
    <section className="mhub-getting-started">
      <div className="mhub-getting-started__head">
        <div className="mhub-getting-started__progress-ring" aria-hidden>
          <span>{completed}/{STEPS.length}</span>
        </div>
        <div>
          <h2>Your guide to getting started</h2>
          <p>Complete all {STEPS.length} steps to get the most out of Marketing Hub.</p>
        </div>
        <div className="mhub-getting-started__head-actions">
          <button type="button" className="mhub-v3-btn mhub-v3-btn--primary" onClick={onCreateCampaign}>
            Create email
          </button>
          {onDismiss ? (
            <button type="button" className="mhub-v3-btn" onClick={onDismiss}>
              Dismiss
            </button>
          ) : null}
        </div>
      </div>

      <ol className="mhub-getting-started__list">
        {STEPS.map((step) => {
          const isDone = done[step.id]
          const isActive = step.id === activeStep.id && !isDone
          return (
            <li
              key={step.id}
              className={`mhub-getting-started__item${isDone ? ' is-done' : ''}${isActive ? ' is-active' : ''}`}
            >
              <span className="mhub-getting-started__marker" aria-hidden>
                {isDone ? '✓' : ''}
              </span>
              {isActive ? (
                <div className="mhub-getting-started__card">
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                  <button type="button" className="mhub-v3-btn mhub-v3-btn--primary" onClick={() => run(step)}>
                    {step.actionLabel}
                  </button>
                </div>
              ) : (
                <button type="button" className="mhub-getting-started__row" onClick={() => !isDone && run(step)}>
                  <span>{step.title}</span>
                </button>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
