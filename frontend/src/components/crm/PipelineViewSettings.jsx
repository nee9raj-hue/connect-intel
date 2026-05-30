import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { SettingsIcon } from '../ui/icons'
import useFullPageFilterMenus from '../../hooks/useFullPageFilterMenus'
import MobileFilterFullPage from '../ui/MobileFilterFullPage'

function ViewSettingsBody({
  view,
  onViewChange,
  stageListMode,
  onExport,
  onResetFilters,
}) {
  return (
    <>
      {!stageListMode && (
        <section className="hs-view-settings__section">
          <p className="hs-view-settings__section-label">Layout</p>
          <div className="hs-view-settings__view-toggle">
            <button
              type="button"
              className={`hs-view-settings__view-btn ${view === 'list' ? 'is-active' : ''}`}
              onClick={() => onViewChange?.('list')}
            >
              <span className="hs-view-settings__view-icon" aria-hidden>
                ☰
              </span>
              List
            </button>
            <button
              type="button"
              className={`hs-view-settings__view-btn ${view === 'board' ? 'is-active' : ''}`}
              onClick={() => onViewChange?.('board')}
            >
              <span className="hs-view-settings__view-icon" aria-hidden>
                ▦
              </span>
              Board
            </button>
          </div>
        </section>
      )}

      <section className="hs-view-settings__section">
        <p className="hs-view-settings__section-label">Table settings</p>
        <button type="button" className="hs-view-settings__row" disabled>
          <span>Column visibility</span>
          <span className="hs-view-settings__hint">Coming soon</span>
        </button>
      </section>

      <section className="hs-view-settings__section">
        <p className="hs-view-settings__section-label">Data</p>
        <button type="button" className="hs-view-settings__row" onClick={onResetFilters}>
          <span>Reset filters</span>
        </button>
      </section>

      <section className="hs-view-settings__section">
        <p className="hs-view-settings__section-label">Actions</p>
        <button type="button" className="hs-view-settings__row" onClick={onExport}>
          <span>Export visible leads</span>
        </button>
      </section>
    </>
  )
}

export default function PipelineViewSettings({
  open,
  onClose,
  view = 'list',
  onViewChange,
  stageListMode = false,
  onExport,
  onResetFilters,
}) {
  const fullPageMenus = useFullPageFilterMenus()

  useEffect(() => {
    if (!open || fullPageMenus) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, fullPageMenus])

  if (!open) return null

  if (fullPageMenus) {
    return createPortal(
      <MobileFilterFullPage open onClose={onClose} title="View settings">
        <div className="hs-view-settings__body hs-view-settings__body--fullpage">
          <ViewSettingsBody
            view={view}
            onViewChange={onViewChange}
            stageListMode={stageListMode}
            onExport={onExport}
            onResetFilters={onResetFilters}
          />
        </div>
      </MobileFilterFullPage>,
      document.body
    )
  }

  return createPortal(
    <>
      <button
        type="button"
        className="hs-view-settings-backdrop"
        aria-label="Close view settings"
        onClick={onClose}
      />
      <aside className="hs-view-settings" aria-label="View settings">
        <header className="hs-view-settings__header">
          <h2 className="hs-view-settings__title">
            <SettingsIcon className="hs-view-settings__title-icon" size={18} />
            View settings
          </h2>
          <button type="button" className="hs-view-settings__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="hs-view-settings__body">
          <ViewSettingsBody
            view={view}
            onViewChange={onViewChange}
            stageListMode={stageListMode}
            onExport={onExport}
            onResetFilters={onResetFilters}
          />
        </div>
      </aside>
    </>,
    document.body
  )
}
