import { useCallback, useEffect, useMemo, useState } from 'react'
import GuideMockScene from './GuideMockScene'

export default function PanelGuideModal({
  open,
  onClose,
  title = 'How to use this panel',
  steps = [],
  storageKey,
  onMarkSeen,
}) {
  const [index, setIndex] = useState(0)

  const safeSteps = useMemo(() => (Array.isArray(steps) ? steps.filter(Boolean) : []), [steps])
  const step = safeSteps[index]
  const total = safeSteps.length

  useEffect(() => {
    if (!open) return
    setIndex(0)
  }, [open, steps])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, total - 1))
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, total])

  const markSeen = useCallback(() => {
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, new Date().toISOString())
      } catch {
        /* ignore */
      }
    }
    onMarkSeen?.()
  }, [storageKey, onMarkSeen])

  const finish = useCallback(() => {
    markSeen()
    onClose?.()
  }, [markSeen, onClose])

  if (!open || !step) return null

  return (
    <div
      className="panel-guide-overlay"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        className="panel-guide-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="panel-guide-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="panel-guide-head">
          <div>
            <p className="panel-guide-eyebrow">{title}</p>
            <h2 id="panel-guide-title" className="panel-guide-title">
              {step.title}
            </h2>
          </div>
          <button type="button" className="panel-guide-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="panel-guide-layout">
          <GuideMockScene sceneId={step.scene} />
          <div className="panel-guide-copy">
            <p className="panel-guide-body">{step.body}</p>
            {step.highlights?.length > 0 && (
              <ul className="panel-guide-highlights">
                {step.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            )}
            <p className="panel-guide-progress">
              Step {index + 1} of {total}
            </p>
          </div>
        </div>

        <div className="panel-guide-dots" role="tablist" aria-label="Guide steps">
          {safeSteps.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Step ${i + 1}: ${s.title}`}
              className={`panel-guide-dot ${i === index ? 'is-active' : ''}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>

        <footer className="panel-guide-foot">
          <button
            type="button"
            className="crm-btn crm-btn-secondary"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            Back
          </button>
          <div className="panel-guide-foot__right">
            <button type="button" className="crm-btn crm-btn-ghost" onClick={finish}>
              Skip for now
            </button>
            {index < total - 1 ? (
              <button
                type="button"
                className="crm-btn crm-btn-primary"
                onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
              >
                Next
              </button>
            ) : (
              <button type="button" className="crm-btn crm-btn-primary" onClick={finish}>
                Done
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}
