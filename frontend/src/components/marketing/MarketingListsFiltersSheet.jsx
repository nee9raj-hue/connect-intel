import FullScreenDetailModal from '../ui/FullScreenDetailModal'
import { CRM_STATUSES } from '../../lib/crmConstants'

export default function MarketingListsFiltersSheet({
  open,
  onClose,
  onApply,
  draft,
  onDraftChange,
  isCompany,
  isCompanyAdmin,
  repOptions,
}) {
  const setDraft = (patch) => onDraftChange({ ...draft, ...patch })

  return (
    <FullScreenDetailModal
      open={open}
      onClose={onClose}
      title="List filters"
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <button
            type="button"
            className="crm-btn crm-btn-ghost"
            onClick={() => onDraftChange({ assigneeUserId: '', pipelineStage: 'all' })}
          >
            Clear
          </button>
          <button type="button" className="crm-btn crm-btn-primary flex-1" onClick={onApply}>
            Apply filters
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {isCompany ? (
          <label className="block text-xs font-semibold text-[#33475b]">
            Team member
            <select
              value={draft.assigneeUserId}
              onChange={(e) => setDraft({ assigneeUserId: e.target.value })}
              disabled={!isCompanyAdmin}
              className="crm-input mt-1.5 w-full text-sm"
            >
              {isCompanyAdmin && <option value="">All members</option>}
              {repOptions.map((r) => (
                <option key={r.userId} value={r.userId}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="block text-xs font-semibold text-[#33475b]">
          Pipeline stage
          <select
            value={draft.pipelineStage}
            onChange={(e) => setDraft({ pipelineStage: e.target.value || 'all' })}
            className="crm-input mt-1.5 w-full text-sm"
          >
            <option value="all">All stages</option>
            {CRM_STATUSES.map((st) => (
              <option key={st.id} value={st.id}>
                {st.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </FullScreenDetailModal>
  )
}
