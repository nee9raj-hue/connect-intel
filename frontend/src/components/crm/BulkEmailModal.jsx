import BulkEmailCompose from './BulkEmailCompose'

export default function BulkEmailModal({ open, leadIds, leads, onClose, onDone }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-xl border border-gray-200 max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b flex justify-between items-center shrink-0">
          <h2 className="text-lg font-semibold">Bulk email ({leadIds.length} selected)</h2>
          <button type="button" onClick={onClose} className="text-2xl text-gray-400 leading-none">
            ×
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden p-5">
          <BulkEmailCompose leadIds={leadIds} leads={leads} onDone={onDone} compact />
        </div>
      </div>
    </div>
  )
}
