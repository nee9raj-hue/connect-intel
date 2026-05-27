import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { CRM_STATUSES } from '../../lib/crmConstants'

const EMPTY = {
  firstName: '',
  lastName: '',
  title: '',
  company: '',
  email: '',
  phone: '',
  city: '',
  state: '',
  industry: '',
  website: '',
  notes: '',
  status: 'new',
  assignedToUserId: '',
}

export default function AddLeadModal({ open, onClose, onAdded }) {
  const { user, teamMembers, addManualLead } = useApp()
  const [form, setForm] = useState({ ...EMPTY })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const isManager = user?.isOrgAdmin || user?.orgRole === 'org_admin'
  const showAssignee = isManager && user?.accountType === 'company' && teamMembers.length > 0

  if (!open) return null

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await addManualLead({
        ...form,
        company: form.company.trim(),
        assignedToUserId: showAssignee ? form.assignedToUserId || user.id : undefined,
      })
      setForm({ ...EMPTY })
      onAdded?.()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="crm-modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <form
        onSubmit={submit}
        className="crm-modal-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="crm-modal-header">
          <h2>Add lead manually</h2>
          <button type="button" onClick={onClose} className="crm-modal-close" aria-label="Close">
            ×
          </button>
        </header>

        <div className="crm-modal-body crm-modal-body-padded space-y-3 text-sm">
          <p className="text-xs text-gray-500">Creates a pipeline lead and a linked contact record. You can fill in email, phone, and company details later.</p>

          <div className="grid grid-cols-2 gap-2">
            <input
              value={form.firstName}
              onChange={(e) => set('firstName', e.target.value)}
              placeholder="First name"
              className="border rounded-lg px-3 py-2"
            />
            <input
              value={form.lastName}
              onChange={(e) => set('lastName', e.target.value)}
              placeholder="Last name"
              className="border rounded-lg px-3 py-2"
            />
          </div>
          <input
            value={form.company}
            onChange={(e) => set('company', e.target.value)}
            placeholder="Company name *"
            className="w-full border rounded-lg px-3 py-2"
          />
          <input
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Job title"
            className="w-full border rounded-lg px-3 py-2"
          />
          <input
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="Email"
            className="w-full border rounded-lg px-3 py-2"
          />
          <input
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="Phone / WhatsApp"
            className="w-full border rounded-lg px-3 py-2"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
              placeholder="City"
              className="border rounded-lg px-3 py-2"
            />
            <input
              value={form.state}
              onChange={(e) => set('state', e.target.value)}
              placeholder="State"
              className="border rounded-lg px-3 py-2"
            />
          </div>
          <input
            value={form.industry}
            onChange={(e) => set('industry', e.target.value)}
            placeholder="Industry"
            className="w-full border rounded-lg px-3 py-2"
          />
          <input
            value={form.website}
            onChange={(e) => set('website', e.target.value)}
            placeholder="Website"
            className="w-full border rounded-lg px-3 py-2"
          />
          <select value={form.status} onChange={(e) => set('status', e.target.value)} className="w-full border rounded-lg px-3 py-2">
            {CRM_STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          {showAssignee && (
            <select
              value={form.assignedToUserId || user.id}
              onChange={(e) => set('assignedToUserId', e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              {teamMembers.map((m) => (
                <option key={m.userId} value={m.userId}>
                  Assign to: {m.name}
                </option>
              ))}
            </select>
          )}
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={2}
            placeholder="Notes (optional)"
            className="w-full border rounded-lg px-3 py-2"
          />

          {error && <p className="crm-alert crm-alert-error mb-0">{error}</p>}
        </div>

        <footer className="crm-modal-footer">
          <button
            type="submit"
            disabled={loading || (!form.company.trim() && !form.firstName.trim() && !form.lastName.trim())}
            className="crm-btn crm-btn-primary w-full sm:w-auto"
          >
            {loading ? 'Adding…' : 'Add to pipeline'}
          </button>
        </footer>
      </form>
    </div>
  )
}
