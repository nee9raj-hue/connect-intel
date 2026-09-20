import { useMemo, useState } from 'react'
import { formatCrmDate, getStatusMeta } from '../../lib/crmConstants'
import { formatDateTime } from '../../lib/crmUiConstants'
import { getLeadCity, getLeadState, leadOwnerUserId } from '../../lib/pipelineFilters'
import { hasActiveTextSelection } from '../../lib/keyboardShortcuts'
import { getLeadEmail, leadHasSendableEmail } from '../../lib/emailUtils'
import LeadPhoneCall from './LeadPhoneCall'
import LeadTag from '../ui/LeadTag'
import ErpTagChips from './ErpTagChips'
import { readDisplayErpTagsFromLead } from '../../lib/erpTags'
import { leadHasCallablePhone } from '../../lib/phoneUtils'
import {
  DEFAULT_PIPELINE_VISIBLE_COLUMNS,
  normalizePipelineColumnOrder,
} from '../../lib/pipelineColumnPrefs'
import { formatLastShipmentMonthYear, resolveLeadLastOrderCreatedAt } from '../../../../lib/leadLastOrder.js'
import FilterDropdown from './FilterDropdown'
import PipelineRowActionsMenu from './PipelineRowActionsMenu'
import { DEAL_MONTH_OPTIONS, dealYearOptions } from '../../lib/pipelineDealsFilter'
import { NOTES_PRESENCE_OPTIONS } from '../../../../lib/pipelineColumnFilters.js'
import {
  PhoneIcon,
  MailIcon,
  TaskIcon,
  NoteIcon,
  CalendarIcon,
  LogIcon,
  WhatsAppIcon,
  ChevronRightIcon,
} from '../ui/icons'

function displayName(lead) {
  const n = [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim()
  return n || lead.company || 'Unnamed lead'
}

function initialsFor(name) {
  const parts = String(name || '?').trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return (parts[0]?.[0] || '?').toUpperCase()
}

function resolveLeadTags(lead, tagById) {
  const ids = lead.crm?.tagIds || []
  return ids
    .map((id) => (typeof tagById?.get === 'function' ? tagById.get(id) : tagById?.[id]))
    .filter(Boolean)
}

function resolveOwnerName(lead, teamMembers) {
  const id = leadOwnerUserId(lead)
  if (!id) return 'No owner'
  const m = (teamMembers || []).find((t) => t.userId === id)
  return m?.name || 'Team member'
}

function lastActivityMeta(lead) {
  const at =
    lead.crm?.lastCommunicationAt ||
    lead.crm?.lastResponseAt ||
    lead.crm?.lastEmailSentAt ||
    lead.crm?.lastCallAt ||
    null
  const type =
    lead.crm?.lastCommunicationType ||
    (lead.crm?.lastCallAt ? 'call' : lead.crm?.lastEmailSentAt ? 'email' : null)
  return { at, type }
}

function relativeLabel(iso) {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0) return 'just now'
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 14) return `${day}d ago`
  return formatCrmDate(iso)
}

const ACTIVITY_ICON_MAP = {
  call: { Icon: PhoneIcon, wrap: 'pipeline-activity-icon-wrap--call' },
  email: { Icon: MailIcon, wrap: 'pipeline-activity-icon-wrap--email' },
  task: { Icon: TaskIcon, wrap: 'pipeline-activity-icon-wrap--task' },
  note: { Icon: NoteIcon, wrap: 'pipeline-activity-icon-wrap--note' },
  meeting: { Icon: CalendarIcon, wrap: 'pipeline-activity-icon-wrap--meeting' },
  status: { Icon: LogIcon, wrap: 'pipeline-activity-icon-wrap--status' },
}

function ActivityTypeIcon({ type }) {
  const entry = ACTIVITY_ICON_MAP[type] || ACTIVITY_ICON_MAP.status
  const { Icon, wrap } = entry
  return (
    <span className={`pipeline-activity-icon-wrap ${wrap}`}>
      <Icon aria-hidden />
    </span>
  )
}

function PipelineQuickAction({ label, Icon, onClick }) {
  return (
    <button type="button" className="pipeline-quick-action" onClick={onClick}>
      <Icon aria-hidden />
      {label}
    </button>
  )
}

