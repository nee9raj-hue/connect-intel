import WorkEmailOptions from './WorkEmailOptions'

/** Work email setup for company team members (admins use Team & email). */
export default function MyEmailPanel({ onNavigate }) {
  return (
    <div className="panel-shell bg-[#fafafa]">
      <header className="shrink-0 px-4 sm:px-6 py-4 border-b border-gray-200 bg-white">
        <h1 className="text-lg font-semibold text-gray-900">Work email</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Send CRM, bulk, and marketing email via your company domain or connected Gmail.
        </p>
      </header>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-xl">
        <WorkEmailOptions onNavigate={onNavigate} />
      </div>
    </div>
  )
}
