import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'

export default function CrmAutomationPanel() {
  const { user } = useApp()
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getCrmSettings()
      setSettings(data.settings)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const save = async (patch) => {
    setBusy(true)
    setError(null)
    try {
      const data = await api.updateCrmSettings(patch)
      setSettings(data.settings)
      setNotice('Saved')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (!user?.isOrgAdmin) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-600">Only company admins can manage automation rules.</p>
      </div>
    )
  }

  const rules = settings?.workflowRules || []

  return (
    <div className="panel-shell">
      <header className="shrink-0 bg-white border-b border-gray-200 px-5 py-4">
        <h1 className="text-lg font-semibold text-gray-900">Automation</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Workflow rules run when pipeline stage changes. Lead scores update automatically on each save.
        </p>
      </header>

      <div className="panel-body-scroll p-5 max-w-2xl space-y-4">
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          <>
            {error && <p className="text-xs text-red-800 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            {notice && <p className="text-xs text-green-900 bg-green-50 rounded-lg px-3 py-2">{notice}</p>}

            <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(settings?.autoAssignEnabled)}
                  onChange={(e) => save({ autoAssignEnabled: e.target.checked })}
                  disabled={busy}
                />
                Auto-assign new leads (round robin)
              </label>
              <p className="text-xs text-gray-500">
                When enabled, manually added leads without an assignee are distributed across teammates.
              </p>
            </section>

            <section className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-sm font-semibold text-gray-900">Workflow rules</h2>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => save({ seedDefaults: true })}
                  className="text-xs font-medium px-2.5 py-1 border border-gray-200 rounded-lg"
                >
                  Load defaults
                </button>
              </div>
              {!rules.length ? (
                <p className="text-xs text-gray-500">No rules yet. Load defaults to get started.</p>
              ) : (
                <ul className="space-y-2">
                  {rules.map((r) => (
                    <li key={r.id} className="text-xs border border-gray-100 rounded-lg p-3">
                      <p className="font-semibold text-gray-900">{r.name}</p>
                      <p className="text-gray-500 mt-0.5">
                        When stage → <strong>{r.status}</strong> · {r.enabled === false ? 'disabled' : 'enabled'}
                      </p>
                      <ul className="mt-1 text-gray-600 list-disc pl-4">
                        {(r.actions || []).map((a, i) => (
                          <li key={i}>
                            {a.type === 'add_task' ? `Create task: ${a.title}` : a.summary || a.type}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-950">
              <p className="font-semibold">Lead scoring</p>
              <p className="mt-1">
                Each pipeline lead gets a 0–100 engagement score from email, activity, deal value, and stage. Use
                smart views like &quot;Hot (score 70+)&quot; on Pipeline.
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
