import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import LoadingExperience from '../ui/LoadingExperience'

export default function CrmSequencesPanel() {
  const { user } = useApp()
  const [sequences, setSequences] = useState([])
  const [template, setTemplate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [name, setName] = useState('Standard follow-up')
  const [steps, setSteps] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listCrmSequences()
      setSequences(data.sequences || [])
      if (data.template?.steps) {
        setTemplate(data.template)
        setSteps(data.template.steps)
        setName(data.template.name)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    api.processCrmSequences?.().catch(() => {})
  }, [load])

  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.createCrmSequence({ name, steps })
      setNotice('Sequence created')
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (user?.accountType !== 'company') {
    return (
      <div className="p-6 max-w-lg">
        <p className="text-sm text-gray-600">Sales sequences are available on company workspaces.</p>
      </div>
    )
  }

  return (
    <div className="panel-shell">
      <header className="shrink-0 bg-white border-b border-gray-200 px-5 py-4">
        <h1 className="text-lg font-semibold text-gray-900">Sales sequences</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Multi-step follow-ups (tasks, waits, notes). Enroll leads from Pipeline → lead overview.
        </p>
      </header>

      <div className="panel-body-scroll p-5 max-w-2xl space-y-4">
        {loading ? (
          <LoadingExperience message="Loading sequences…" compact fill={false} className="rounded-xl border" />
        ) : (
          <>
            {error && <p className="text-xs text-red-800 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
            {notice && (
              <p className="text-xs text-green-900 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{notice}</p>
            )}

            {user?.isOrgAdmin && (
              <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                <h2 className="text-sm font-semibold text-gray-900">Create sequence</h2>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                  placeholder="Sequence name"
                />
                <div className="space-y-2">
                  {steps.map((step, i) => (
                    <div key={i} className="flex gap-2 items-start text-xs border border-gray-100 rounded-lg p-2">
                      <span className="font-mono text-gray-400 w-5">{i + 1}</span>
                      <div className="flex-1 space-y-1">
                        <select
                          value={step.type}
                          onChange={(e) => {
                            const next = [...steps]
                            next[i] = { ...next[i], type: e.target.value }
                            setSteps(next)
                          }}
                          className="w-full border rounded px-2 py-1"
                        >
                          <option value="task">Task</option>
                          <option value="wait">Wait</option>
                          <option value="note">Note</option>
                        </select>
                        {step.type === 'wait' ? (
                          <input
                            type="number"
                            min={0}
                            max={30}
                            value={step.waitDays ?? 1}
                            onChange={(e) => {
                              const next = [...steps]
                              next[i] = { ...next[i], waitDays: Number(e.target.value) }
                              setSteps(next)
                            }}
                            className="w-full border rounded px-2 py-1"
                            placeholder="Days"
                          />
                        ) : (
                          <input
                            value={step.title || step.note || ''}
                            onChange={(e) => {
                              const next = [...steps]
                              next[i] =
                                step.type === 'note'
                                  ? { ...next[i], note: e.target.value }
                                  : { ...next[i], title: e.target.value }
                              setSteps(next)
                            }}
                            className="w-full border rounded px-2 py-1"
                            placeholder={step.type === 'note' ? 'Note text' : 'Task title'}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSteps([...steps, { type: 'task', title: 'Follow up', dueDays: 1 }])}
                    className="text-xs font-medium px-3 py-1.5 border border-gray-200 rounded-lg"
                  >
                    + Step
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={create}
                    className="text-xs font-semibold px-4 py-1.5 rounded-lg bg-[#FF773D] text-[#242424] disabled:opacity-40"
                  >
                    Save sequence
                  </button>
                </div>
              </section>
            )}

            <section className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Active sequences</h2>
              {!sequences.length ? (
                <p className="text-xs text-gray-500">No sequences yet. Company admins can create one above.</p>
              ) : (
                <ul className="space-y-2">
                  {sequences.map((s) => (
                    <li key={s.id} className="text-sm border border-gray-100 rounded-lg px-3 py-2">
                      <p className="font-medium text-gray-900">{s.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{s.steps?.length || 0} steps · {s.status}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
