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

export function SaveFilterAudienceModal({ open, filterSummary, filterJson, onClose, onCreated }) {
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
      const data = await api.createAudienceFromFilter({
        name: name.trim(),
        filterJson,
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
        title="Save filter as audience"
        message="For better tracking and deliverability, use Marketing Hub. Your current pipeline filters become a dynamic audience that refreshes automatically."
        hint={filterSummary || 'Pipeline filters applied'}
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
            placeholder="e.g. Mumbai Follow Ups, Hot Leads"
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

export function CreateBatchListsModal({ open, count, leadIds, emailCount, onClose, onCreated, onViewLists }) {
  const [namePrefix, setNamePrefix] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  if (!open) return null

  const eligible = emailCount != null ? emailCount : count
  const batchCount = Math.ceil(eligible / 200) || 0

  const submit = async () => {
    if (!namePrefix.trim()) {
      setError('Give your lists a name')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const data = await api.createMarketingListBatchesFromSelection({
        namePrefix: namePrefix.trim(),
        leadIds,
        channel: 'email',
        batchSize: 200,
      })
      onCreated?.(data)
      setNamePrefix('')
    } catch (e) {
      setError(e.message || 'Could not create lists')
    } finally {
      setBusy(false)
    }
  }

  return (
    <GuidanceModal open onClose={busy ? undefined : onClose}>
      <GuidanceCard
        icon="◎"
        title="Create static lists"
        message="Split your selection into static lists of up to 200 contacts each. Campaigns use these exact contacts — no full-database scan."
        hint={`${eligible.toLocaleString()} emailable contact${eligible === 1 ? '' : 's'} → ${batchCount} list${batchCount === 1 ? '' : 's'}`}
        primaryLabel={busy ? 'Creating…' : `Create ${batchCount} list${batchCount === 1 ? '' : 's'}`}
        onPrimary={busy ? undefined : submit}
        secondaryLabel="Cancel"
        onSecondary={busy ? undefined : onClose}
      />
      <div className="ci-create-audience-form">
        <label className="ci-create-audience-form__label">
          List name prefix
          <input
            type="text"
            value={namePrefix}
            disabled={busy}
            placeholder="e.g. Mumbai Exporters, June Follow Up"
            onChange={(e) => setNamePrefix(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            className="ci-create-audience-form__input"
          />
        </label>
        <p className="ci-create-audience-form__hint mhub-hint">
          Lists are named “{namePrefix.trim() || 'Your prefix'} — 01”, “— 02”, and so on. Delete any list anytime in Marketing Hub → Static lists.
        </p>
        {error ? <p className="ci-create-audience-form__error">{error}</p> : null}
      </div>
    </GuidanceModal>
  )
}

export function BatchListsCreatedModal({ open, result, onViewLists, onLaunchCampaign, onClose }) {
  if (!open || !result) return null
  const lists = result.lists || []
  return (
    <GuidanceModal open onClose={onClose}>
      <GuidanceCard
        icon="✓"
        title="Static lists created"
        message={`${result.batchCount || lists.length} list(s) ready with ${(result.totalLeads || 0).toLocaleString()} contacts (${result.batchSize || 200} max per list).`}
        hint="Each list is frozen at creation — campaigns send only to those contacts."
        primaryLabel="Launch campaign"
        onPrimary={() => onLaunchCampaign?.(lists[0]?.id)}
        secondaryLabel="View lists"
        onSecondary={onViewLists}
      />
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
