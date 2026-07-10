import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../lib/api'
import { useUsagePolicies } from '../../hooks/useUsagePolicies.js'
import { buildCustomerNavSections } from '../../lib/navConfig'
import { flattenNavSections, filterNavItems, QUICK_ACTIONS } from '../../lib/platformNav'
import { openMarketingCampaignReport } from '../../lib/marketingReportUrls'

const TYPE_LABELS = {
  lead: 'Lead',
  contact: 'Contact',
  company: 'Company',
  campaign: 'Campaign',
  deal: 'Deal',
  task: 'Task',
  note: 'Note',
  message: 'Message',
  template: 'Template',
}

function useDebounced(value, ms = 500) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

export default function CommandPalette({
  open,
  onClose,
  onNavigate,
  openPipelineLead,
  user,
}) {
  const [query, setQuery] = useState('')
  const [recordResults, setRecordResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef(null)
  const policies = useUsagePolicies()
  const debouncedQuery = useDebounced(query, policies.searchDebounceMs ?? 500)
  const searchMinLength = policies.searchMinLength ?? 2
  const searchMaxResults = policies.searchMaxResults ?? 50

  const navItems = useMemo(() => {
    if (!user) return []
    const sections = buildCustomerNavSections(user, {
      pipelineCounts: {},
      upcomingCount: 0,
    })
    return flattenNavSections(sections)
  }, [user])

  const filteredNav = useMemo(() => filterNavItems(navItems, query), [navItems, query])
  const filteredQuick = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return QUICK_ACTIONS.slice(0, 4)
    return QUICK_ACTIONS.filter((a) => a.label.toLowerCase().includes(q))
  }, [query])

  const allItems = useMemo(() => {
    const rows = []
    for (const item of filteredQuick) {
      rows.push({ kind: 'action', ...item })
    }
    for (const item of filteredNav) {
      rows.push({ kind: 'nav', ...item })
    }
    for (const item of recordResults) {
      rows.push({ kind: 'record', ...item })
    }
    return rows
  }, [filteredQuick, filteredNav, recordResults])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setRecordResults([])
    setActiveIndex(0)
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  useEffect(() => {
    setActiveIndex(0)
  }, [query, recordResults.length])

  useEffect(() => {
    if (!open || debouncedQuery.trim().length < searchMinLength) {
      setRecordResults([])
      setSearching(false)
      return undefined
    }

    let cancelled = false
    setSearching(true)
    api
      .platformSearch(debouncedQuery.trim(), searchMaxResults)
      .then((data) => {
        if (!cancelled) setRecordResults((data.results || []).slice(0, searchMaxResults))
      })
      .catch(() => {
        if (!cancelled) setRecordResults([])
      })
      .finally(() => {
        if (!cancelled) setSearching(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, debouncedQuery, searchMinLength, searchMaxResults])

  const runItem = useCallback(
    (item) => {
      if (!item) return
      onClose?.()

      if (item.kind === 'record') {
        if (item.type === 'campaign') {
          openMarketingCampaignReport(item.id)
          return
        }
        if (item.leadId) {
          onNavigate?.(item.panel || 'pipeline', {
            ...(item.view ? { view: item.view } : {}),
            ...(item.dealStage ? { dealStage: item.dealStage } : {}),
          })
          openPipelineLead?.(item.leadId)
          return
        }
        onNavigate?.(item.panel || 'contacts', {
          ...(item.tab ? { tab: item.tab } : {}),
          ...(item.view ? { view: item.view } : {}),
          ...(item.dealStage ? { dealStage: item.dealStage } : {}),
        })
        return
      }

      onNavigate?.(item.panel, {
        ...(item.options || {}),
        ...(item.tab ? { tab: item.tab } : {}),
      })
    },
    [onClose, onNavigate, openPipelineLead]
  )

  useEffect(() => {
    if (!open) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose?.()
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, Math.max(0, allItems.length - 1)))
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        runItem(allItems[activeIndex])
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, allItems, activeIndex, runItem, onClose])

  if (!open) return null

  let section = null
  const renderRows = []

  for (let i = 0; i < allItems.length; i += 1) {
    const item = allItems[i]
    const heading =
      item.kind === 'action'
        ? 'Quick actions'
        : item.kind === 'nav'
          ? 'Go to'
          : 'Records'
    if (heading !== section) {
      section = heading
      renderRows.push(
        <p key={`h-${heading}`} className="ci-cmd-section">
          {heading}
        </p>
      )
    }
    renderRows.push(
      <button
        key={`${item.kind}-${item.id}-${i}`}
        type="button"
        className={`ci-cmd-item ${i === activeIndex ? 'is-active' : ''}`}
        onMouseEnter={() => setActiveIndex(i)}
        onClick={() => runItem(item)}
      >
        <span className="ci-cmd-item-label">{item.label || item.title}</span>
        <span className="ci-cmd-item-meta">
          {item.kind === 'record' ? TYPE_LABELS[item.type] || item.type : item.group}
        </span>
      </button>
    )
  }

  return (
    <div className="ci-cmd-overlay" role="presentation" onClick={onClose}>
      <div
        className="ci-cmd-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ci-cmd-input-wrap">
          <input
            ref={inputRef}
            className="ci-cmd-input"
            placeholder="Search leads, tasks, templates… or jump to a page"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="ci-cmd-kbd">esc</kbd>
        </div>

        <div className="ci-cmd-results">
          {!allItems.length && !searching && (
            <p className="ci-cmd-empty">
              {query.trim().length < 2
                ? 'Type to search records or pick a destination.'
                : 'No matches — try a name, email, or company.'}
            </p>
          )}
          {searching && <p className="ci-cmd-empty">Searching…</p>}
          {renderRows}
        </div>

        <div className="ci-cmd-footer">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span className="hidden sm:inline">⌘K anytime</span>
        </div>
      </div>
    </div>
  )
}
