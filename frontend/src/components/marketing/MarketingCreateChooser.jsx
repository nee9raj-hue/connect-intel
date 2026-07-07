import { mc } from '../../lib/marketingColors'
import { ChevronLeftIcon } from '../ui/icons'

const CREATE_TYPES = [
  { id: 'email', section: 'Email', label: 'Campaign', desc: 'Audience broadcast with checklist', action: 'campaign' },
  { id: 'plain', section: 'Email', label: 'Plain text', desc: 'Simple text-only campaign', action: 'campaign-plain' },
  { id: 'template', section: 'Email', label: 'From template', desc: 'Start from a saved design', action: 'templates' },
]

const CREATE_CARDS = [
  {
    id: 'email',
    title: 'Email campaign',
    body: 'Pick an audience, subject, and design — track opens and clicks.',
    cta: 'Create campaign',
    tint: '#e8f5e9',
    action: 'campaign',
  },
  {
    id: 'automation',
    title: 'Automation',
    body: 'Trigger emails and actions from audience or pipeline events.',
    cta: 'Create journey',
    tint: '#e8f0fb',
    action: 'automations',
  },
  {
    id: 'forms',
    title: 'Signup form',
    body: 'Capture leads from a form linked to your pipeline.',
    cta: 'Build form',
    tint: '#fef9e7',
    action: 'forms',
  },
]

const SIDE_SECTIONS = [
  {
    id: 'email',
    label: 'Email',
    items: CREATE_TYPES,
  },
  { id: 'automations', label: 'Automations', action: 'automations' },
  { id: 'forms', label: 'Signup form', action: 'forms' },
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
        <p className="mc-create-chooser__hint text-xs text-[#516f90] mt-6 px-3 leading-relaxed">
          Pipeline bulk email to selected leads is in <strong>CRM → Pipeline</strong>.
        </p>
      </aside>

      <main className="mc-create-chooser__main">
        <button type="button" className="mc-link mc-create-chooser__back-top" onClick={onBack}>
          ← Back
        </button>
        <h1 className="mc-create-chooser__title">What do you want to create?</h1>
        <div className="mc-create-chooser__cards">
          {CREATE_CARDS.map((card) => (
            <button
              key={card.id}
              type="button"
              className="mc-create-chooser__card"
              style={{ background: card.tint }}
              onClick={() => run(card.action)}
            >
              <h2>{card.title}</h2>
              <p>{card.body}</p>
              <span className="mc-create-chooser__card-cta" style={{ color: mc.primary }}>
                {card.cta} →
              </span>
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}
