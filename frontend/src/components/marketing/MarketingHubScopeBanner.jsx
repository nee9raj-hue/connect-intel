/** Constitution: Marketing Hub vs CRM sales email — shown on hub overview. */
export default function MarketingHubScopeBanner() {
  return (
    <div className="mc-hub-scope rounded-lg border border-[#dfe3eb] bg-[#f5f8fa] px-4 py-3 text-sm text-[#516f90] leading-relaxed">
      <p className="font-semibold text-[#33475b] mb-1">Marketing Hub scope</p>
      <p>
        Use <strong>Campaigns</strong> for designed broadcasts to <strong>audiences</strong> (lists &
        segments) with opens, clicks, and reports. For sales outreach to pipeline leads from your work
        Gmail, use <strong>CRM → Pipeline → Email</strong> — each send is logged on the lead trail.
      </p>
    </div>
  )
}
