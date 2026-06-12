import { mc } from '../../lib/marketingColors'
import { ChevronLeftIcon } from '../ui/icons'

const CREATE_TYPES = [
  { id: 'email', section: 'Email', label: 'Regular', desc: 'Step-by-step email campaign', action: 'campaign' },
  { id: 'plain', section: 'Email', label: 'Plain text', desc: 'Simple text-only email', action: 'campaign-plain' },
  { id: 'template', section: 'Email', label: 'Template', desc: 'Start from a saved template', action: 'templates' },
]

const CREATE_CARDS = [
  {
    id: 'email',
    title: 'Regular email',
    body: 'Use our email builder to launch a campaign in minutes.',
    cta: 'Design Email',
    tint: '#e8f5e9',
    action: 'campaign',
  },
  {
    id: 'automation',
    title: 'Automation',
    body: 'Set up email automations that personalize your marketing and save you time.',
    cta: 'Create Journey',
    tint: '#e8f0fb',
    action: 'automations',
  },
  {
    id: 'landing',
    title: 'Landing page',
    body: 'Create a landing page that lets people sign up for promotions or discounts.',
    cta: 'Build Landing Page',
    tint: '#fef9e7',
    action: 'landing',
  },
]

const SIDE_SECTIONS = [
  {
    id: 'email',
    label: 'Email',
    items: CREATE_TYPES,
  },
  { id: 'automations', label: 'Automations', action: 'automations' },
  { id: 'landing', label: 'Landing Page', action: 'landing' },
  { id: 'divider' },
  { id: 'forms', label: 'Signup Form', action: 'forms' },
  { id: 'bulk', label: 'Bulk email', action: 'bulk-email' },
]

export default function MarketingCreateChooser({
  onBack,
  onStartCampaign,
  onNavigate,
}) {
  const run = (action) => {
    if (action === 'campaign' || action === 'campaign-plain') {
      onStartCampaign?.({ plain: action === 'campaign-plain' })
      return
    }
    if (action === 'templates') {
      onNavigate?.('marketing', { tab: 'templates' })
      return
    }
    if (action === 'landing') {
      onNavigate?.('marketing', { tab: 'landing' })
      return
    }
    if (action === 'bulk-email') {
      onNavigate?.('marketing', { tab: 'bulk-email' })
      return
    }
    onNavigate?.('marketing', { tab: action })
  }

  return (
    <div className="mc-create-chooser">
      <aside className="mc-create-chooser__side">
        <button type="button" className="mc-create-chooser__back" onClick={onBack}>
          <ChevronLeftIcon className="w-4 h-4" />
          Back
        </button>
        <nav className="mc-create-chooser__nav">
          {SIDE_SECTIONS.map((section) => {
            if (section.id === 'divider') {
              return <hr key="div" className="mc-create-chooser__divider" />
            }
            if (section.items) {
              return (
                <div key={section.id} className="mc-create-chooser__group">
                  <p className="mc-create-chooser__group-label">{section.label}</p>
                  {section.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="mc-create-chooser__nav-item"
                      onClick={() => run(item.action)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )
            }
            return (
              <button
                key={section.id}
                type="button"
                className="mc-create-chooser__nav-item mc-create-chooser__nav-item--section"
                onClick={() => run(section.action)}
              >
                {section.label}
              </button>
            )
          })}
        </nav>
      </aside>

      <main className="mc-create-chooser__main">
        <button type="button" className="mc-link mc-create-chooser__back-top" onClick={onBack}>
          ← Back
        </button>
        <h1>Create something that gets noticed</h1>
        <p className="mc-create-chooser__badge">Based on best practices</p>
        <h2>Try building one of these</h2>

        <div className="mc-create-chooser__cards">
          {CREATE_CARDS.map((card) => (
            <article key={card.id} className="mc-create-chooser__card">
              <div className="mc-create-chooser__card-art" style={{ background: card.tint }}>
                <div className="mc-create-chooser__card-mock" />
              </div>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
              <button type="button" className="mc-create-chooser__card-cta" onClick={() => run(card.action)}>
                {card.cta}
              </button>
            </article>
          ))}
        </div>
      </main>
    </div>
  )
}
