import { useState } from 'react'
import { api } from '../../lib/api'
import GuidanceCard, { GuidanceModal } from '../guardrails/GuidanceCard.jsx'

export default function SaveReportModal({
  open,
  filterSummary,
  serverFilters,
  advancedFilters,
  canShareOrg = false,
  onClose,
  onSaved,
}) {
  const [name, setName] = useState('')
  const [scope, setScope] = useState('personal')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  if (!open) return null

  const submit = async () => {
    if (!name.trim()) {
      setError('Give your report a name')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const data = await api.saveReportDefinition({
        name: name.trim(),
        scope: canShareOrg && scope === 'org' ? 'org' : 'personal',
        serverFilters,
        advancedFilters,
      })
      onSaved?.(data.report)
      setName('')
      setScope('personal')
    } catch (e) {
      setError(e.message || 'Could not save report')
    } finally {
      setBusy(false)
    }
  }

  return (
    <GuidanceModal open onClose={busy ? undefined : onClose}>
      <GuidanceCard
        icon="↓"
        title="Save as report"
        message="Save your current pipeline filters as a reusable export. Run it anytime to download a full CSV from the server — not just loaded rows."
        hint={filterSummary || 'Pipeline filters applied'}
        primaryLabel={busy ? 'Saving…' : 'Save report'}
        onPrimary={busy ? undefined : submit}
        secondaryLabel="Cancel"
        onSecondary={busy ? undefined : onClose}
      />
      <div className="ci-create-audience-form">
        <label className="ci-create-audience-form__label">
          Report name
          <input
            type="text"
            value={name}
            disabled={busy}
            placeholder="e.g. Mumbai hot leads weekly"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            className="ci-create-audience-form__input"
          />
        </label>
        {canShareOrg ? (
          <label className="ci-create-audience-form__label">
            Visibility
            <select
              value={scope}
              disabled={busy}
              onChange={(e) => setScope(e.target.value)}
              className="ci-create-audience-form__input"
            >
              <option value="personal">Only me</option>
              <option value="org">Team (org-wide)</option>
            </select>
          </label>
        ) : null}
        {error ? <p className="ci-create-audience-form__error">{error}</p> : null}
      </div>
    </GuidanceModal>
  )
}
