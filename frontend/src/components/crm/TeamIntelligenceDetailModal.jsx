import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/crmUiConstants'
import { isFreightDealOrg } from '../../lib/freightDeal'
import { resolveTeamIntelDetail } from '../../lib/teamIntelActivityDetail'
import { timelineTypeLabel } from '../../lib/teamIntelligenceConstants'

function DetailSection({ section }) {
  if (!section) return null
  if (section.plainText) {
    return (
      <section className="team-intel-detail-modal__section">
        <h3 className="team-intel-detail-modal__section-title">{section.title}</h3>
        <pre className="team-intel-detail-modal__pre">{section.plainText}</pre>
      </section>
    )
  }
  return (
    <section className="team-intel-detail-modal__section">
      <h3 className="team-intel-detail-modal__section-title">{section.title}</h3>
      <dl className="team-intel-detail-modal__dl">
        {section.rows.map((r) => (
          <div key={`${section.title}-${r.label}`} className="team-intel-detail-modal__row">
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export default function TeamIntelligenceDetailModal({
  item,
  user,
  onClose,
  onOpenInCrm,
}) {
  const [entry, setEntry] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const freightOrg = isFreightDealOrg(user)

  useEffect(() => {
    if (!item?.leadId) {
      setEntry(null)
      setError(null)
      return undefined
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .getPipelineLead(item.leadId, { silent: true })
      .then((res) => {
        if (!cancelled) setEntry(res)
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || 'Could not load lead details')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [item?.leadId, item?.id])

  const detail = useMemo(() => {
    if (!item) return null
    if (!item.leadId) {
      return {
        sections: [
          {
            title: 'Activity',
            rows: [
              { label: 'Event', value: timelineTypeLabel(item.type) },
              { label: 'When', value: formatDateTime(item.at) },
              { label: 'Summary', value: item.body || item.title },
              { label: 'Rep', value: item.actorName },
            ].filter((r) => r.value),
          },
        ],
        typeLabel: timelineTypeLabel(item.type),
        lead: null,
        leadTab: 'notes',
      }
    }
    if (!entry) return null
    return resolveTeamIntelDetail(entry, item, { user, freightOrg })
  }, [item, entry, user, freightOrg])

  if (!item) return null

  const title = detail?.typeLabel || timelineTypeLabel(item.type)
  const leadName = detail?.lead
    ? [detail.lead.firstName, detail.lead.lastName].filter(Boolean).join(' ') ||
      detail.lead.company ||
      'Lead'
    : item.title

  return (
    <div
      className="crm-modal-overlay team-intel-detail-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div className="crm-modal-dialog team-intel-detail-modal" onClick={(e) => e.stopPropagation()}>
        <header className="crm-modal-header">
          <div>
            <p className="team-intel-detail-modal__eyebrow">{formatDateTime(item.at)}</p>
            <h2>{title}</h2>
            <p className="team-intel-detail-modal__subtitle">
              {leadName}
              {item.company && item.company !== leadName ? ` · ${item.company}` : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} className="crm-modal-close" aria-label="Close">
            ×
          </button>
        </header>

        <div className="crm-modal-body crm-modal-body-padded team-intel-detail-modal__body">
          {loading ? (
            <p className="text-sm text-[#647185]" role="status">
              Loading full details…
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl px-3 py-2 font-medium">
              {error}
            </p>
          ) : null}
          {!loading && detail?.sections?.length
            ? detail.sections.map((section) => <DetailSection key={section.title} section={section} />)
            : null}
          {!loading && !detail?.sections?.length && !error ? (
            <p className="text-sm text-[#647185]">No additional details available.</p>
          ) : null}
        </div>

        <footer className="crm-modal-footer team-intel-detail-modal__footer">
          <button type="button" className="crm-btn crm-btn-secondary" onClick={onClose}>
            Close
          </button>
          {item.leadId ? (
            <button
              type="button"
              className="crm-btn crm-btn-primary"
              onClick={() => onOpenInCrm?.(item, detail?.leadTab)}
            >
              Open in CRM
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  )
}
