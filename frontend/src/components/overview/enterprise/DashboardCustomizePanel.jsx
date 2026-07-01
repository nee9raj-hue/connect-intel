import { useState } from 'react'
import { DASHBOARD_WIDGET_LABELS } from '../../../lib/dashboardLayoutPreferences'

export default function DashboardCustomizePanel({ layout, onSave, onClose }) {
  const [draft, setDraft] = useState(() => [...layout])
  const [dragId, setDragId] = useState(null)

  const move = (fromIdx, toIdx) => {
    if (toIdx < 0 || toIdx >= draft.length) return
    setDraft((rows) => {
      const next = [...rows]
      const [item] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, item)
      return next
    })
  }

  const toggle = (id) => {
    setDraft((rows) => rows.map((r) => (r.id === id ? { ...r, visible: !r.visible } : r)))
  }

  const onDrop = (targetId) => {
    if (!dragId || dragId === targetId) return
    const fromIdx = draft.findIndex((r) => r.id === dragId)
    const toIdx = draft.findIndex((r) => r.id === targetId)
    if (fromIdx < 0 || toIdx < 0) return
    move(fromIdx, toIdx)
    setDragId(null)
  }

  return (
    <div className="dash-ent__customize-backdrop" role="presentation" onClick={onClose}>
      <div
        className="dash-ent__customize"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dash-customize-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dash-ent__customize-head">
          <h2 id="dash-customize-title">Customize dashboard</h2>
          <p>Show, hide, and reorder widgets. Saved on this device.</p>
          <button type="button" className="dash-ent__customize-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <ul className="dash-ent__customize-list" aria-label="Dashboard widgets">
          {draft.map((row, idx) => (
            <li
              key={row.id}
              className={`dash-ent__customize-row${row.visible === false ? ' is-hidden' : ''}`}
              draggable
              onDragStart={() => setDragId(row.id)}
              onDragEnd={() => setDragId(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(row.id)}
            >
              <span className="dash-ent__customize-grip" aria-hidden>
                ⠿
              </span>
              <label className="dash-ent__customize-label">
                <input
                  type="checkbox"
                  checked={row.visible !== false}
                  onChange={() => toggle(row.id)}
                />
                {DASHBOARD_WIDGET_LABELS[row.id] || row.id}
              </label>
              <div className="dash-ent__customize-move">
                <button
                  type="button"
                  className="dash-home__btn"
                  disabled={idx === 0}
                  onClick={() => move(idx, idx - 1)}
                  aria-label={`Move ${DASHBOARD_WIDGET_LABELS[row.id]} up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="dash-home__btn"
                  disabled={idx === draft.length - 1}
                  onClick={() => move(idx, idx + 1)}
                  aria-label={`Move ${DASHBOARD_WIDGET_LABELS[row.id]} down`}
                >
                  ↓
                </button>
              </div>
            </li>
          ))}
        </ul>

        <footer className="dash-ent__customize-foot">
          <button type="button" className="dash-home__btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="dash-ent__cta"
            onClick={() => {
              onSave(draft)
              onClose()
            }}
          >
            Save layout
          </button>
        </footer>
      </div>
    </div>
  )
}
