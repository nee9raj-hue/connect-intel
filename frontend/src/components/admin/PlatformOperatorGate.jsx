/**
 * Shown only if a non-operator reaches an internal panel (should be rare after routing guards).
 */
export default function PlatformOperatorGate({ onNavigate }) {
  return (
    <div className="p-6">
      <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-lg">
        <h2 className="text-lg font-semibold text-gray-900">Connect Intel internal area</h2>
        <p className="mt-2 text-sm text-gray-600 leading-relaxed">
          This section is for Connect Intel platform staff only. Your workspace account does not include access here.
        </p>
        <p className="mt-3 text-sm text-gray-500 leading-relaxed">
          For your CRM, use Home, Pipeline, or Team from the sidebar.
        </p>
        <button
          type="button"
          onClick={() => onNavigate?.('overview')}
          className="mt-5 px-4 py-2.5 text-sm font-semibold rounded-lg text-white bg-zinc-900 hover:bg-zinc-800"
        >
          Go to your workspace
        </button>
      </div>
    </div>
  )
}
