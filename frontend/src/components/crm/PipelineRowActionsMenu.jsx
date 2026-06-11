import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export default function PipelineRowActionsMenu({
  lead,
  leadName,
  canAssign = false,
  onOpen,
  onLogCall,
  onSendEmail,
  onAddTask,
  onChangeStatus,
  onChangeOwner,
  onDelete,
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => {
      if (menuRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc, true)
    return () => document.removeEventListener('mousedown', onDoc, true)
  }, [open])

  const run = (fn) => {
    setOpen(false)
    fn?.()
  }

  const rect = btnRef.current?.getBoundingClientRect()
  const style =
    open && rect
      ? {
          position: 'fixed',
          top: rect.bottom + 4,
          left: Math.min(rect.left, window.innerWidth - 200),
          zIndex: 200,
        }
      : undefined

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="pipeline-row-actions-btn"
        aria-label={`Actions for ${leadName}`}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        ···
      </button>
      {open &&
        createPortal(
          <div ref={menuRef} className="pipeline-row-actions-menu" style={style} role="menu">
            <button type="button" role="menuitem" onClick={() => run(() => onOpen?.(lead))}>
              Open lead
            </button>
            <button type="button" role="menuitem" onClick={() => run(() => onLogCall?.(lead))}>
              Log activity
            </button>
            <button type="button" role="menuitem" onClick={() => run(() => onSendEmail?.(lead))}>
              Send email
            </button>
            <button type="button" role="menuitem" onClick={() => run(() => onAddTask?.(lead))}>
              Add task
            </button>
            <button type="button" role="menuitem" onClick={() => run(() => onChangeStatus?.(lead))}>
              Change status →
            </button>
            {canAssign ? (
              <button type="button" role="menuitem" onClick={() => run(() => onChangeOwner?.(lead))}>
                Change owner →
              </button>
            ) : null}
            <hr className="pipeline-row-actions-menu__sep" />
            <button
              type="button"
              role="menuitem"
              className="pipeline-row-actions-menu__danger"
              onClick={() => run(() => onDelete?.(lead))}
            >
              Delete lead
            </button>
          </div>,
          document.body
        )}
    </>
  )
}
