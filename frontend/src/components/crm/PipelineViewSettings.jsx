import { useEffect } from 'react'
import { SettingsGearIcon } from '../ui/icons'
import { createPortal } from 'react-dom'
import {
  movePipelineColumn,
  normalizePipelineColumnOrder,
  pipelineColumnMeta,
  pipelineColumnSettingsRows,
} from '../../lib/pipelineColumnPrefs'

export default function PipelineViewSettings({
  open,
  onClose,
  view = 'list',
  onViewChange,
  stageListMode = false,
  visibleColumns = [],
  onColumnsChange,
  hoverActionsEnabled = false,
  onHoverActionsChange,
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

  const orderedVisible = normalizePipelineColumnOrder(visibleColumns)

  const toggleColumn = (id, checked) => {
    const col = pipelineColumnMeta(id)
    if (col?.locked) return
    let next = checked ? [...orderedVisible, id] : orderedVisible.filter((c) => c !== id)
    onColumnsChange?.(normalizePipelineColumnOrder(next))
  }

  const moveColumn = (id, direction) => {
    onColumnsChange?.(movePipelineColumn(orderedVisible, id, direction))
  }

  const columnRows = pipelineColumnSettingsRows(orderedVisible)

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

          {view === 'list' && (
            <section className="hs-view-settings__section">
              <p className="hs-view-settings__section-label">List</p>
              <label className="hs-view-settings__row hs-view-settings__row--check">
                <span>Hover quick actions</span>
                <input
                  type="checkbox"
                  checked={hoverActionsEnabled}
                  onChange={(e) => onHoverActionsChange?.(e.target.checked)}
                />
              </label>
              <p className="hs-view-settings__hint px-0 pt-1">
                Show Call, Email, Task, and other buttons when you hover a lead row.
              </p>
            </section>
          )}

          <section className="hs-view-settings__section">
            <p className="hs-view-settings__section-label">Columns</p>
            <p className="hs-view-settings__hint px-0 pb-2">
              Name stays first. Use arrows to reorder visible columns.
            </p>
            {columnRows.map((id) => {
              const col = pipelineColumnMeta(id)
              if (!col) return null
              const isVisible = orderedVisible.includes(id)
              const visibleIndex = orderedVisible.indexOf(id)
              const canMoveUp = isVisible && !col.locked && visibleIndex > 1
              const canMoveDown = isVisible && !col.locked && visibleIndex >= 1 && visibleIndex < orderedVisible.length - 1

              return (
                <div
                  key={id}
                  className={`hs-view-settings__column-row${isVisible ? '' : ' hs-view-settings__column-row--hidden'}`}
                >
                  <label className="hs-view-settings__row hs-view-settings__row--check hs-view-settings__column-check">
                    <span>{col.label}</span>
                    <input
                      type="checkbox"
                      checked={isVisible}
                      disabled={col.locked}
                      onChange={(e) => toggleColumn(id, e.target.checked)}
                    />
                  </label>
                  {isVisible && !col.locked ? (
                    <div className="hs-view-settings__column-move">
                      <button
                        type="button"
                        className="hs-view-settings__column-move-btn"
                        disabled={!canMoveUp}
                        aria-label={`Move ${col.label} up`}
                        onClick={() => moveColumn(id, 'up')}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="hs-view-settings__column-move-btn"
                        disabled={!canMoveDown}
                        aria-label={`Move ${col.label} down`}
                        onClick={() => moveColumn(id, 'down')}
                      >
                        ↓
                      </button>
                    </div>
                  ) : col.locked ? (
                    <span className="hs-view-settings__column-pinned" title="Always first">
                      Pinned
                    </span>
                  ) : null}
                </div>
              )
            })}
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