function sortLeads(leads, sortKey, sortDir) {
  const dir = sortDir === 'asc' ? 1 : -1
  const copy = [...leads]
  copy.sort((a, b) => {
    let av
    let bv
    switch (sortKey) {
      case 'name':
        av = displayName(a).toLowerCase()
        bv = displayName(b).toLowerCase()
        break
      case 'company':
        av = (a.company || '').toLowerCase()
        bv = (b.company || '').toLowerCase()
        break
      case 'activity':
        av = lastActivityMeta(a).at || ''
        bv = lastActivityMeta(b).at || ''
        break
      case 'lastOrder':
        av = resolveLeadLastOrderCreatedAt(a) || ''
        bv = resolveLeadLastOrderCreatedAt(b) || ''
        break
      case 'created':
        av = a.savedAt || a.createdAt || ''
        bv = b.savedAt || b.createdAt || ''
        break
      default:
        return 0
    }
    if (av < bv) return -1 * dir
    if (av > bv) return 1 * dir
    return 0
  })
  return copy
}

function SortHeader({ label, sortKey, activeKey, sortDir, onSort, className = '' }) {
  const active = activeKey === sortKey
  return (
    <th className={className} scope="col">
      <button
        type="button"
        className={`pipeline-hs-th-btn ${active ? 'is-active' : ''}`}
        onClick={() => onSort(sortKey)}
      >
        <span>{label}</span>
        <span
          className="pipeline-hs-sort-icon"
          style={active ? { color: 'var(--brand-primary, #FF773D)' } : undefined}
          aria-hidden
        >
          {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  )
}

function FilterHeader({
  label,
  className = '',
  options,
  values = [],
  onChange,
  searchable = false,
  emptyLabel = 'Any',
  displayValue,
  sortKey,
  activeKey,
  sortDir,
  onSort,
}) {
  return (
    <th scope="col" className={className}>
      <div className="pipeline-hs-th-row">
        {onSort && sortKey ? (
          <button
            type="button"
            className={`pipeline-hs-th-btn pipeline-hs-th-btn--inline ${activeKey === sortKey ? 'is-active' : ''}`}
            onClick={() => onSort(sortKey)}
          >
            <span className="pipeline-hs-sort-icon" aria-hidden>
              {activeKey === sortKey ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
            </span>
          </button>
        ) : null}
        <FilterDropdown
          portal
          compact
          multiSelect
          searchable={searchable}
          label={label}
          values={values}
          options={options}
          displayValue={displayValue}
          emptyLabel={emptyLabel}
          onMultiChange={onChange}
          className="pipeline-hs-th-filter"
        />
      </div>
    </th>
  )
}

function shipmentPeriodOptions() {
  const years = dealYearOptions(new Date(), []).slice(0, 5)
  const out = []
  for (const year of years) {
    for (const month of DEAL_MONTH_OPTIONS) {
      out.push({
        value: `${year.value}-${month.value}`,
        label: `${month.label} ${year.label}`,
      })
    }
  }
  return out
}

const SHIPMENT_PERIOD_OPTIONS = shipmentPeriodOptions()

function renderPipelineHeader(colId, ctx) {
  const {
    sortKey,
    sortDir,
    onSort,
    statusOptions = [],
    tagOptions = [],
    columnFilters = {},
    onColumnFilterChange,
    shipmentOptions = SHIPMENT_PERIOD_OPTIONS,
  } = ctx
  const patch = (next) => onColumnFilterChange?.(next)
  switch (colId) {
    case 'name':
      return (
        <SortHeader
          key={colId}
          label="Name"
          sortKey="name"
          activeKey={sortKey}
          sortDir={sortDir}
          onSort={onSort}
          className="pipeline-hs-th pipeline-hs-th--name"
        />
      )
    case 'status':
      return (
        <FilterHeader
          key={colId}
          label="Status"
          className="pipeline-hs-th"
          searchable
          options={statusOptions.map((s) => ({ label: s.label, value: s.id }))}
          values={columnFilters.statusIds || []}
          displayValue={
            (columnFilters.statusIds || []).length === 1
              ? statusOptions.find((s) => s.id === columnFilters.statusIds[0])?.label
              : (columnFilters.statusIds || []).length > 1
                ? `${columnFilters.statusIds.length} statuses`
                : undefined
          }
          onChange={(statusIds) => patch({ statusIds })}
        />
      )
    case 'company':
      return (
        <SortHeader
          key={colId}
          label="Company"
          sortKey="company"
          activeKey={sortKey}
          sortDir={sortDir}
          onSort={onSort}
          className="pipeline-hs-th pipeline-hs-th--company"
        />
      )
    case 'city':
      return (
        <th key={colId} scope="col" className="pipeline-hs-th pipeline-hs-th--city">
          City
        </th>
      )
    case 'state':
      return (
        <th key={colId} scope="col" className="pipeline-hs-th pipeline-hs-th--state">
          State
        </th>
      )
    case 'phone':
      return (
        <th key={colId} scope="col" className="pipeline-hs-th pipeline-hs-th--phone">
          Phone
        </th>
      )
    case 'owner':
      return (
        <th key={colId} scope="col" className="pipeline-hs-th pipeline-hs-th--owner">
          Lead owner
        </th>
      )
    case 'activity':
      return (
        <SortHeader
          key={colId}
          label="Last touch"
          sortKey="activity"
          activeKey={sortKey}
          sortDir={sortDir}
          onSort={onSort}
          className="pipeline-hs-th pipeline-hs-th--activity"
        />
      )
    case 'lastOrder':
      return (
        <FilterHeader
          key={colId}
          label="Last shipment"
          className="pipeline-hs-th pipeline-hs-th--created"
          searchable
          options={shipmentOptions}
          values={columnFilters.lastShipmentPeriods || []}
          displayValue={
            (columnFilters.lastShipmentPeriods || []).length === 1
              ? shipmentOptions.find((o) => o.value === columnFilters.lastShipmentPeriods[0])?.label
              : (columnFilters.lastShipmentPeriods || []).length > 1
                ? `${columnFilters.lastShipmentPeriods.length} months`
                : undefined
          }
          onChange={(lastShipmentPeriods) =>
            patch({
              lastShipmentPeriods,
              lastShipmentYear: '',
              lastShipmentMonth: '',
              lastShipmentMonths: [],
            })
          }
          sortKey="lastOrder"
          activeKey={sortKey}
          sortDir={sortDir}
          onSort={onSort}
        />
      )
    case 'tags':
      return (
        <FilterHeader
          key={colId}
          label="Tags"
          className="pipeline-hs-th"
          searchable
          options={tagOptions}
          values={columnFilters.tagIds || []}
          displayValue={
            (columnFilters.tagIds || []).length === 1
              ? tagOptions.find((o) => o.value === columnFilters.tagIds[0])?.label
              : (columnFilters.tagIds || []).length > 1
                ? `${columnFilters.tagIds.length} tags`
                : undefined
          }
          onChange={(tagIds) => patch({ tagIds })}
        />
      )
    case 'email':
      return (
        <th key={colId} scope="col" className="pipeline-hs-th pipeline-hs-th--email">
          Email
        </th>
      )
    case 'notes':
      return (
        <FilterHeader
          key={colId}
          label="Notes"
          className="pipeline-hs-th pipeline-hs-th--notes"
          options={NOTES_PRESENCE_OPTIONS}
          values={columnFilters.notesPresence || []}
          displayValue={
            (columnFilters.notesPresence || []).length === 1
              ? NOTES_PRESENCE_OPTIONS.find((o) => o.value === columnFilters.notesPresence[0])?.label
              : undefined
          }
          emptyLabel="Any"
          onChange={(notesPresence) => patch({ notesPresence })}
        />
      )
    case 'created':
      return (
        <SortHeader
          key={colId}
          label="Created"
          sortKey="created"
          activeKey={sortKey}
          sortDir={sortDir}
          onSort={onSort}
          className="pipeline-hs-th pipeline-hs-th--created"
        />
      )
    default:
      return null
  }
}

function renderPipelineCell(colId, lead, ctx) {
  const {
    meta,
    email,
    city,
    state,
    ownerName,
    activityAt,
    activityType,
    rel,
    stale,
    tags,
    nameStr,
    showHoverActions,
    onSelect,
    onQuickCall,
    onQuickEmail,
    onQuickTask,
    onQuickWhatsApp,
    onStatusChange,
    onOwnerFilter,
    canFilterByOwner,
    statusOptions,
    canAssign,
    onDeleteLead,
    onChangeOwner,
    onChangeStatus,
    onOpenCompany,
    canOpenCompany = false,
  } = ctx

  switch (colId) {
    case 'name':
      return (
        <td key={colId} className="pipeline-hs-td pipeline-hs-td--name">
          <div className="pipeline-hs-name-cell pipeline-hs-name-cell--v2">
            <span className="pipeline-hs-avatar" aria-hidden>
              {(lead.firstName?.[0] || lead.company?.[0] || '?').toUpperCase()}
            </span>
            <div className="pipeline-hs-name-stack">
              <button
                type="button"
                className="pipeline-hs-name-link pipeline-hs-primary-text ci-selectable-text"
                onClick={() => {
                  if (hasActiveTextSelection()) return
                  onSelect(lead.id)
                }}
              >
                {nameStr}
              </button>
            </div>
            {showHoverActions ? (
              <span className="pipeline-row-hover-actions" aria-label="Quick actions">
                {leadHasCallablePhone(lead) ? (
                  <PipelineQuickAction
                    label="Call"
                    Icon={PhoneIcon}
                    onClick={(e) => {
                      e.stopPropagation()
                      onQuickCall?.(lead)
                    }}
                  />
                ) : null}
                {email ? (
                  <PipelineQuickAction
                    label="Email"
                    Icon={MailIcon}
                    onClick={(e) => {
                      e.stopPropagation()
                      onQuickEmail?.(lead)
                    }}
                  />
                ) : null}
                <PipelineQuickAction
                  label="Task"
                  Icon={TaskIcon}
                  onClick={(e) => {
                    e.stopPropagation()
                    onQuickTask?.(lead)
                  }}
                />
                {lead.phone && onQuickWhatsApp ? (
                  <PipelineQuickAction
                    label="WhatsApp"
                    Icon={WhatsAppIcon}
                    onClick={(e) => {
                      e.stopPropagation()
                      onQuickWhatsApp?.(lead)
                    }}
                  />
                ) : null}
                <PipelineQuickAction
                  label="Open"
                  Icon={ChevronRightIcon}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelect(lead.id)
                  }}
                />
              </span>
            ) : null}
          </div>
        </td>
      )
    case 'status':
      return (
        <td key={colId} className="pipeline-hs-td">
          <StatusBadge
            status={lead.crm?.status}
            label={meta.label}
            colorClass={meta.color}
            statusOptions={statusOptions}
            onChange={(next) => onStatusChange?.(lead.id, next)}
          />
        </td>
      )
    case 'company':
      return (
        <td key={colId} className="pipeline-hs-td pipeline-hs-td--company">
          {lead.company ? (
            canOpenCompany && onOpenCompany ? (
              <button
                type="button"
                className="pipeline-hs-company-link pipeline-hs-cell-text"
                title={`Open account: ${lead.company}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenCompany(lead)
                }}
              >
                {lead.company}
              </button>
            ) : (
              <span className="pipeline-hs-cell-text" title={lead.company}>
                {lead.company}
              </span>
            )
          ) : (
            <span className="pipeline-hs-muted">—</span>
          )}
        </td>
      )
    case 'city':
      return (
        <td key={colId} className="pipeline-hs-td pipeline-hs-td--city">
          {city ? (
            <span className="pipeline-hs-cell-text" title={city}>
              {city}
            </span>
          ) : (
            <span className="pipeline-hs-muted">—</span>
          )}
        </td>
      )
    case 'state':
      return (
        <td key={colId} className="pipeline-hs-td pipeline-hs-td--state">
          {state ? (
            <span className="pipeline-hs-cell-text" title={state}>
              {state}
            </span>
          ) : (
            <span className="pipeline-hs-muted">—</span>
          )}
        </td>
      )
    case 'phone':
      return (
        <td key={colId} className="pipeline-hs-td pipeline-hs-td--phone">
          {lead.phone ? (
            <LeadPhoneCall
              phone={lead.phone}
              leadId={lead.id}
              numberClassName="pipeline-hs-cell-text"
              pipelineCallIcon
            />
          ) : (
            <span className="pipeline-hs-muted">—</span>
          )}
        </td>
      )
    case 'owner': {
      const ownerId = leadOwnerUserId(lead)
      return (
        <td key={colId} className="pipeline-hs-td pipeline-hs-td--owner">
          {canFilterByOwner && ownerId ? (
            <button
              type="button"
              className="pipeline-owner-cell pipeline-owner-cell--link"
              onClick={() => onOwnerFilter?.(ownerId)}
            >
              <span className="pipeline-owner-avatar" aria-hidden>
                {initialsFor(ownerName)}
              </span>
              <span className="pipeline-hs-cell-text">{ownerName}</span>
            </button>
          ) : (
            <span className="pipeline-owner-cell">
              <span className="pipeline-owner-avatar" aria-hidden>
                {initialsFor(ownerName)}
              </span>
              <span className={`pipeline-hs-cell-text ${ownerId ? '' : 'pipeline-hs-muted'}`}>
                {ownerName}
              </span>
            </span>
          )}
        </td>
      )
    }
    case 'activity':
      return (
        <td key={colId} className="pipeline-hs-td pipeline-hs-td--activity">
          {activityAt ? (
            <button
              type="button"
              className={`pipeline-activity-cell ${stale ? 'is-stale' : ''}`}
              onClick={() => onSelect(lead.id, 'activity')}
              title={formatDateTime(activityAt)}
            >
              <ActivityTypeIcon type={activityType} />
              {rel}
            </button>
          ) : (
            <span className="pipeline-activity-cell is-none">No touchpoints yet</span>
          )}
        </td>
      )
    case 'lastOrder': {
      const lastOrderAt = resolveLeadLastOrderCreatedAt(lead)
      return (
        <td key={colId} className="pipeline-hs-td">
          {lastOrderAt ? (
            <button
              type="button"
              className="pipeline-hs-cell-text"
              onClick={() => onSelect(lead.id, 'erp-revenue')}
              title={formatDateTime(lastOrderAt)}
            >
              {formatLastShipmentMonthYear(lastOrderAt)}
            </button>
          ) : (
            <span className="pipeline-hs-muted">—</span>
          )}
        </td>
      )
    }
    case 'tags': {
      const erpTags = readDisplayErpTagsFromLead(lead)
      const hasCrmTags = tags.length > 0
      const hasErpTags = erpTags.length > 0
      return (
        <td key={colId} className="pipeline-hs-td pipeline-hs-td--tags">
          {hasCrmTags || hasErpTags ? (
            <div className="pipeline-hs-tags-stack">
              {hasCrmTags ? (
                <div className="ci-lead-tags pipeline-hs-tags-cell">
                  {tags.slice(0, 4).map((t) => (
                    <LeadTag key={t.id} name={t.name} title={t.name} />
                  ))}
                  {tags.length > 4 ? (
                    <span className="ci-lead-tags-more" title={tags.map((t) => t.name).join(', ')}>
                      +{tags.length - 4}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {hasErpTags ? <ErpTagChips lead={lead} max={4} className="pipeline-hs-erp-tags" /> : null}
            </div>
          ) : (
            <span className="pipeline-hs-muted">—</span>
          )}
        </td>
      )
    }
    case 'email':
      return (
        <td key={colId} className="pipeline-hs-td pipeline-hs-td--email">
          {email ? (
            leadHasSendableEmail(lead) ? (
              <a
                href={`mailto:${encodeURIComponent(email)}`}
                className="pipeline-hs-cell-text pipeline-hs-email-text"
                onClick={(e) => e.stopPropagation()}
              >
                {email}
              </a>
            ) : (
              <span className="pipeline-hs-cell-text pipeline-hs-email-text">{email}</span>
            )
          ) : (
            <span className="pipeline-hs-muted">—</span>
          )}
        </td>
      )
    case 'notes': {
      const notes = String(lead.crm?.notes || '').trim()
      return (
        <td key={colId} className="pipeline-hs-td pipeline-hs-td--notes">
          {notes ? (
            <span className="pipeline-hs-cell-text pipeline-hs-notes-preview" title={notes}>
              {notes.length > 80 ? `${notes.slice(0, 80)}…` : notes}
            </span>
          ) : (
            <span className="pipeline-hs-muted">—</span>
          )}
        </td>
      )
    }
    case 'created':
      return (
        <td key={colId} className="pipeline-hs-td">
          <span className="pipeline-hs-date">{formatCrmDate(lead.savedAt || lead.createdAt)}</span>
        </td>
      )
    default:
      return null
  }
}

function StatusBadge({ status, label, colorClass, onChange, statusOptions = [] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative inline-block">
      <button
        type="button"
        className={`pipeline-hs-status ${colorClass}`}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        {label}
      </button>
      {open && statusOptions.length > 0 ? (
        <div className="pipeline-status-menu" role="menu">
          {statusOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                if (opt.id !== status) onChange?.(opt.id)
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function PipelineLeadsTable({
  leads,
  showHoverActions = false,
  selectedId,
  selectedIds,
  onSelect,
  onToggleSelect,
  onSelectAllVisible,
  visibleColumns = DEFAULT_PIPELINE_VISIBLE_COLUMNS,
  statusOptions = [],
  tagById,
  teamMembers = [],
  onStatusChange,
  onOwnerFilter,
  canFilterByOwner = false,
  onQuickCall,
  onQuickEmail,
  onQuickTask,
  onQuickWhatsApp,
  canAssign = false,
  onDeleteLead,
  onChangeOwner,
  onChangeStatus,
  onOpenCompany,
  canOpenCompany = false,
  freightOrg = false,
  pipelineTrack = '',
  columnFilters = {},
  onColumnFilterChange,
  tagOptions = [],
}) {
  const [sortKey, setSortKey] = useState('created')
  const [sortDir, setSortDir] = useState('desc')

  const orderedColumns = useMemo(
    () => normalizePipelineColumnOrder(visibleColumns),
    [visibleColumns]
  )

  const sorted = useMemo(() => sortLeads(leads, sortKey, sortDir), [leads, sortKey, sortDir])

  const allVisibleSelected = sorted.length > 0 && sorted.every((l) => selectedIds.has(l.id))

  const onSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  if (!leads.length) return null

  return (
    <div
      className={`pipeline-hs-table-wrap pipeline-hs-table-wrap--v2 pipeline-hs-table-wrap--premium${
        showHoverActions ? '' : ' pipeline-hs-table-wrap--no-hover-actions'
      }`}
    >
      <table className="pipeline-hs-table">
        <thead>
          <tr>
            <th className="pipeline-hs-th-check" scope="col">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={(e) => onSelectAllVisible?.(e.target.checked, sorted.map((l) => l.id))}
                aria-label="Select all visible leads"
                className="pipeline-hs-checkbox"
              />
            </th>
            {orderedColumns.map((colId) =>
              renderPipelineHeader(colId, {
                sortKey,
                sortDir,
                onSort,
                statusOptions,
                tagOptions,
                columnFilters,
                onColumnFilterChange,
              })
            )}
            <th scope="col" className="pipeline-hs-th pipeline-hs-th--actions" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((lead) => {
            const meta = getStatusMeta(lead.crm?.status, { freightOrg, pipelineTrack })
            const isActive = selectedId === lead.id
            const isChecked = selectedIds.has(lead.id)
            const email = getLeadEmail(lead)
            const city = getLeadCity(lead)
            const state = getLeadState(lead)
            const ownerName = resolveOwnerName(lead, teamMembers)
            const { at: activityAt, type: activityType } = lastActivityMeta(lead)
            const rel = relativeLabel(activityAt)
            const stale =
              activityAt && Date.now() - new Date(activityAt).getTime() > 7 * 86400000
            const tags = resolveLeadTags(lead, tagById)
            const nameStr = displayName(lead)

            return (
              <tr
                key={lead.id}
                className={`pipeline-hs-row pipeline-hs-row--v2 ${isActive ? 'is-active' : ''} ${
                  isChecked ? 'is-checked' : ''
                }`}
              >
                <td className="pipeline-hs-td-check">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => onToggleSelect(lead.id, e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select ${nameStr}`}
                    className="pipeline-hs-checkbox"
                  />
                </td>
                {orderedColumns.map((colId) =>
                  renderPipelineCell(colId, lead, {
                    meta,
                    email,
                    city,
                    state,
                    ownerName,
                    activityAt,
                    activityType,
                    rel,
                    stale,
                    tags,
                    nameStr,
                    showHoverActions,
                    onSelect,
                    onQuickCall,
                    onQuickEmail,
                    onQuickTask,
                    onQuickWhatsApp,
                    onStatusChange,
                    onOwnerFilter,
                    canFilterByOwner,
                    statusOptions,
                    canAssign,
                    onDeleteLead,
                    onChangeOwner,
                    onChangeStatus,
                    onOpenCompany,
                    canOpenCompany,
                  })
                )}
                <td className="pipeline-hs-td pipeline-hs-td--actions">
                  <PipelineRowActionsMenu
                    lead={lead}
                    leadName={displayName(lead)}
                    canAssign={canAssign}
                    onOpen={() => onSelect(lead.id)}
                    onLogCall={() => onQuickCall?.(lead)}
                    onSendEmail={() => onQuickEmail?.(lead)}
                    onAddTask={() => onQuickTask?.(lead)}
                    onChangeStatus={() => onChangeStatus?.(lead)}
                    onChangeOwner={() => onChangeOwner?.(lead)}
                    onDelete={onDeleteLead ? () => onDeleteLead(lead) : undefined}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
