import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../../context/AppContext'
import { CRM_STATUSES } from '../../lib/crmConstants'
import { brand } from '../../lib/brandTokens'

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
  source: 'manual',
  assignedToUserId: '',
}

const SOURCE_OPTIONS = [
  { id: 'manual', label: 'Manual entry' },
  { id: 'import', label: 'Import' },
  { id: 'referral', label: 'Referral' },
  { id: 'website', label: 'Website' },
  { id: 'other', label: 'Other' },
]

export default function AddLeadModal({ open, onClose, onAdded, initialStatus = 'new' }) {
  const { user, teamMembers, addManualLead, refreshSavedLeads } = useApp()
  const [form, setForm] = useState({ ...EMPTY, status: initialStatus || 'new' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const isManager = user?.isOrgAdmin || user?.orgRole === 'org_admin'
  const showAssignee = isManager && user?.accountType === 'company' && teamMembers.length > 0

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY, status: initialStatus || 'new' })
      setError(null)
    }
  }, [open, initialStatus])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const hasContact = Boolean(form.email.trim() || form.phone.trim())

  const submit = async (e) => {
    e.preventDefault()
    if (!hasContact) {
      setError('Add at least an email or phone number.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await addManualLead({
        ...form,
        company: form.company.trim(),
        assignedToUserId: showAssignee ? form.assignedToUserId || user.id : undefined,
      })
      setForm({ ...EMPTY, status: initialStatus || 'new' })
      onAdded?.(data?.lead)
      onClose()
    } catch (err) {
      if (/timed out/i.test(err?.message || '')) {
        try {
          await refreshSavedLeads()
          setError('Save is still finishing — refresh the list. If the lead appears, it was added.')
        } catch {
          setError(err.message)
        }
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return createPortal(
    <>
      <button type="button" className="pipeline-drawer-backdrop" aria-label="Close" onClick={onClose} />
      <aside className="pipeline-drawer" aria-label="Add lead">
        <form onSubmit={submit} className="pipeline-drawer__form">
          <header className="pipeline-drawer__head">
            <h2>Add lead</h2>
            <button type="button" className="pipeline-drawer__close" onClick={onClose} aria-label="Close">
              ×
            </button>
          </header>

          <div className="pipeline-drawer__body">
            <div className="pipeline-drawer__grid">
              <label className="pipeline-drawer__field">
                <span>First name</span>
                <input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
              </label>
              <label className="pipeline-drawer__field">
                <span>Last name</span>
                <input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
              </label>
            </div>
            <div className="pipeline-drawer__grid">
              <label className="pipeline-drawer__field">
                <span>Email</span>
                <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
              </label>
              <label className="pipeline-drawer__field">
                <span>Phone</span>
                <input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
              </label>
            </div>
            <label className="pipeline-drawer__field">
              <span>Company</span>
              <input value={form.company} onChange={(e) => set('company', e.target.value)} />
            </label>
            <div className="pipeline-drawer__grid">
              <label className="pipeline-drawer__field">
                <span>City</span>
                <input value={form.city} onChange={(e) => set('city', e.target.value)} />
              </label>
              <label className="pipeline-drawer__field">
                <span>State</span>
                <input value={form.state} onChange={(e) => set('state', e.target.value)} />
              </label>
            </div>
            <div className="pipeline-drawer__grid">
              <label className="pipeline-drawer__field">
                <span>Status</span>
                <select value={form.status} onChange={(e) => set('status', e.target.value)}>
                  {CRM_STATUSES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              {showAssignee ? (
                <label className="pipeline-drawer__field">
                  <span>Lead owner</span>
                  <select
                    value={form.assignedToUserId || user.id}
                    onChange={(e) => set('assignedToUserId', e.target.value)}
                  >
                    {teamMembers.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="pipeline-drawer__field">
                  <span>Source</span>
                  <select value={form.source} onChange={(e) => set('source', e.target.value)}>
                    {SOURCE_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {showAssignee ? (
              <label className="pipeline-drawer__field">
                <span>Source</span>
                <select value={form.source} onChange={(e) => set('source', e.target.value)}>
                  {SOURCE_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="pipeline-drawer__field">
              <span>Notes (optional)</span>
              <textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </label>
            {error ? <p className="pipeline-drawer__error">{error}</p> : null}
          </div>

          <footer className="pipeline-drawer__foot">
            <button type="button" className="pipeline-v2-btn-import" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !hasContact}
              className="pipeline-v2-btn-add"
              style={{ background: brand.primary }}
            >
              {loading ? 'Adding…' : 'Add lead →'}
            </button>
          </footer>
        </form>
      </aside>
    </>,
    document.body
  )
}
