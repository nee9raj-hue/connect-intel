import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  BlocksIcon,
  ChevronDownIcon,
  LogIcon,
  MailIcon,
  PanelRightIcon,
  PeopleIcon,
  SlidersIcon,
  TaskIcon,
  TrashIcon,
} from '../ui/icons'

const MENU_ITEMS = [
  { id: 'open', label: 'Open lead', icon: PanelRightIcon, runKey: 'onOpen' },
  { id: 'log', label: 'Log activity', icon: LogIcon, runKey: 'onLogCall' },
  { id: 'email', label: 'Send email', icon: MailIcon, runKey: 'onSendEmail' },
  { id: 'task', label: 'Add task', icon: TaskIcon, runKey: 'onAddTask' },
  { id: 'status', label: 'Change status', icon: SlidersIcon, runKey: 'onChangeStatus', chevron: true },
  { id: 'owner', label: 'Change owner', icon: PeopleIcon, runKey: 'onChangeOwner', chevron: true, requiresAssign: true },
  { id: 'delete', label: 'Delete lead', icon: TrashIcon, runKey: 'onDelete', danger: true },
]

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

  const handlers = {
    onOpen: () => onOpen?.(lead),
    onLogCall: () => onLogCall?.(lead),
    onSendEmail: () => onSendEmail?.(lead),
    onAddTask: () => onAddTask?.(lead),
    onChangeStatus: () => onChangeStatus?.(lead),
    onChangeOwner: () => onChangeOwner?.(lead),
    onDelete: () => onDelete?.(lead),
  }

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => {
      if (menuRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDoc, true)
      document.removeEventListener('keydown', onKey, true)
    }
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
          top: rect.bottom + 6,
          left: Math.min(Math.max(8, rect.right - 208), window.innerWidth - 216),
          zIndex: 200,
        }
      : undefined

  const visibleItems = MENU_ITEMS.filter((item) => !item.requiresAssign || canAssign)

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="pipeline-row-actions-trigger"
        aria-label={`Actions for ${leadName}`}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Lead actions"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        <span className="pipeline-row-actions-trigger__icon-wrap" aria-hidden>
          <BlocksIcon className="pipeline-row-actions-trigger__icon" />
        </span>
        <span className="pipeline-row-actions-trigger__label">Actions</span>
        <ChevronDownIcon
          className={`pipeline-row-actions-trigger__chevron ${open ? 'is-open' : ''}`}
          aria-hidden
        />
      </button>
      {open &&
        createPortal(
          <div ref={menuRef} className="pipeline-row-actions-menu" style={style} role="menu">
            <p className="pipeline-row-actions-menu__head">Quick actions</p>
            {visibleItems.map((item) => {
              if (item.danger) {
                return (
                  <div key={item.id}>
                    <hr className="pipeline-row-actions-menu__sep" />
                    <button
                      type="button"
                      role="menuitem"
                      className="pipeline-row-actions-menu__item pipeline-row-actions-menu__danger"
                      onClick={() => run(handlers[item.runKey])}
                    >
                      <item.icon className="pipeline-row-actions-menu__item-icon" aria-hidden />
                      <span>{item.label}</span>
                    </button>
                  </div>
                )
              }
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  className="pipeline-row-actions-menu__item"
                  onClick={() => run(handlers[item.runKey])}
                >
                  <item.icon className="pipeline-row-actions-menu__item-icon" aria-hidden />
                  <span>{item.label}</span>
                  {item.chevron ? <span className="pipeline-row-actions-menu__item-hint" aria-hidden>›</span> : null}
                </button>
              )
            })}
          </div>,
          document.body
        )}
    </>
  )
}
