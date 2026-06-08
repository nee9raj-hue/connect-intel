import OrgCrmEmailSetup from '../team/OrgCrmEmailSetup'

export default function MarketingDomainsPanel({ user }) {
  const isAdmin = Boolean(user?.isOrgAdmin)

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h2 className="crm-section-title mb-1">Sender domain</h2>
        <p className="text-xs text-[#516f90]">
          Verify your company domain for bulk marketing email. SPF, DKIM, and DMARC are configured via Resend.
        </p>
      </div>

      {user?.accountType !== 'company' ? (
        <p className="text-sm text-gray-600">
          Company email domains are available on team accounts. Connect work Gmail under Tips for individual sends.
        </p>
      ) : isAdmin ? (
        <OrgCrmEmailSetup />
      ) : (
        <div className="crm-content-card p-4 text-sm text-[#33475b]">
          <p>
            Your admin manages domain verification. When verified, you can send campaigns from your work email
            address on <strong>@{user?.orgEmailDomain || 'your company domain'}</strong>.
          </p>
          {user?.orgOutboundEmailReady ? (
            <p className="mt-2 text-green-700 font-medium">Your domain is verified — you can send campaigns.</p>
          ) : (
            <p className="mt-2 text-amber-800">Domain not verified yet — ask your admin to finish DNS setup.</p>
          )}
        </div>
      )}
    </div>
  )
}
