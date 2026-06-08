import { useEffect, useMemo, useState } from 'react'
import { CRM_STATUSES } from '../../lib/crmConstants'
import { CONTACT_FILTER_OPTIONS } from '../../lib/pipelineFilters'
import { SEGMENT_FILTER_DEFAULTS } from '../../../../lib/marketingSegmentFilters.js'
import { api } from '../../lib/api'

export default function MarketingSegmentBuilder({
  user,
  teamMembers,
  campaigns = [],
  onSaved,
  onCancel,
  busy,
  setBusy,
  setError,
  setNotice,
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [channel, setChannel] = useState('email')
  const [filters, setFilters] = useState({ ...SEGMENT_FILTER_DEFAULTS })
  const [preview, setPreview] = useState(null)
  const [previewing, setPreviewing] = useState(false)

  const isCompanyAdmin = Boolean(user?.isOrgAdmin)

  const campaignOptions = useMemo(
    () => campaigns.filter((c) => (c.channel || 'email') === channel),
    [campaigns, channel]
  )

  const runPreview = async () => {
    setPreviewing(true)
    setError?.(null)
    try {
      const res = await api.previewMarketingSegment(filters)
      setPreview(res)
    } catch (e) {
      setError?.(e.message)
    } finally {
      setPreviewing(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      runPreview().catch(() => {})
    }, 400)
    return () => clearTimeout(t)
  }, [filters, channel])

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!name.trim()) return setError?.('Segment name is required')
    setBusy?.(true)
    setError?.(null)
    try {
      await api.createMarketingSegment({
        name: name.trim(),
        description,
        channel,
        type: 'dynamic',
        filterJson: filters,
      })
      setNotice?.('Segment saved')
      onSaved?.()
    } catch (e) {
      setError?.(e.message)
    } finally {
      setBusy?.(false)
    }
  }

  return (
    <div className="marketing-segment-builder space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Segment name"
          className="ci-input w-full"
        />
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          className="ci-input w-full"
        >
          <option value="email">Email audience</option>
          <option value="whatsapp">WhatsApp audience</option>
        </select>
      </div>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="ci-input w-full min-h-[4rem]"
      />

      <div className="marketing-segment-filters grid sm:grid-cols-2 gap-3">
        <label className="block text-xs">
          <span className="text-gray-600">Pipeline stage</span>
          <select
            value={filters.status}
            onChange={(e) => updateFilter('status', e.target.value)}
            className="ci-input w-full mt-1"
          >
            <option value="all">All stages</option>
            {CRM_STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        {isCompanyAdmin && (
          <label className="block text-xs">
            <span className="text-gray-600">Assignee</span>
            <select
              value={filters.assigneeUserId}
              onChange={(e) => updateFilter('assigneeUserId', e.target.value)}
              className="ci-input w-full mt-1"
            >
              <option value="">Anyone</option>
              {(teamMembers || []).map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block text-xs">
          <span className="text-gray-600">Contact filter</span>
          <select
            value={filters.contact}
            onChange={(e) => updateFilter('contact', e.target.value)}
            className="ci-input w-full mt-1"
          >
            {CONTACT_FILTER_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs">
          <span className="text-gray-600">Country contains</span>
          <input
            value={filters.country}
            onChange={(e) => updateFilter('country', e.target.value)}
            className="ci-input w-full mt-1"
            placeholder="e.g. India"
          />
        </label>

        <label className="block text-xs">
          <span className="text-gray-600">Opened campaign</span>
          <select
            value={filters.openedCampaignId}
            onChange={(e) => updateFilter('openedCampaignId', e.target.value)}
            className="ci-input w-full mt-1"
          >
            <option value="">Any</option>
            {campaignOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs">
          <span className="text-gray-600">Clicked campaign</span>
          <select
            value={filters.clickedCampaignId}
            onChange={(e) => updateFilter('clickedCampaignId', e.target.value)}
            className="ci-input w-full mt-1"
          >
            <option value="">Any</option>
            {campaignOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs">
          <span className="text-gray-600">Did not open campaign</span>
          <select
            value={filters.notOpenedCampaignId}
            onChange={(e) => updateFilter('notOpenedCampaignId', e.target.value)}
            className="ci-input w-full mt-1"
          >
            <option value="">Any</option>
            {campaignOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs">
          <span className="text-gray-600">Active in last N days</span>
          <input
            type="number"
            min={0}
            value={filters.lastActivityDays ?? ''}
            onChange={(e) =>
              updateFilter('lastActivityDays', e.target.value ? Number(e.target.value) : null)
            }
            className="ci-input w-full mt-1"
            placeholder="e.g. 30"
          />
        </label>
      </div>

      <div className="marketing-segment-preview">
        {previewing ? (
          <p className="text-xs text-gray-500">Counting matches…</p>
        ) : (
          <p className="text-sm text-[#33475b]">
            <strong>{preview?.count ?? 0}</strong> contacts match this segment
            {channel === 'email' ? ' with sendable email' : ' with phone'}.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="ci-btn ci-btn-accent" disabled={busy} onClick={handleSave}>
          Save segment
        </button>
        {onCancel && (
          <button type="button" className="ci-btn ci-btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
