import { PlusIcon, UploadIcon } from '../ui/icons'

/** Compact pipeline controls for mobile app header (stats, view, import, add). */
export default function PipelineMobileHeaderChrome({
  statsText,
  stageListMode = false,
  view,
  onViewChange,
  onImport,
  onAdd,
}) {
  return (
    <div className="ci-pipeline-mobile-header" role="group" aria-label="Pipeline actions">
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
      <button
        type="button"
        onClick={onImport}
        className="crm-btn crm-btn-secondary ci-mobile-icon-btn ci-pipeline-mobile-header__btn"
        aria-label="Import leads"
      >
        <UploadIcon className="ci-mobile-btn-icon shrink-0" aria-hidden />
        <span className="ci-mobile-btn-text">Import</span>
      </button>
      <button
        type="button"
        onClick={onAdd}
        className="crm-btn crm-btn-primary ci-mobile-icon-btn ci-pipeline-mobile-header__btn"
        aria-label="Add lead"
      >
        <PlusIcon className="ci-mobile-btn-icon shrink-0" aria-hidden />
        <span className="ci-mobile-btn-text">Add lead</span>
      </button>
    </div>
  )
}
