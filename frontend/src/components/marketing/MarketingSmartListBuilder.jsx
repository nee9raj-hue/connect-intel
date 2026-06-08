import { useCallback, useEffect, useMemo, useState } from 'react'
import { CRM_STATUSES } from '../../lib/crmConstants'
import { CONTACT_FILTER_OPTIONS } from '../../lib/pipelineFilters'
import { SEGMENT_FILTER_DEFAULTS, segmentFilterSummary } from '../../../../lib/marketingSegmentFilters.js'
import { SMART_LIST_PRESETS } from '../../../../lib/marketingSmartListPresets.js'
import {
  MARKETING_SEND_BATCH_SIZE,
  previewBatchNames,
} from '../../../../lib/marketingListBatches.js'
import { api } from '../../lib/api'
import MarketingSegmentTagFilter from './MarketingSegmentTagFilter'

const UNASSIGNED = '__unassigned__'

function defaultNamePrefix(label, channel) {
  const ch = channel === 'whatsapp' ? 'WhatsApp' : 'Email'
  return label ? `${label} · ${ch}` : ch
}

export default function MarketingSmartListBuilder({
  user,
  teamMembers,
  listChannel = 'email',
  assigneeUserId: assigneeProp = '',
  busy,
  setBusy,
  setError,
  setNotice,
  onListsCreated,
  onSegmentSaved,
  orgLeadTags = [],
}) {
  const [filters, setFilters] = useState({ ...SEGMENT_FILTER_DEFAULTS, contact: 'has_email' })
  const [activePreset, setActivePreset] = useState(null)
  const [namePrefix, setNamePrefix] = useState('')
  const [prefixTouched, setPrefixTouched] = useState(false)
  const [segmentName, setSegmentName] = useState('')
  const [preview, setPreview] = useState(null)
  const [previewing, setPreviewing] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const isCompany = Boolean(user?.accountType === 'company' && user?.organizationId)
  const isCompanyAdmin = Boolean(isCompany && (user?.isOrgAdmin || user?.orgRole === 'org_admin'))
  const assigneeUserId = assigneeProp || (!isCompanyAdmin && user?.id ? user.id : '')

  const repOptions = useMemo(() => {
    if (!isCompanyAdmin && user?.id) {
      return [{ userId: user.id, name: user.name || user.email || 'My leads' }]
    }
    const active = (teamMembers || []).filter((m) => m.status !== 'inactive')
    return [
      { userId: UNASSIGNED, name: 'Unassigned leads' },
      ...active.map((m) => ({ userId: m.userId, name: m.name || m.email || 'Team member' })),
    ]
  }, [teamMembers, isCompanyAdmin, user?.id, user?.name, user?.email])

  const previewFilters = useMemo(() => {
    const next = { ...filters }
    if (assigneeUserId) next.assigneeUserId = assigneeUserId
    return next
  }, [filters, assigneeUserId])

  const runPreview = useCallback(async () => {
    if (!assigneeUserId && isCompany) {
      setPreview(null)
      return
    }
    setPreviewing(true)
    try {
      const res = await api.previewMarketingSegment(previewFilters, { channel: listChannel })
      setPreview(res)
    } catch (e) {
      setPreview(null)
      setError?.(e.message)
    } finally {
      setPreviewing(false)
    }
  }, [previewFilters, assigneeUserId, isCompany, listChannel, setError])

  useEffect(() => {
    const t = setTimeout(() => {
      void runPreview()
    }, 350)
    return () => clearTimeout(t)
  }, [runPreview])

  useEffect(() => {
    if (prefixTouched) return
    const preset = SMART_LIST_PRESETS.find((p) => p.id === activePreset)
    const rep = repOptions.find((r) => r.userId === assigneeUserId)
    setNamePrefix(defaultNamePrefix(preset?.label || rep?.name, listChannel))
    if (!segmentName && preset) setSegmentName(preset.label)
  }, [activePreset, assigneeUserId, listChannel, repOptions, prefixTouched, segmentName])

  const applyPreset = (preset) => {
    setActivePreset(preset.id)
    const contact =
      listChannel === 'whatsapp'
        ? 'has_phone'
        : preset.filters.contact || 'has_email'
    setFilters({
      ...SEGMENT_FILTER_DEFAULTS,
      ...preset.filters,
      contact,
    })
    setPrefixTouched(false)
    setSegmentName(preset.label)
  }

  const updateFilter = (key, value) => {
    setActivePreset(null)
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const matchCount = preview?.count ?? 0
  const batchPreview = useMemo(
    () => previewBatchNames(namePrefix.trim() || 'Smart list', matchCount),
    [namePrefix, matchCount]
  )

  const createBatchLists = async () => {
    if (!assigneeUserId) return setError?.('Select whose pipeline to use')
    const prefix = namePrefix.trim()
    if (!prefix) return setError?.('Enter a name prefix for your lists')
    if (!matchCount) {
      return setError?.('No contacts match these rules — adjust filters or pick another preset')
    }
    if (
      !window.confirm(
        `Create ${batchPreview.length} list(s) of up to ${MARKETING_SEND_BATCH_SIZE} contacts each?\n\n${batchPreview
          .slice(0, 8)
          .map((b) => `• ${b.name} (${b.leadCount})`)
          .join('\n')}${batchPreview.length > 8 ? `\n+ ${batchPreview.length - 8} more…` : ''}`
      )
    ) {
      return
    }
    setBusy?.(true)
    setError?.(null)
    try {
      const data = await api.createMarketingListBatchesFromFilters({
        assigneeUserId,
        namePrefix: prefix,
        filterJson: previewFilters,
        channel: listChannel,
      })
      setNotice?.(
        `Created ${data.batchCount} smart list(s) · ${data.totalLeads} contacts (${MARKETING_SEND_BATCH_SIZE} max per send)`
      )
      await onListsCreated?.(data)
    } catch (e) {
      setError?.(e.message)
    } finally {
      setBusy?.(false)
    }
  }

  const saveSegment = async () => {
    const name = segmentName.trim()
    if (!name) return setError?.('Name your smart segment')
    setBusy?.(true)
    setError?.(null)
    try {
      await api.createMarketingSegment({
        name,
        description: segmentFilterSummary(previewFilters),
        channel: listChannel,
        type: 'dynamic',
        filterJson: previewFilters,
      })
      setNotice?.('Smart segment saved — it stays in sync as your pipeline changes')
      await onSegmentSaved?.()
    } catch (e) {
      setError?.(e.message)
    } finally {
      setBusy?.(false)
    }
  }

  const contactDefault = listChannel === 'whatsapp' ? 'has_phone' : 'has_email'

  return (
    <div className="marketing-smart-list space-y-4">
      <div>
        <p className="text-xs font-semibold text-[#33475b] mb-2">Quick smart lists</p>
        <p className="text-xs text-[#516f90] mb-3 leading-relaxed">
          Pick a preset or customize rules below. We count matches across your full pipeline (not just
          loaded rows), then split into send-ready lists of {MARKETING_SEND_BATCH_SIZE}.
        </p>
        <div className="flex flex-wrap gap-2">
          {SMART_LIST_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              title={preset.description}
              onClick={() => applyPreset(preset)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                activePreset === preset.id
                  ? 'bg-[#17191c] text-white border-[#17191c]'
                  : 'bg-white text-[#516f90] border-[#dfe3eb] hover:border-[#99acc2]'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {isCompany && !assigneeUserId ? (
        <p className="text-sm text-[#516f90] bg-[#f5f8fa] border border-[#dfe3eb] rounded-lg px-3 py-2">
          Select a team member in the toolbar above to build lists from their pipeline.
        </p>
      ) : (
        <>
          <div className="marketing-smart-list-preview rounded-xl border border-[#dfe3eb] bg-[#f5f8fa] px-3 py-2.5">
            {previewing ? (
              <p className="text-xs text-[#516f90]">Counting matches across pipeline…</p>
            ) : (
              <>
                <p className="text-sm text-[#33475b]">
                  <strong>{matchCount.toLocaleString()}</strong> contacts match
                  {listChannel === 'email' ? ' with sendable email' : ' with valid phone'}
                </p>
                <p className="text-xs text-[#516f90] mt-0.5">{segmentFilterSummary(previewFilters)}</p>
                {batchPreview.length > 1 ? (
                  <p className="text-xs text-[#516f90] mt-1">
                    → {batchPreview.length} send lists of up to {MARKETING_SEND_BATCH_SIZE} each
                  </p>
                ) : null}
              </>
            )}
          </div>

          {orgLeadTags.length > 0 ? (
            <MarketingSegmentTagFilter
              orgLeadTags={orgLeadTags}
              tagIds={filters.tagIds}
              tagMode={filters.tagMode}
              onTagIdsChange={(tagIds) => updateFilter('tagIds', tagIds)}
              onTagModeChange={(tagMode) => updateFilter('tagMode', tagMode)}
            />
          ) : null}

          <label className="block text-xs font-medium text-[#516f90]">
            List name prefix
            <input
              value={namePrefix}
              onChange={(e) => {
                setPrefixTouched(true)
                setNamePrefix(e.target.value)
              }}
              placeholder="e.g. March outreach — Hot leads"
              className="ci-input w-full mt-1"
            />
          </label>

          <button
            type="button"
            className="text-xs font-semibold text-[#0091ae] hover:underline"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced ? 'Hide custom rules' : 'Customize rules'}
          </button>

          {showAdvanced ? (
            <div className="marketing-segment-filters grid sm:grid-cols-2 gap-3">
              <label className="block text-xs">
                <span className="text-[#516f90]">Pipeline stage</span>
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

              <label className="block text-xs">
                <span className="text-[#516f90]">Contact</span>
                <select
                  value={filters.contact || contactDefault}
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
                <span className="text-[#516f90]">Min lead score</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={filters.minLeadScore ?? ''}
                  onChange={(e) =>
                    updateFilter('minLeadScore', e.target.value ? Number(e.target.value) : null)
                  }
                  className="ci-input w-full mt-1"
                  placeholder="e.g. 70"
                />
              </label>

              <label className="block text-xs">
                <span className="text-[#516f90]">Stale (no activity N days)</span>
                <input
                  type="number"
                  min={0}
                  value={filters.staleDays ?? ''}
                  onChange={(e) =>
                    updateFilter('staleDays', e.target.value ? Number(e.target.value) : null)
                  }
                  className="ci-input w-full mt-1"
                  placeholder="e.g. 30"
                />
              </label>

              <label className="flex items-center gap-2 text-xs text-[#516f90] sm:col-span-2">
                <input
                  type="checkbox"
                  checked={Boolean(filters.followUpDue)}
                  onChange={(e) => updateFilter('followUpDue', e.target.checked)}
                />
                Follow-up due today or overdue
              </label>

              <label className="flex items-center gap-2 text-xs text-[#516f90] sm:col-span-2">
                <input
                  type="checkbox"
                  checked={Boolean(filters.overdueFollowUp)}
                  onChange={(e) => updateFilter('overdueFollowUp', e.target.checked)}
                />
                Overdue follow-up date only
              </label>

              <label className="flex items-center gap-2 text-xs text-[#516f90] sm:col-span-2">
                <input
                  type="checkbox"
                  checked={(filters.smartTags || []).includes('not_touched')}
                  onChange={(e) => {
                    const tags = new Set(filters.smartTags || [])
                    if (e.target.checked) tags.add('not_touched')
                    else tags.delete('not_touched')
                    updateFilter('smartTags', [...tags])
                  }}
                />
                Not touched in 7+ days
              </label>

            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={busy || !matchCount}
              onClick={createBatchLists}
              className="ci-btn ci-btn-accent"
            >
              Create send lists ({MARKETING_SEND_BATCH_SIZE}/each)
            </button>
          </div>

          <div className="border-t border-[#dfe3eb] pt-4 space-y-2">
            <p className="text-xs font-medium text-[#33475b]">Or save as a live segment</p>
            <p className="text-xs text-[#516f90]">
              Segments auto-refresh when you run campaigns — use when you want one audience that
              updates over time.
            </p>
            <input
              value={segmentName}
              onChange={(e) => setSegmentName(e.target.value)}
              placeholder="Segment name"
              className="ci-input w-full"
            />
            <button
              type="button"
              disabled={busy || !matchCount}
              onClick={saveSegment}
              className="ci-btn ci-btn-secondary"
            >
              Save dynamic segment
            </button>
          </div>
        </>
      )}
    </div>
  )
}
