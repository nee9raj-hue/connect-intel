import { useState } from 'react'
import MarketingSegmentBuilder from './MarketingSegmentBuilder'
import MarketingCreatorBadge from './MarketingCreatorBadge'
import { api } from '../../lib/api'
import { segmentFilterSummary } from '../../../../lib/marketingSegmentFilters.js'

export default function MarketingSegmentsPanel({
  user,
  teamMembers,
  segments = [],
  campaigns = [],
  onReload,
  busy,
  setBusy,
  setError,
  setNotice,
  orgLeadTags = [],
  startCreating = false,
}) {
  const [creating, setCreating] = useState(startCreating)

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this segment?')) return
    setBusy?.(true)
    try {
      await api.deleteMarketingSegment(id)
      setNotice?.('Segment deleted')
      await onReload?.()
    } catch (e) {
      setError?.(e.message)
    } finally {
      setBusy?.(false)
    }
  }

  const handleRefresh = async (id) => {
    setBusy?.(true)
    try {
      await api.refreshMarketingSegment(id)
      setNotice?.('Segment refreshed')
      await onReload?.()
    } catch (e) {
      setError?.(e.message)
    } finally {
      setBusy?.(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="crm-section-title mb-1">Audience segments</h2>
          <p className="text-xs text-[#516f90]">
            Dynamic segments refresh from pipeline filters — use them in campaigns instead of static lists.
          </p>
        </div>
        <button
          type="button"
          className="ci-btn ci-btn-accent"
          onClick={() => setCreating((v) => !v)}
        >
          {creating ? 'Close builder' : 'New segment'}
        </button>
      </div>

      {creating && (
        <div className="marketing-segment-builder-card">
          <MarketingSegmentBuilder
            user={user}
            teamMembers={teamMembers}
            campaigns={campaigns}
            busy={busy}
            setBusy={setBusy}
            setError={setError}
            setNotice={setNotice}
            onSaved={async () => {
              setCreating(false)
              await onReload?.()
            }}
            onCancel={() => setCreating(false)}
            orgLeadTags={orgLeadTags}
          />
        </div>
      )}

      <div className="grid gap-3">
        {segments.length ? (
          segments.map((seg) => (
            <div key={seg.id} className="crm-campaign-card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[#33475b]">{seg.name}</p>
                    <MarketingCreatorBadge name={seg.createdByName} isOwn={seg.isOwn} />
                  </div>
                  <p className="text-xs text-[#516f90] mt-0.5">
                    {seg.type === 'dynamic' ? 'Dynamic' : 'Static'} · {seg.channel || 'email'} ·{' '}
                    <strong>{seg.memberCount ?? 0}</strong> contacts
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {seg.type === 'dynamic'
                      ? segmentFilterSummary(seg.filterJson)
                      : 'Static lead list'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {seg.type === 'dynamic' && (
                    <button
                      type="button"
                      className="crm-link-btn p-0"
                      disabled={busy}
                      onClick={() => handleRefresh(seg.id)}
                    >
                      Refresh
                    </button>
                  )}
                  <button
                    type="button"
                    className="crm-link-btn p-0 text-red-800"
                    disabled={busy}
                    onClick={() => handleDelete(seg.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500">No segments yet. Create one to target pipeline contacts dynamically.</p>
        )}
      </div>
    </div>
  )
}
