import { useMemo, useState } from 'react'
import { formatCrmDate, getStatusMeta } from '../../lib/crmConstants'
import { formatDateTime } from '../../lib/crmUiConstants'
import { getLeadCity, getLeadState } from '../../lib/pipelineFilters'
import { leadHasSendableEmail } from '../../lib/emailUtils'
import { leadHasCallablePhone } from '../../lib/phoneUtils'
import useIsMobile from '../../hooks/useIsMobile'
import LeadTagDots from './LeadTagDots'
import LeadPhoneCall from './LeadPhoneCall'

function displayName(lead) {
  const n = [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim()
  return n || lead.company || 'Unnamed lead'
}

function resolveOwnerName(lead, teamMembers) {
  const id = lead.assignedToUserId
  if (!id) return 'No owner'
  const m = (teamMembers || []).find((t) => t.userId === id)
  return m?.name || 'Team member'
}

function oneLine(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function lastEmailPreview(lead) {
  const emails = lead.crm?.emails
  if (Array.isArray(emails) && emails.length) {
    const last = emails[emails.length - 1]
    const at = last.sentAt || last.createdAt || lead.crm?.lastEmailSentAt
    const text = oneLine(last.subject || last.subjectLine || last.snippet || last.body)
    if (text || at) return { at, text: text || 'Email sent' }
  }
  const at = lead.crm?.lastEmailSentAt
  if (!at && !lead.crm?.lastEmailSubject) return null
  const text =
    oneLine(lead.crm?.lastEmailSubject) ||
    oneLine(lead.crm?.lastCommunicationSummary) ||
    (at ? 'Email sent' : '')
  if (!text && !at) return null
  return { at: at || null, text: text || 'Email sent' }
}

function lastActivityIso(lead) {
  return (
    lead.crm?.lastCommunicationAt ||
    lead.crm?.lastResponseAt ||
    lead.crm?.lastEmailSentAt ||
    lead.crm?.nextFollowUpAt ||
    null
  )
}

function createdIso(lead) {
  return lead.savedAt || lead.createdAt || lead.crm?.createdAt || null
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
      case 'email':
        av = (a.email || '').toLowerCase()
        bv = (b.email || '').toLowerCase()
        break
      case 'company':
        av = (a.company || '').toLowerCase()
        bv = (b.company || '').toLowerCase()
        break
      case 'activity':
        av = lastActivityIso(a) || ''
        bv = lastActivityIso(b) || ''
        break
      case 'created':
        av = createdIso(a) || ''
        bv = createdIso(b) || ''
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
        <span className="pipeline-hs-sort-icon" aria-hidden>
          {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  )
}

function DateCell({ iso }) {
  if (!iso) return <span className="pipeline-hs-muted">--</span>
  const full = formatDateTime(iso)
  const short = formatCrmDate(iso)
  return (
    <span className="pipeline-hs-date" title={full}>
      {short}
    </span>
  )
}

export default function PipelineLeadsTable({
  leads,
  selectedId,
  selectedIds,
  onSelect,
  onToggleSelect,
  onSelectAllVisible,
  showStatus = true,
  tagById,
  teamMembers = [],
}) {
  const isMobile = useIsMobile()
  const [sortKey, setSortKey] = useState('created')
  const [sortDir, setSortDir] = useState('desc')

  const sorted = useMemo(
    () => sortLeads(leads, sortKey, sortDir),
    [leads, sortKey, sortDir]
  )

  const allVisibleSelected =
    sorted.length > 0 && sorted.every((l) => selectedIds.has(l.id))

  const onSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  if (!leads.length) return null

  return (
    <div className="pipeline-hs-table-wrap">
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
            <SortHeader label="Name" sortKey="name" activeKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortHeader
              label="Email"
              sortKey="email"
              activeKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              className="pipeline-hs-th pipeline-hs-th--email"
            />
            <th scope="col" className="pipeline-hs-th">
              Phone number
            </th>
            <th scope="col" className="pipeline-hs-th pipeline-hs-th--owner">
              Lead owner
            </th>
            <th scope="col" className="pipeline-hs-th pipeline-hs-th--last-email">
              Last email
            </th>
            <th scope="col" className="pipeline-hs-th pipeline-hs-th--notes">
              Notes
            </th>
            <SortHeader
              label="Primary company"
              sortKey="company"
              activeKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
            />
            {showStatus && (
              <th scope="col" className="pipeline-hs-th">
                Lead status
              </th>
            )}
            <SortHeader
              label="Last activity date"
              sortKey="activity"
              activeKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
            />
            <SortHeader
              label="Create date"
              sortKey="created"
              activeKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              className="pipeline-hs-th pipeline-hs-th--sort-active"
            />
          </tr>
        </thead>
        <tbody>
          {sorted.map((lead) => {
            const meta = getStatusMeta(lead.crm?.status)
            const isActive = selectedId === lead.id
            const isChecked = selectedIds.has(lead.id)
            const email = leadHasSendableEmail(lead) ? lead.email : null
            const loc = [getLeadCity(lead), getLeadState(lead)].filter(Boolean).join(', ')
            const lastEmail = lastEmailPreview(lead)
            const notesText = oneLine(lead.crm?.notes)

            return (
              <tr
                key={lead.id}
                className={`pipeline-hs-row ${isActive ? 'is-active' : ''} ${
                  isChecked ? 'is-checked' : ''
                }`}
              >
                <td className="pipeline-hs-td-check">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => onToggleSelect(lead.id, e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select ${displayName(lead)}`}
                    className="pipeline-hs-checkbox"
                  />
                </td>
                <td className="pipeline-hs-td">
                  <button
                    type="button"
                    className="pipeline-hs-name-btn"
                    onClick={() => onSelect(lead.id)}
                  >
                    <span className="pipeline-hs-avatar" aria-hidden>
                      {(lead.firstName?.[0] || lead.company?.[0] || '?').toUpperCase()}
                    </span>
                    <span className="pipeline-hs-primary-text">{displayName(lead)}</span>
                    {isMobile && leadHasCallablePhone(lead.phone) ? (
                      <LeadPhoneCall
                        phone={lead.phone}
                        leadId={lead.id}
                        iconOnly
                        className="pipeline-hs-name-call"
                      />
                    ) : null}
                  </button>
                  {loc && <span className="pipeline-hs-sub">{loc}</span>}
                  <LeadTagDots lead={lead} tagById={tagById} className="pipeline-hs-tags" max={6} />
                </td>
                <td className="pipeline-hs-td pipeline-hs-td--email">
                  {email ? (
                    <a
                      href={`mailto:${encodeURIComponent(email)}`}
                      className="pipeline-hs-primary-text pipeline-hs-cell-text"
                      onClick={(e) => e.stopPropagation()}
                      title={email}
                    >
                      {email}
                      <span className="pipeline-hs-ext" aria-hidden>
                        ↗
                      </span>
                    </a>
                  ) : (
                    <span className="pipeline-hs-muted">--</span>
                  )}
                </td>
                <td className="pipeline-hs-td pipeline-hs-td--phone">
                  {lead.phone ? (
                    <LeadPhoneCall
                      phone={lead.phone}
                      leadId={lead.id}
                      numberClassName="pipeline-hs-cell-text"
                    />
                  ) : (
                    <span className="pipeline-hs-muted">--</span>
                  )}
                </td>
                <td className="pipeline-hs-td pipeline-hs-td--owner">
                  <span
                    className={`pipeline-hs-cell-text ${lead.assignedToUserId ? '' : 'pipeline-hs-muted'}`}
                    title={resolveOwnerName(lead, teamMembers)}
                  >
                    {resolveOwnerName(lead, teamMembers)}
                  </span>
                </td>
                <td className="pipeline-hs-td pipeline-hs-td--last-email">
                  {lastEmail ? (
                    <span
                      className="pipeline-hs-cell-text"
                      title={`${lastEmail.text}${lastEmail.at ? ` · ${formatDateTime(lastEmail.at)}` : ''}`}
                    >
                      <span className="pipeline-hs-last-email-text">{lastEmail.text}</span>
                      {lastEmail.at && (
                        <span className="pipeline-hs-last-email-date">
                          {formatCrmDate(lastEmail.at)}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="pipeline-hs-muted">--</span>
                  )}
                </td>
                <td className="pipeline-hs-td pipeline-hs-td--notes">
                  {notesText ? (
                    <span className="pipeline-hs-cell-text pipeline-hs-notes" title={notesText}>
                      {notesText}
                    </span>
                  ) : (
                    <span className="pipeline-hs-muted">--</span>
                  )}
                </td>
                <td className="pipeline-hs-td">
                  {lead.company ? (
                    <button
                      type="button"
                      className="pipeline-hs-company-btn"
                      onClick={() => onSelect(lead.id)}
                    >
                      <span className="pipeline-hs-avatar pipeline-hs-avatar--co" aria-hidden>
                        {lead.company[0]?.toUpperCase() || 'C'}
                      </span>
                      <span className="pipeline-hs-primary-text">{lead.company}</span>
                    </button>
                  ) : (
                    <span className="pipeline-hs-muted">--</span>
                  )}
                </td>
                {showStatus && (
                  <td className="pipeline-hs-td">
                    <span className={`pipeline-hs-status ${meta.color}`}>{meta.label}</span>
                  </td>
                )}
                <td className="pipeline-hs-td">
                  <DateCell iso={lastActivityIso(lead)} />
                </td>
                <td className="pipeline-hs-td">
                  <DateCell iso={createdIso(lead)} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
