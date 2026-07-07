/** Constitution: bulk email to pipeline leads is CRM-only, not Marketing Hub. */
export default function MarketingPipelineEmailRedirect({ onNavigate }) {
  return (
    <div className="mc-page mc-pipeline-email-redirect max-w-xl mx-auto px-5 py-10">
      <h2 className="text-lg font-semibold text-[#33475b] mb-2">Pipeline email lives in CRM</h2>
      <p className="text-sm text-[#516f90] leading-relaxed mb-6">
        Bulk email to selected pipeline leads sends from your connected work Gmail and logs on each
        lead&apos;s timeline. That is a <strong>sales rep</strong> workflow — not a marketing campaign.
      </p>
      <p className="text-sm text-[#516f90] leading-relaxed mb-6">
        For designed broadcasts to audiences (lists, segments), templates, and engagement analytics,
        create a <strong>Campaign</strong> in this hub instead.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="crm-btn crm-btn-primary"
          onClick={() => onNavigate?.('pipeline')}
        >
          Go to Pipeline
        </button>
        <button
          type="button"
          className="crm-btn crm-btn-secondary"
          onClick={() => onNavigate?.('marketing', { tab: 'campaigns' })}
        >
          Create campaign
        </button>
      </div>
    </div>
  )
}
