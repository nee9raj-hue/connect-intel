import { useState } from 'react'
import { api } from '../../lib/api'
import GuidanceCard, { GuidanceModal } from './GuidanceCard.jsx'

export function CreateAudienceModal({ open, count, leadIds, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  if (!open) return null

  const submit = async () => {
    if (!name.trim()) {
      setError('Give your audience a name')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const data = await api.createAudienceFromLeads({
        name: name.trim(),
        leadIds,
        channel: 'email',
      })
      onCreated?.(data)
      setName('')
    } catch (e) {
      setError(e.message || 'Could not create audience')
    } finally {
      setBusy(false)
    }
  }

  return (
    <GuidanceModal open onClose={busy ? undefined : onClose}>
      <GuidanceCard
        icon="◎"
        title="Save as audience"
        message="Turn this pipeline selection into a reusable audience — then launch a campaign when you're ready."
        hint={`${count.toLocaleString()} contact${count === 1 ? '' : 's'} selected`}
        primaryLabel={busy ? 'Saving…' : 'Create audience'}
        onPrimary={busy ? undefined : submit}
        secondaryLabel="Cancel"
        onSecondary={busy ? undefined : onClose}
      />
      <div className="ci-create-audience-form">
        <label className="ci-create-audience-form__label">
          Audience name
          <input
            type="text"
            value={name}
            disabled={busy}
            placeholder="e.g. USA Exporters, Follow Up Prospects"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            className="ci-create-audience-form__input"
          />
        </label>
        {error ? <p className="ci-create-audience-form__error">{error}</p> : null}
      </div>
    </GuidanceModal>
  )
}

export function AudienceCreatedModal({ open, audience, onLaunchCampaign, onClose }) {
  if (!open || !audience) return null
  const count = audience.contactCount ?? audience.list?.leadIds?.length ?? 0
  return (
    <GuidanceModal open onClose={onClose}>
      <GuidanceCard
        icon="✓"
        title="Audience created successfully"
        message={`${audience.name || 'Your audience'} is ready with ${count.toLocaleString()} contacts.`}
        hint="Launch a campaign to reach them with tracking, deliverability, and reporting built in."
        primaryLabel="Launch campaign"
        onPrimary={onLaunchCampaign}
        secondaryLabel="Done"
        onSecondary={onClose}
      />
    </GuidanceModal>
  )
}
