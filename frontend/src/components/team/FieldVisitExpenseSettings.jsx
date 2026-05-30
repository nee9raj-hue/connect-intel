import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { DEFAULT_FIELD_VISIT_EXPENSE_SETTINGS } from '../../lib/fieldVisitExpenses'
import TeamSettingsSection from './TeamSettingsSection'

export default function FieldVisitExpenseSettings({ user, featureEnabled }) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [form, setForm] = useState({ ...DEFAULT_FIELD_VISIT_EXPENSE_SETTINGS })

  const load = useCallback(async () => {
    if (!featureEnabled) return
    setLoading(true)
    setError(null)
    try {
      const q = new URLSearchParams()
      const data = await api.getFieldVisitExpenses(q.toString())
      setForm({ ...DEFAULT_FIELD_VISIT_EXPENSE_SETTINGS, ...(data.settings || {}) })
    } catch (e) {
      setError(e.message || 'Could not load rates')
    } finally {
      setLoading(false)
    }
  }, [featureEnabled])

  useEffect(() => {
    if (user?.isOrgAdmin && featureEnabled) load()
  }, [user?.isOrgAdmin, featureEnabled, load])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const data = await api.updateFieldVisitExpenseSettings({
        bikeRatePerKm: Number(form.bikeRatePerKm),
        carRatePerKm: Number(form.carRatePerKm),
        defaultStartLocation: form.defaultStartLocation,
      })
      setForm((prev) => ({ ...prev, ...(data.settings || {}) }))
      setNotice('Travel claim rates saved.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!user?.isOrgAdmin || !featureEnabled) return null

  return (
    <TeamSettingsSection
      id="field-visit-expenses"
      icon={TravelIcon}
      title="Field visit claim rates"
      description="Per-km rates for bike and car travel when reps log field visits. Cab claims use the actual amount entered."
      defaultOpen={false}
    >
      {loading ? (
        <p className="text-sm text-[#516f90]">Loading rates…</p>
      ) : (
        <form onSubmit={save} className="space-y-3 max-w-md">
          {error ? (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          ) : null}
          {notice ? (
            <p className="text-sm text-green-900 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{notice}</p>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs">
              <span className="font-semibold text-[#516f90]">Bike (₹ / km)</span>
              <input
                type="number"
                min="0"
                step="0.5"
                value={form.bikeRatePerKm}
                onChange={(e) => setForm((f) => ({ ...f, bikeRatePerKm: e.target.value }))}
                className="mt-1 w-full text-sm border border-[#cbd6e2] rounded-md px-2 py-1.5"
              />
            </label>
            <label className="block text-xs">
              <span className="font-semibold text-[#516f90]">Car (₹ / km)</span>
              <input
                type="number"
                min="0"
                step="0.5"
                value={form.carRatePerKm}
                onChange={(e) => setForm((f) => ({ ...f, carRatePerKm: e.target.value }))}
                className="mt-1 w-full text-sm border border-[#cbd6e2] rounded-md px-2 py-1.5"
              />
            </label>
          </div>
          <label className="block text-xs">
            <span className="font-semibold text-[#516f90]">Default start location</span>
            <input
              value={form.defaultStartLocation}
              onChange={(e) => setForm((f) => ({ ...f, defaultStartLocation: e.target.value }))}
              placeholder="e.g. Xindus office, Andheri East"
              className="mt-1 w-full text-sm border border-[#cbd6e2] rounded-md px-2 py-1.5"
            />
          </label>
          <button type="submit" disabled={saving} className="crm-btn crm-btn-primary text-sm">
            {saving ? 'Saving…' : 'Save rates'}
          </button>
        </form>
      )}
    </TeamSettingsSection>
  )
}

function TravelIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8m-8 4h5m9 1V9a2 2 0 00-2-2h-1l-2-5H7L5 7H4a2 2 0 00-2 2v8a2 2 0 002 2h1" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  )
}
