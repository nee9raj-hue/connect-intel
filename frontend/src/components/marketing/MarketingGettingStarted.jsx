import { useState } from 'react'

const STEPS = [
  {
    id: 'contacts',
    title: 'Add your contacts',
    body: 'Import pipeline leads or build audience lists so campaigns have someone to reach.',
    action: { tab: 'audiences', audienceTab: 'contacts' },
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

function ProgressRing({ completed, total }) {
  const radius = 20
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - completed / total)

  return (
    <div className="mc-home-guide__ring" aria-hidden>
      <svg width="52" height="52" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="3" />
        <circle
          cx="26"
          cy="26"
          r={radius}
          fill="none"
          stroke="var(--mc-primary)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 26 26)"
        />
      </svg>
      <span className="mc-home-guide__ring-label">
        {completed}/{total}
      </span>
    </div>
  )
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M2.5 6L5 8.5L9.5 3.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

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
  const firstOpen = STEPS.find((s) => !done[s.id])?.id || STEPS[STEPS.length - 1].id
  const [expandedId, setExpandedId] = useState(firstOpen)

  const run = (step) => {
    if (step.id === 'campaign') {
      onCreateCampaign?.()
      return
    }
    if (step.action) onNavigate?.('marketing', step.action)
  }

  const focusStep = (step) => {
    if (done[step.id]) {
      run(step)
      return
    }
    setExpandedId(step.id)
  }

  return (
    <section className="mc-home-guide" aria-label="Getting started checklist">
      <header className="mc-home-guide__head">
        <ProgressRing completed={completed} total={STEPS.length} />
        <div className="mc-home-guide__intro">
          <h2>Your guide to getting started</h2>
          <p>Complete all {STEPS.length} steps to get the most out of Marketing Hub.</p>
        </div>
        <div className="mc-home-guide__actions">
          <button type="button" className="mc-btn mc-btn--primary" onClick={onCreateCampaign}>
            Create email
          </button>
          {onDismiss ? (
            <button type="button" className="mc-btn mc-btn--outline" onClick={onDismiss}>
              Dismiss
            </button>
          ) : null}
        </div>
      </header>

      <ol className="mc-home-guide__steps">
        {STEPS.map((step, index) => {
          const isDone = done[step.id]
          const isExpanded = expandedId === step.id && !isDone
          const isLast = index === STEPS.length - 1

          return (
            <li
              key={step.id}
              className={`mc-home-guide__step${isDone ? ' is-done' : ''}${isExpanded ? ' is-expanded' : ''}${isLast ? ' is-last' : ''}`}
            >
              <span className="mc-home-guide__marker" aria-hidden>
                {isDone ? <CheckIcon /> : null}
              </span>

              {isExpanded ? (
                <div className="mc-home-guide__panel">
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                  <button type="button" className="mc-btn mc-btn--primary mc-btn--sm" onClick={() => run(step)}>
                    {step.actionLabel}
                  </button>
                </div>
              ) : (
                <button type="button" className="mc-home-guide__step-btn" onClick={() => focusStep(step)}>
                  <span className="mc-home-guide__step-title">{step.title}</span>
                  {isDone ? <span className="mc-home-guide__step-done">Completed</span> : null}
                </button>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
