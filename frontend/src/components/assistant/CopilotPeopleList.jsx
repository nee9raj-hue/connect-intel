export default function CopilotPeopleList({ people, onAction }) {
  if (!people?.length) return null

  return (
    <div className="ci-copilot-list">
      <div className="ci-copilot-list__header">
        <p className="ci-copilot-list__title">People found</p>
      </div>
      <div className="ci-copilot-list__scroll">
        {people.map((p) => (
          <article key={p.id || p.linkedinUrl || p.name} className="ci-copilot-list__card">
            <div className="ci-copilot-list__card-head">
              <div className="min-w-0 flex-1">
                <p className="ci-copilot-list__name">{p.name}</p>
                <p className="ci-copilot-list__contact">
                  {[p.title, p.company].filter(Boolean).join(' · ')}
                </p>
              </div>
              {p.confidence ? (
                <span className="ci-copilot-list__crm">{p.confidence} confidence</span>
              ) : null}
            </div>
            <div className="ci-copilot-list__actions">
              {p.linkedinUrl ? (
                <a
                  href={p.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ci-copilot-list__btn ci-copilot-list__btn--primary"
                >
                  LinkedIn profile
                </a>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
