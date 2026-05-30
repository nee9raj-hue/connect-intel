import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BRAND_UI_ICON_CLASS } from '../../lib/brandAssets'
import { getStatusMeta } from '../../lib/crmConstants'
import useIsMobile from '../../hooks/useIsMobile'

function FilterMenuCheck({ className = '' }) {
  return (
    <svg
      className={`crm-filter-menu-check ${className}`.trim()}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
    >
      <path d="M6.2 11.2 3.4 8.4l-.9.9 3.7 3.7 7.4-7.4-.9-.9-6.5 6.5Z" />
    </svg>
  )
}

/**
 * HubSpot-style filter: text button + popover (single or multi-select with checkboxes).
 * Icon-only mode portals the menu on mobile (and desktop) so overflow scroll strips cannot clip it.
 */
export default function FilterDropdown({
  label,
  value,
  values = [],
  displayValue,
  options = [],
  onChange,
  onMultiChange,
  multiSelect = false,
  searchable = false,
  placeholder = 'Search…',
  emptyLabel = 'Any',
  className = '',
  compact = false,
  wide = false,
  iconOnly = false,
  iconSrc = null,
  icon: Icon = null,
  menuVariant = 'default',
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [draftMulti, setDraftMulti] = useState([])
  const [anchorPos, setAnchorPos] = useState({ top: 0, left: 0 })
  const rootRef = useRef(null)
  const menuRef = useRef(null)
  const openedAtRef = useRef(0)
  const isMobile = useIsMobile()

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
  }, [])

  const toggleOpen = useCallback(() => {
    setOpen((wasOpen) => {
      if (!wasOpen) openedAtRef.current = Date.now()
      return !wasOpen
    })
  }, [])

  const iconButton = iconOnly && (iconSrc || Icon)
  const hubspotStatusMenu = menuVariant === 'hubspot-status' && !multiSelect
  const usePortalMenu = Boolean(iconButton && open)

  useLayoutEffect(() => {
    if (!open || !iconButton || isMobile) return
    const btn = rootRef.current?.querySelector('button')
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const menuWidth = hubspotStatusMenu ? 248 : wide ? 280 : 240
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8))
    setAnchorPos({ top: rect.bottom + 4, left })
  }, [open, iconButton, isMobile, hubspotStatusMenu, wide])

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => {
      if (Date.now() - openedAtRef.current < 320) return
      const t = e.target
      if (rootRef.current?.contains(t)) return
      if (menuRef.current?.contains(t)) return
      close()
    }
    const timer = window.setTimeout(() => {
      document.addEventListener('mousedown', onDoc, true)
      document.addEventListener('touchstart', onDoc, { capture: true, passive: true })
    }, 280)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('mousedown', onDoc, true)
      document.removeEventListener('touchstart', onDoc, true)
    }
  }, [open, close])

  useEffect(() => {
    if (!open || !isMobile || !iconButton) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open, isMobile, iconButton])

  useEffect(() => {
    if (open && multiSelect) setDraftMulti([...(values || [])])
  }, [open, multiSelect, values])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query])

  const active = multiSelect ? (values?.length || 0) > 0 : Boolean(value)
  const shown = useMemo(() => {
    if (displayValue) return displayValue
    if (multiSelect) {
      const n = values?.length || 0
      if (n === 0) return null
      if (n === 1) return values[0]
      return `${values[0]} +${n - 1}`
    }
    return value || null
  }, [displayValue, multiSelect, value, values])

  const toggleMulti = (optValue) => {
    setDraftMulti((prev) => {
      const v = optValue ?? ''
      if (prev.includes(v)) return prev.filter((x) => x !== v)
      return [...prev, v]
    })
  }

  const applyMulti = () => {
    onMultiChange?.(draftMulti)
    close()
  }

  const menuClassName = [
    'crm-filter-menu',
    wide ? 'crm-filter-menu--wide' : '',
    hubspotStatusMenu ? 'crm-filter-menu--hubspot-status' : '',
    usePortalMenu && isMobile ? 'crm-filter-menu--mobile-sheet' : '',
    usePortalMenu && !isMobile ? 'crm-filter-menu--portaled' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const renderMenuBody = () => (
    <>
      {(hubspotStatusMenu || (usePortalMenu && isMobile)) && (
        <div className="crm-filter-menu-header crm-filter-menu-header--sheet">
          <span className="crm-filter-menu-header-title">{label}</span>
          {usePortalMenu && isMobile && (
            <button type="button" className="crm-filter-menu-sheet-close" onClick={close} aria-label="Close">
              ×
            </button>
          )}
        </div>
      )}

      {searchable && !hubspotStatusMenu && (
        <div className="crm-filter-menu-search">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="crm-filter-search-input"
            autoFocus={!isMobile}
          />
        </div>
      )}

      {!multiSelect && (
        <ul className={`crm-filter-menu-list ${hubspotStatusMenu ? 'crm-filter-menu-list--hubspot' : ''}`}>
          <li>
            <button
              type="button"
              className={`crm-filter-option ${hubspotStatusMenu ? 'crm-filter-option--hs' : ''} ${!value ? 'is-selected' : ''}`}
              onClick={() => {
                onChange('')
                close()
              }}
            >
              {hubspotStatusMenu ? (
                <>
                  <span className="crm-filter-option-label">{emptyLabel}</span>
                  {!value ? <FilterMenuCheck /> : <span className="crm-filter-menu-check-placeholder" aria-hidden />}
                </>
              ) : (
                <span className="crm-filter-option-label">{emptyLabel}</span>
              )}
            </button>
          </li>
          {filtered.map((opt) => {
            const optVal = opt.value ?? opt.label
            const selected = value === optVal
            const meta = hubspotStatusMenu ? getStatusMeta(optVal) : null
            return (
              <li key={opt.id ?? optVal}>
                <button
                  type="button"
                  className={`crm-filter-option ${hubspotStatusMenu ? 'crm-filter-option--hs' : ''} ${selected ? 'is-selected' : ''}`}
                  onClick={() => {
                    onChange(optVal)
                    close()
                  }}
                >
                  {hubspotStatusMenu ? (
                    <>
                      <span className={`pipeline-hs-status ${meta.color}`}>{opt.label}</span>
                      {selected ? <FilterMenuCheck /> : <span className="crm-filter-menu-check-placeholder" aria-hidden />}
                    </>
                  ) : (
                    <>
                      <span className="crm-filter-option-label">{opt.label}</span>
                      {opt.sublabel ? <span className="crm-filter-option-sublabel">{opt.sublabel}</span> : null}
                    </>
                  )}
                </button>
              </li>
            )
          })}
          {filtered.length === 0 && <li className="px-3 py-2 text-xs text-[#516f90]">No matches</li>}
        </ul>
      )}

      {multiSelect && (
        <>
          <ul className="crm-filter-menu-list crm-filter-menu-list--multi">
            {filtered.map((opt) => {
              const optVal = opt.value ?? opt.label
              const checked = draftMulti.includes(optVal)
              return (
                <li key={opt.id ?? optVal}>
                  <label className={`crm-filter-check-row ${checked ? 'is-checked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMulti(optVal)}
                      className="crm-filter-check-input"
                    />
                    <span className="crm-filter-option-label">{opt.label}</span>
                  </label>
                </li>
              )
            })}
            {filtered.length === 0 && <li className="px-3 py-2 text-xs text-[#516f90]">No matches</li>}
          </ul>
          <div className="crm-filter-menu-footer">
            <button type="button" className="crm-filter-menu-footer-link" onClick={() => setDraftMulti([])}>
              Clear
            </button>
            <button type="button" className="crm-filter-menu-footer-apply" onClick={applyMulti}>
              Apply
            </button>
          </div>
        </>
      )}
    </>
  )

  const menuStyle = useMemo(() => {
    if (!usePortalMenu) return undefined
    if (isMobile) {
      return {
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        top: 'auto',
        zIndex: 1200,
        width: '100%',
        maxWidth: '100%',
      }
    }
    return { position: 'fixed', top: anchorPos.top, left: anchorPos.left, zIndex: 1200 }
  }, [usePortalMenu, isMobile, anchorPos.top, anchorPos.left])

  const menuEl = open ? (
    <div ref={menuRef} className={menuClassName} role="listbox" style={menuStyle}>
      {renderMenuBody()}
    </div>
  ) : null

  return (
    <>
      <div ref={rootRef} className={`relative ${iconButton ? 'hs-filter-icon-wrap' : ''} ${className}`}>
        <button
          type="button"
          onClick={toggleOpen}
          onPointerDown={(e) => e.stopPropagation()}
          className={
            iconButton
              ? `hs-filter-icon-btn ${active ? 'is-active' : ''}`
              : `crm-filter-btn ${compact ? 'crm-filter-btn--compact' : ''} ${active ? 'crm-filter-btn-active' : ''}`
          }
          aria-expanded={open}
          aria-label={iconButton ? (active && shown ? `${label}: ${shown}` : label) : undefined}
          data-tooltip={iconButton && !isMobile ? label : undefined}
        >
          {iconButton ? (
            Icon ? (
              <Icon className="hs-filter-icon-btn__svg shrink-0" aria-hidden />
            ) : (
              <img src={iconSrc} alt="" className={BRAND_UI_ICON_CLASS} draggable={false} aria-hidden />
            )
          ) : (
            <>
              <span className={`truncate ${compact ? 'max-w-[108px]' : 'max-w-[150px]'}`}>
                {active && shown ? (
                  <>
                    <span className="crm-filter-btn-label">{label}:</span> {shown}
                  </>
                ) : (
                  label
                )}
              </span>
              <svg className="crm-filter-chevron" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                <path d="M4.5 6l3.5 3.5L11.5 6H4.5z" />
              </svg>
            </>
          )}
        </button>

        {open && !usePortalMenu && menuEl}
      </div>

      {usePortalMenu &&
        createPortal(
          <>
            <button
              type="button"
              className="ci-filter-menu-backdrop"
              aria-label="Close menu"
              onClick={close}
            />
            {menuEl}
          </>,
          document.body
        )}
    </>
  )
}

export function FilterChipButton({ label, onRemove }) {
  return (
    <span className="crm-filter-chip">
      <span>{label}</span>
      <button type="button" onClick={onRemove} className="crm-filter-chip-x" aria-label="Remove filter">
        ×
      </button>
    </span>
  )
}
