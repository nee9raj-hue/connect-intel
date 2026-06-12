const CREATE_OPTIONS = [
  {
    id: 'email',
    title: 'Regular email',
    body: 'Use the step-by-step builder to launch a campaign in minutes.',
    tint: '#e2f4e8',
    actionLabel: 'Design email',
    tab: 'campaigns',
  },
  {
    id: 'automation',
    title: 'Automation',
    body: 'Set up journeys that personalize outreach and save you time.',
    tint: '#e3f0ff',
    actionLabel: 'Create journey',
    tab: 'automations',
  },
  {
    id: 'landing',
    title: 'Landing page',
    body: 'Capture signups with a focused page linked to your pipeline.',
    tint: '#fff4d6',
    actionLabel: 'Build page',
    tab: 'landing',
  },
]

export default function MarketingCreateHome({ onCreateCampaign, onNavigate }) {
  const run = (opt) => {
    if (opt.id === 'email') {
      onCreateCampaign?.()
      return
    }
    onNavigate?.('marketing', { tab: opt.tab })
  }

  return (
    <section className="mhub-create-home">
      <header className="mhub-create-home__head">
        <h1>Create something that gets noticed</h1>
        <p className="mhub-create-home__badge">Based on best practices</p>
        <h2>Try building one of these</h2>
      </header>
      <div className="mhub-create-home__grid">
        {CREATE_OPTIONS.map((opt) => (
          <article key={opt.id} className="mhub-create-home__card">
            <div className="mhub-create-home__illus" style={{ background: opt.tint }} aria-hidden>
              <span className="mhub-create-home__illus-icon" />
            </div>
            <h3>{opt.title}</h3>
            <p>{opt.body}</p>
            <button type="button" className="mhub-create-home__cta" onClick={() => run(opt)}>
              {opt.actionLabel}
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}
