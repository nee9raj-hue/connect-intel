import WorkEmailOptions from './WorkEmailOptions'
import TeamSettingsSection from './TeamSettingsSection'

function MailIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )
}

/** Work email setup for company team members (admins use Team & workspace). */
export default function MyEmailPanel({ onNavigate }) {
  return (
    <div className="panel-shell bg-[#f3f4f6]">
      <header className="shrink-0 bg-white border-b border-gray-200/90 px-5 py-4 md:px-6">
        <div className="max-w-2xl">
          <h1 className="text-lg md:text-xl font-semibold text-gray-900 tracking-tight">Work email</h1>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            Send CRM, bulk, and marketing email from your company domain or connected Gmail.
          </p>
        </div>
      </header>
      <div className="panel-body-scroll">
        <div className="max-w-2xl mx-auto p-4 md:p-6">
          <TeamSettingsSection
            id="work-email"
            icon={MailIcon}
            title="Outbound email"
            description="How your messages leave Connect Intel"
            defaultOpen
          >
            <WorkEmailOptions onNavigate={onNavigate} />
          </TeamSettingsSection>
        </div>
      </div>
    </div>
  )
}
