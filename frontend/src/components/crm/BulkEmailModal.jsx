import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../lib/api'
import { leadHasSendableEmail } from '../../lib/emailUtils'
import BulkEmailCompose from './BulkEmailCompose'

export default function BulkEmailModal({ open, leadIds, leads, onClose, onDone }) {
  const leadIdsKey = [...(leadIds || [])].sort().join(',')
  const fallbackLeadsRef = useRef(leads)
  fallbackLeadsRef.current = leads

  const [resolvedLeads, setResolvedLeads] = useState([])
  const [sendableIds, setSendableIds] = useState([])
  const [skipped, setSkipped] = useState([])
  const [resolving, setResolving] = useState(false)
  const [resolveError, setResolveError] = useState(null)
  const fetchedKeyRef = useRef('')

  useEffect(() => {
    if (!open) {
      fetchedKeyRef.current = ''
      return undefined
    }

    const ids = leadIdsKey ? leadIdsKey.split(',') : []
    if (!ids.length) {
      setResolvedLeads([])
      setSendableIds([])
      setSkipped([])
      setResolveError(null)
      setResolving(false)
      return undefined
    }

    if (fetchedKeyRef.current === leadIdsKey) {
      return undefined
    }

    let cancelled = false
    setResolving(true)
    setResolveError(null)

    api
      .resolveBulkEmailRecipients(ids)
      .then((data) => {
        if (cancelled) return
        fetchedKeyRef.current = leadIdsKey
        setResolvedLeads(data.leads || [])
        setSendableIds(data.sendableIds || [])
        setSkipped(data.skipped || [])
      })
      .catch((e) => {
        if (cancelled) return
        fetchedKeyRef.current = leadIdsKey
        setResolveError(e.message)
        const fallback = (fallbackLeadsRef.current || []).filter((l) => ids.includes(l.id))
        setResolvedLeads(fallback)
        setSendableIds(fallback.filter(leadHasSendableEmail).map((l) => l.id))
        setSkipped(
          ids
            .filter((id) => !fallback.some((l) => l.id === id))
            .map((leadId) => ({ leadId, reason: 'not_loaded' }))
        )
      })
      .finally(() => {
        if (!cancelled) setResolving(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, leadIdsKey])

  const composeLeads = useMemo(() => {
    const idSet = new Set(sendableIds)
    return resolvedLeads.filter((l) => idSet.has(l.id))
  }, [resolvedLeads, sendableIds])

  if (!open) return null

  const noEmail = skipped.filter((s) => s.reason === 'no_email').length
  const notFound = skipped.filter((s) => s.reason === 'not_in_pipeline' || s.reason === 'not_loaded').length
  const showLoading = resolving && fetchedKeyRef.current !== leadIdsKey

  return (
    <div
      className="crm-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-email-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="crm-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <header className="crm-modal-header">
          <h2 id="bulk-email-title">Bulk email ({leadIds.length} selected)</h2>
          <button type="button" onClick={onClose} className="crm-modal-close" aria-label="Close">
            ×
          </button>
        </header>
        <div className="crm-modal-body-fill">
          {showLoading ? (
            <p className="px-5 py-4 text-sm text-[#516f90]">Loading recipients from pipeline…</p>
          ) : (
            <>
              {resolveError && (
                <p className="px-5 pt-4 text-xs text-amber-800 bg-amber-50 mx-5 mt-4 rounded-lg px-2 py-1.5">
                  Could not refresh all recipients ({resolveError}). Counts may be incomplete.
                </p>
              )}
              {(noEmail > 0 || notFound > 0) && (
                <p className="px-5 pt-3 text-xs text-[#516f90]">
                  {sendableIds.length} ready to send
                  {noEmail > 0 ? ` · ${noEmail} without sendable email` : ''}
                  {notFound > 0 ? ` · ${notFound} not found in pipeline` : ''}
                </p>
              )}
              <BulkEmailCompose
                key={leadIdsKey}
                leadIds={sendableIds}
                leads={composeLeads}
                skippedCount={skipped.length}
                onDone={onDone}
                onRequestClose={onClose}
                compact
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
