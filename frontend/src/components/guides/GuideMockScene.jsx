/** Lightweight UI mockups with animated cursor (no image uploads). */

const SCENES = {
  overview: {
    cursorAnim: 'overview',
    render: () => (
      <div className="guide-mock__tabs">
        {['Campaigns', 'Lists', 'Reports', 'Templates'].map((t, i) => (
          <span key={t} className={`guide-mock__tab ${i === 2 ? 'is-hot' : ''}`}>
            {t}
          </span>
        ))}
      </div>
    ),
  },
  roles: {
    cursorAnim: 'roles',
    render: () => (
      <div className="guide-mock__card">
        <div className="guide-mock__row">
          <span className="guide-mock__title">Batch mail</span>
          <span className="guide-mock__badge is-hot">Dakash</span>
        </div>
        <div className="guide-mock__row muted">
          <span className="guide-mock__title">Demo</span>
          <span className="guide-mock__badge">You</span>
        </div>
      </div>
    ),
  },
  'work-email': {
    cursorAnim: 'email',
    render: () => (
      <div className="guide-mock__sidebar">
        <span>Pipeline</span>
        <span>Contacts</span>
        <span className="is-hot">Work email</span>
        <span>Marketing</span>
      </div>
    ),
  },
  lists: {
    cursorAnim: 'lists',
    render: () => (
      <div className="guide-mock__split">
        <div className="guide-mock__panel">
          <span className="is-hot">+ New list</span>
          <span className="muted">Email · 48 leads</span>
        </div>
        <div className="guide-mock__panel faint">
          <span>Filter pipeline</span>
          <span className="muted">Add to list →</span>
        </div>
      </div>
    ),
  },
  templates: {
    cursorAnim: 'templates',
    render: () => (
      <div className="guide-mock__editor">
        <div className="guide-mock__rail">Sections</div>
        <div className="guide-mock__canvas is-hot">Email canvas</div>
        <div className="guide-mock__rail faint">Properties</div>
      </div>
    ),
  },
  campaign: {
    cursorAnim: 'campaign',
    render: () => (
      <div className="guide-mock__wizard">
        <span>List ✓</span>
        <span>Name ✓</span>
        <span className="is-hot">Start campaign</span>
      </div>
    ),
  },
  controls: {
    cursorAnim: 'controls',
    render: () => (
      <div className="guide-mock__actions">
        <span>Report</span>
        <span>Continue</span>
        <span>Pause</span>
        <span className="is-hot danger">Stop</span>
        <span>Archive</span>
      </div>
    ),
  },
  reports: {
    cursorAnim: 'reports',
    render: () => (
      <div className="guide-mock__table">
        <div className="guide-mock__thead">
          <span>Campaign</span>
          <span>Open</span>
          <span className="is-hot">View report</span>
        </div>
        <div className="guide-mock__trow">
          <span>Intro mail</span>
          <span>34%</span>
          <span className="accent">Report</span>
        </div>
      </div>
    ),
  },
  archive: {
    cursorAnim: 'archive',
    render: () => (
      <div className="guide-mock__tabs">
        <span className="guide-mock__tab">All campaigns</span>
        <span className="guide-mock__tab is-hot">Archive</span>
      </div>
    ),
  },
}

export default function GuideMockScene({ sceneId }) {
  const scene = SCENES[sceneId] || SCENES.overview
  return (
    <div className="guide-mock" data-scene={sceneId}>
      <div className="guide-mock__frame">
        <div className="guide-mock__topbar">
          <span className="guide-mock__dot" />
          <span className="guide-mock__dot" />
          <span className="guide-mock__dot" />
          <span className="guide-mock__url">connectintel.net · Marketing</span>
        </div>
        <div className="guide-mock__body">{scene.render()}</div>
      </div>
      <div className={`guide-mock__cursor guide-mock__cursor--${scene.cursorAnim}`} aria-hidden>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 3l14 8-6.5 1.5L11 19 8 14.5 5 16V3z"
            fill="#17191c"
            stroke="#fff"
            strokeWidth="1.2"
          />
        </svg>
      </div>
    </div>
  )
}
