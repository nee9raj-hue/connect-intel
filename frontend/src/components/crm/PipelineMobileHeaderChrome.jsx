/** Compact pipeline stats + view toggle for the mobile top bar slot. */
export default function PipelineMobileHeaderChrome({
  statsText,
  stageListMode = false,
  view,
  onViewChange,
}) {
  return (
    <div className="ci-pipeline-mobile-header" role="group" aria-label="Pipeline summary">
      {statsText ? (
        <p className="ci-pipeline-mobile-header__stats" title={statsText}>
          {statsText}
        </p>
      ) : null}
      {!stageListMode ? (
        <div className="crm-view-tabs crm-view-tabs--compact">
          {[
            { id: 'board', label: 'Board' },
            { id: 'list', label: 'List' },
          ].map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => onViewChange(v.id)}
              className={`crm-view-tab ${view === v.id ? 'is-active' : ''}`}
            >
              {v.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
