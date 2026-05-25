import CrmGmailConnectCard from './CrmGmailConnectCard'

/** Work Gmail connect for company team members (admins use Team & email). */
export default function MyEmailPanel({ onNavigate }) {
  return (
    <div className="panel-shell bg-[#fafafa]">
      <header className="shrink-0 px-4 sm:px-6 py-4 border-b border-gray-200 bg-white">
        <h1 className="text-lg font-semibold text-gray-900">Work email</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Connect your work Gmail once to send CRM email, bulk email, and marketing campaigns from your inbox.
        </p>
      </header>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-lg">
        <CrmGmailConnectCard />
        <p className="mt-4 text-xs text-gray-500 leading-relaxed">
          After connecting, open{' '}
          <button
            type="button"
            onClick={() => onNavigate?.('marketing', { tab: 'campaigns' })}
            className="font-semibold text-[#5b4a00] underline"
          >
            Marketing → Campaigns
          </button>{' '}
          or Pipeline → Email on any lead.
        </p>
      </div>
    </div>
  )
}
