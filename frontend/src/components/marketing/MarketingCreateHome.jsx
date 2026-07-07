import { MailIcon, BoltIcon, NoteIcon } from '../ui/icons'

const CREATE_OPTIONS = [
  {
    id: 'email',
    title: 'Email campaign',
    body: 'Broadcast to an audience with the step-by-step checklist and email builder.',
    tint: '#e2f4e8',
    accent: '#007c89',
    actionLabel: 'Create campaign',
    tab: 'campaigns',
    Illustration: EmailIllustration,
    icon: MailIcon,
  },
  {
    id: 'automation',
    title: 'Automation',
    body: 'Set up journeys that personalize outreach and save you time.',
    tint: '#e3f0ff',
    accent: '#4f46e5',
    actionLabel: 'Create journey',
    tab: 'automations',
    Illustration: AutomationIllustration,
    icon: BoltIcon,
  },
  {
    id: 'forms',
    title: 'Signup form',
    body: 'Capture leads from a form — submissions flow into your pipeline.',
    tint: '#fff4d6',
    accent: '#d97706',
    actionLabel: 'Build form',
    tab: 'forms',
    Illustration: FormIllustration,
    icon: NoteIcon,
  },
]

function EmailIllustration() {
  return (
    <svg className="mc-home-create__art" viewBox="0 0 200 140" fill="none" aria-hidden>
      <rect x="52" y="18" width="96" height="108" rx="6" fill="#fff" stroke="#241c15" strokeWidth="1.5" />
      <rect x="64" y="34" width="72" height="10" rx="3" fill="#007c89" fillOpacity="0.25" />
      <rect x="64" y="54" width="56" height="5" rx="2" fill="#d1d5db" />
      <rect x="64" y="66" width="68" height="5" rx="2" fill="#d1d5db" />
      <rect x="64" y="78" width="44" height="5" rx="2" fill="#d1d5db" />
      <rect x="64" y="100" width="36" height="14" rx="7" fill="#007c89" />
      <path d="M52 30 L100 58 L148 30" stroke="#241c15" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function AutomationIllustration() {
  return (
    <svg className="mc-home-create__art" viewBox="0 0 200 140" fill="none" aria-hidden>
      <circle cx="52" cy="70" r="22" fill="#fff" stroke="#241c15" strokeWidth="1.5" />
      <circle cx="100" cy="44" r="22" fill="#fff" stroke="#241c15" strokeWidth="1.5" />
      <circle cx="148" cy="70" r="22" fill="#fff" stroke="#241c15" strokeWidth="1.5" />
      <path d="M70 62 L82 52" stroke="#241c15" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M118 52 L130 62" stroke="#241c15" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M52 92 L52 108 M100 66 L100 108 M148 92 L148 108" stroke="#241c15" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3" />
      <rect x="40" y="108" width="24" height="16" rx="4" fill="#4f46e5" fillOpacity="0.2" />
      <rect x="88" y="108" width="24" height="16" rx="4" fill="#4f46e5" fillOpacity="0.35" />
      <rect x="136" y="108" width="24" height="16" rx="4" fill="#4f46e5" fillOpacity="0.5" />
      <circle cx="52" cy="70" r="6" fill="#4f46e5" />
      <circle cx="100" cy="44" r="6" fill="#4f46e5" />
      <circle cx="148" cy="70" r="6" fill="#4f46e5" />
    </svg>
  )
}

function FormIllustration() {
  return (
    <svg className="mc-home-create__art" viewBox="0 0 200 140" fill="none" aria-hidden>
      <rect x="44" y="16" width="112" height="108" rx="8" fill="#fff" stroke="#241c15" strokeWidth="1.5" />
      <rect x="60" y="40" width="80" height="10" rx="4" fill="#fff" stroke="#d1d5db" />
      <rect x="60" y="58" width="80" height="10" rx="4" fill="#fff" stroke="#d1d5db" />
      <rect x="60" y="76" width="80" height="10" rx="4" fill="#fff" stroke="#d1d5db" />
      <rect x="60" y="102" width="48" height="12" rx="6" fill="#d97706" />
    </svg>
  )
}

export default function MarketingCreateHome({ onCreateCampaign, onNavigate }) {
  const run = (opt) => {
    if (opt.id === 'email') {
      onCreateCampaign?.()
      return
    }
    onNavigate?.('marketing', { tab: opt.tab })
  }

  return (
    <section className="mc-home-create">
      <header className="mc-home-create__head">
        <h1 className="mc-home-create__title">Marketing Hub</h1>
        <h2 className="mc-home-create__subtitle">Campaigns, audiences, and analytics</h2>
      </header>
      <div className="mc-home-create__grid">
        {CREATE_OPTIONS.map((opt) => {
          const Illus = opt.Illustration
          const Icon = opt.icon
          return (
            <article key={opt.id} className="mc-home-create__card">
              <div className="mc-home-create__visual" style={{ background: opt.tint }}>
                <Illus />
                <span className="mc-home-create__visual-icon" style={{ color: opt.accent }}>
                  <Icon className="w-5 h-5" />
                </span>
              </div>
              <div className="mc-home-create__body">
                <h3>{opt.title}</h3>
                <p>{opt.body}</p>
                <button type="button" className="mc-home-create__cta" onClick={() => run(opt)}>
                  {opt.actionLabel}
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
