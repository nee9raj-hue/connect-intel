import { useMemo } from 'react'
import { bulkEmailSkipReasonLabel, leadDisplayName } from '../../lib/emailUtils'

function resolveLead(leadId, resolvedLeads, pool) {
  return (
    resolvedLeads.find((l) => String(l.id) === String(leadId)) ||
    pool.find((l) => String(l.id) === String(leadId)) ||
    null
  )
}

export default function BulkEmailSkipReport({ skipped = [], resolvedLeads = [], pool = [] }) {
  const groups = useMemo(() => {
    const byReason = new Map()
    for (const row of skipped) {
      const reason = row.reason || 'unknown'
      if (!byReason.has(reason)) byReason.set(reason, [])
      const lead = resolveLead(row.leadId, resolvedLeads, pool)
      byReason.get(reason).push({
        id: row.leadId,
        name: lead ? leadDisplayName(lead) : 'Unknown contact',
        email: lead?.email || '',
      })
    }
    return [...byReason.entries()].map(([reason, leads]) => ({ reason, leads }))
  }, [skipped, resolvedLeads, pool])

  if (!groups.length) return null

  return (
    <div className="mx-5 mt-4 mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-950">
      <p className="font-medium mb-2">Excluded from this send</p>
      <ul className="space-y-2 mb-0 pl-0 list-none">
        {groups.map(({ reason, leads }) => (
          <li key={reason}>
            <span className="font-medium">{bulkEmailSkipReasonLabel(reason)}</span>
            <span className="text-amber-800"> ({leads.length})</span>
            <ul className="mt-1 pl-3 list-disc text-amber-900">
              {leads.slice(0, 8).map((lead) => (
                <li key={lead.id}>
                  {lead.name}
                  {lead.email ? ` · ${lead.email}` : ''}
                </li>
              ))}
              {leads.length > 8 ? <li>…and {leads.length - 8} more</li> : null}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  )
}
