import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { leadHasSendableEmail } from '../../lib/emailUtils'
import { evaluatePipelineEmail } from '../../lib/resourceProtection.js'
import { useUsagePolicies } from '../../hooks/useUsagePolicies.js'
import LostLeadsEmailGuard from '../guardrails/LostLeadsEmailGuard.jsx'
import { PipelineEmailGuideModal } from '../guardrails/ResourceProtectionModals.jsx'
import BulkEmailCompose from './BulkEmailCompose'

export default function BulkEmailModal({ open, leadIds, leads, onClose, onDone, onNavigate }) {
  const { user } = useApp()
  const policies = useUsagePolicies()
  const leadIdsKey = [...(leadIds || [])].sort().join(',')
  const fallbackLeadsRef = useRef(leads)
  fallbackLeadsRef.current = leads

  const [resolvedLeads, setResolvedLeads] = useState([])
  const [sendableIds, setSendableIds] = useState([])
  const [skipped, setSkipped] = useState([])
  const [resolving, setResolving] = useState(false)
  const [resolveError, setResolveError] = useState(null)
  const [lostGuardOpen, setLostGuardOpen] = useState(false)
  const [excludedLost, setExcludedLost] = useState(false)
  const [emailGuide, setEmailGuide] = useState({ open: false, variant: 'guide_marketing' })
  const fetchedKeyRef = useRef('')
  const lostCheckKeyRef = useRef('')

  useEffect(() => {
    if (!open) {
      fetchedKeyRef.current = ''
      lostCheckKeyRef.current = ''
      setExcludedLost(false)
      setLostGuardOpen(false)
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

    const emailVerdict = evaluatePipelineEmail(ids.length, user, policies)
    if (emailVerdict !== 'allow') {
      setEmailGuide({ open: true, variant: emailVerdict })
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
        const friendly =
          e?.code === 'GUIDE_MARKETING_HUB' || e?.code === 'LARGE_AUDIENCE_MARKETING'
            ? null
            : e.message
        setResolveError(friendly)
        if (e?.code === 'GUIDE_MARKETING_HUB') {
          setEmailGuide({ open: true, variant: 'guide_marketing' })
          return
        }
        if (e?.code === 'LARGE_AUDIENCE_MARKETING') {
          setEmailGuide({ open: true, variant: 'block_large' })
          return
        }
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
  }, [open, leadIdsKey, user, policies])

  const lostLeadIds = useMemo(() => {
    const pool = resolvedLeads.length ? resolvedLeads : leads || []
    const ids = []
    for (const lead of pool) {
      const status = String(lead?.crm?.status || lead?.status || '').toLowerCase()
      if (['lost', 'closed_lost', 'disqualified'].includes(status)) ids.push(lead.id)
    }
    return ids
  }, [resolvedLeads, leads])

  useEffect(() => {
    if (!open || resolving || emailGuide.open) return
    if (!sendableIds.length && !resolvedLeads.length) return
    if (excludedLost || lostCheckKeyRef.current === leadIdsKey) return
    if (lostLeadIds.length > 0) {
      lostCheckKeyRef.current = leadIdsKey
      setLostGuardOpen(true)
    }
  }, [open, resolving, emailGuide.open, sendableIds.length, resolvedLeads.length, excludedLost, lostLeadIds, leadIdsKey])

  const activeSendableIds = useMemo(() => {
    if (!excludedLost || !lostLeadIds.length) return sendableIds
    const lost = new Set(lostLeadIds)
    return sendableIds.filter((id) => !lost.has(id))
  }, [sendableIds, excludedLost, lostLeadIds])

  const composeLeads = useMemo(() => {
    const idSet = new Set(activeSendableIds)
    return resolvedLeads.filter((l) => idSet.has(l.id))
  }, [resolvedLeads, activeSendableIds])

  const goCreateAudience = () => {
    setEmailGuide({ open: false })
    onClose?.()
    onNavigate?.('marketing', { tab: 'audiences', audienceTab: 'lists', createFromPipeline: true })
  }

  if (!open) return null

  const noEmail = skipped.filter((s) => s.reason === 'no_email').length
  const notFound = skipped.filter((s) => s.reason === 'not_in_pipeline' || s.reason === 'not_loaded').length
  const showLoading = resolving && fetchedKeyRef.current !== leadIdsKey
  const showCompose = !emailGuide.open && !lostGuardOpen && activeSendableIds.length > 0

  return (
    <>
      <PipelineEmailGuideModal
        open={emailGuide.open}
        variant={emailGuide.variant}
        onCreateAudience={goCreateAudience}
        onClose={() => {
          setEmailGuide({ open: false })
          onClose?.()
        }}
      />
      <LostLeadsEmailGuard
        open={lostGuardOpen}
        lostCount={lostLeadIds.length}
        onExclude={() => {
          setExcludedLost(true)
          setLostGuardOpen(false)
        }}
        onIncludeAll={() => {
          setExcludedLost(false)
          setLostGuardOpen(false)
        }}
        onReview={() => {
          setLostGuardOpen(false)
          onClose?.()
        }}
        onClose={() => {
          setLostGuardOpen(false)
          onClose?.()
        }}
      />
      {!emailGuide.open && (
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
              ) : lostGuardOpen ? (
                <p className="px-5 py-4 text-sm text-[#516f90]">Review your audience…</p>
              ) : !showCompose ? (
                <p className="px-5 py-4 text-sm text-[#516f90]">
                  No sendable recipients in this selection. Add email addresses or adjust your selection.
                </p>
              ) : (
                <>
                  {resolveError && (
                    <p className="px-5 pt-4 text-xs text-[#516f90] mx-5 mt-4 rounded-lg px-2 py-1.5">
                      Some recipient details could not be refreshed. Counts may be incomplete.
                    </p>
                  )}
                  {(noEmail > 0 || notFound > 0 || excludedLost) && (
                    <p className="px-5 pt-3 text-xs text-[#516f90]">
                      {activeSendableIds.length} ready to send
                      {excludedLost && lostLeadIds.length > 0
                        ? ` · ${lostLeadIds.length} lost excluded`
                        : ''}
                      {noEmail > 0 ? ` · ${noEmail} without sendable email` : ''}
                      {notFound > 0 ? ` · ${notFound} not found in pipeline` : ''}
                    </p>
                  )}
                  <BulkEmailCompose
                    key={`${leadIdsKey}-${excludedLost}`}
                    leadIds={activeSendableIds}
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
      )}
    </>
  )
}
