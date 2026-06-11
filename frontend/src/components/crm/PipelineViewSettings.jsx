import { useEffect } from 'react'
import { SettingsGearIcon } from '../ui/icons'
import { createPortal } from 'react-dom'
import { PIPELINE_TABLE_COLUMNS } from '../../lib/pipelineColumnPrefs'

export default function PipelineViewSettings({
  open,
  onClose,
  view = 'list',
  onViewChange,
  stageListMode = false,
  visibleColumns = [],
  onColumnsChange,
  onExport,
  onResetFilters,
}) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const toggleColumn = (id, checked) => {
    const col = PIPELINE_TABLE_COLUMNS.find((c) => c.id === id)
    if (col?.locked) return
    let next = checked
      ? [...visibleColumns, id]
      : visibleColumns.filter((c) => c !== id)
    if (!next.includes('name')) next = ['name', ...next]
    onColumnsChange?.(next)
  }

  if (!open) return null

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
            <SettingsGearIcon className="hs-view-settings__title-icon w-[18px] h-[18px]" />
            View settings
          </h2>
          <button type="button" className="hs-view-settings__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="hs-view-settings__body">
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
            <p className="hs-view-settings__section-label">Columns</p>
            {PIPELINE_TABLE_COLUMNS.map((col) => (
              <label key={col.id} className="hs-view-settings__row hs-view-settings__row--check">
                <span>{col.label}</span>
                <input
                  type="checkbox"
                  checked={visibleColumns.includes(col.id)}
                  disabled={col.locked}
                  onChange={(e) => toggleColumn(col.id, e.target.checked)}
                />
              </label>
            ))}
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
        </div>
      </aside>
    </>,
    document.body
  )
}
