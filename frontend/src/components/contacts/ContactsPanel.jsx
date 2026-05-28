import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import LoadingExperience from '../ui/LoadingExperience'
import { LOADING_MESSAGES } from '../../lib/loadingQuotes'

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
  linkedin: '',
}

export default function ContactsPanel({ onNavigate }) {
  const {
    contactsFocusId,
    clearContactsFocus,
    openPipelineLead,
    refreshSavedLeads,
    savedLeads,
    isSaved,
    toggleSaveLead,
  } = useApp()

  const [contacts, setContacts] = useState([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [aiSearching, setAiSearching] = useState(false)
  const [aiMatches, setAiMatches] = useState([])
  const [aiError, setAiError] = useState(null)
  const [aiNotice, setAiNotice] = useState(null)

  const loadList = useCallback(async (q = appliedSearch) => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listContacts({ search: q, limit: 200 })
      setContacts(data.contacts || [])
      setTotal(data.total || 0)
    } catch (e) {
      setError(e.message)
      setContacts([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [appliedSearch])

  useEffect(() => {
    loadList()
  }, [loadList])

  useEffect(() => {
    if (!contactsFocusId) return
    setSelectedId(contactsFocusId)
    clearContactsFocus?.()
  }, [contactsFocusId, clearContactsFocus])

  const loadOne = useCallback(async (id) => {
    if (!id) return
    setError(null)
    try {
      const data = await api.getContact(id)
      const c = data.contact
      setForm({
        firstName: c.firstName || '',
        lastName: c.lastName || '',
        title: c.title || '',
        company: c.company || '',
        email: c.email || '',
        phone: c.phone || '',
        city: c.city || '',
        state: c.state || '',
        industry: c.industry || '',
        website: c.website || c.companyDomain || '',
        linkedin: c.linkedin || '',
      })
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    if (selectedId) loadOne(selectedId)
    else setForm({ ...EMPTY })
    setAiMatches([])
    setAiError(null)
    setAiNotice(null)
  }, [selectedId, loadOne])

  const selected = useMemo(
    () => contacts.find((c) => c.id === selectedId) || null,
    [contacts, selectedId]
  )

  const pipelineLeadForContact = useMemo(() => {
    if (!selectedId) return null
    return (
      savedLeads.find((l) => l.contactId === selectedId || l.id === selectedId) || null
    )
  }, [savedLeads, selectedId])

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const applySearch = () => {
    setAppliedSearch(search.trim())
  }

  const runLinkedinAiSearch = async () => {
    if (!selectedId || aiSearching) return
    const hasHint =
      form.firstName?.trim() ||
      form.lastName?.trim() ||
      form.company?.trim() ||
      form.email?.trim()
    if (!hasHint) {
      setAiError('Add a name, company, or email first.')
      return
    }

    setAiSearching(true)
    setAiError(null)
    setAiNotice(null)
    setAiMatches([])
    setNotice(null)

    try {
      const data = await api.searchContactLinkedin(selectedId, form)
      setAiMatches(data.matches || [])
      setAiNotice(data.notice || null)
      if (data.error && !(data.matches || []).length) {
        setAiError(data.error)
      }
    } catch (e) {
      setAiError(e.message || 'AI search failed')
      setAiMatches([])
    } finally {
      setAiSearching(false)
    }
  }

  const applyLinkedinMatch = (match) => {
    setForm((f) => ({
      ...f,
      linkedin: match.linkedin || f.linkedin,
      firstName: match.firstName?.trim() ? match.firstName : f.firstName,
      lastName: match.lastName?.trim() ? match.lastName : f.lastName,
      title: match.title?.trim() ? match.title : f.title,
      company: match.company?.trim() ? match.company : f.company,
      email: match.email?.trim() ? match.email : f.email,
      phone: match.phone?.trim() ? match.phone : f.phone,
      city: match.city?.trim() ? match.city : f.city,
      state: match.state?.trim() ? match.state : f.state,
    }))
    setAiMatches([])
    setAiError(null)
    setNotice('Profile applied — review and save contact')
  }

  const save = async () => {
    if (!selectedId || saving) return
    setSaving(true)
    setError(null)
    try {
      const data = await api.updateContact(selectedId, form)
      setNotice('Contact saved')
      setContacts((list) =>
        list.map((row) => (row.id === selectedId ? { ...row, ...data.contact } : row))
      )
      await refreshSavedLeads?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const openInPipeline = () => {
    if (!selectedId) return
    const leadId = pipelineLeadForContact?.id || selectedId
    openPipelineLead(leadId)
    onNavigate?.('pipeline')
  }

  const searchDirty = search.trim() !== appliedSearch

  return (
    <div className="crm-workspace flex h-full min-h-0 w-full overflow-hidden">
      <header className="crm-page-header">
        <div className="crm-page-header-top">
          <div className="min-w-0">
            <h1 className="crm-page-title">Contacts</h1>
            <p className="crm-page-subtitle hidden sm:block">
              Pipeline contacts assigned to you or saved by you.
            </p>
          </div>
        </div>

        <div className="crm-toolbar">
          <div className="crm-toolbar-row">
            <div className="crm-search-wrap">
              <svg className="crm-search-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M8.5 3a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 8.5a6.5 6.5 0 1111.436 4.23l3.07 3.07a.75.75 0 11-1.06 1.06l-3.07-3.07A6.5 6.5 0 012 8.5z"
                  clipRule="evenodd"
                />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    applySearch()
                  }
                }}
                placeholder="Search contacts…"
                className="crm-search-input"
                aria-label="Search contacts"
              />
            </div>
            <button
              type="button"
              onClick={applySearch}
              className={`crm-btn crm-btn-sm ${searchDirty ? 'crm-btn-primary' : 'crm-btn-secondary'}`}
            >
              Search
            </button>
            <span className="crm-toolbar-count crm-toolbar-count--inline">
              {loading
                ? 'Loading…'
                : `${total.toLocaleString()} contact${total === 1 ? '' : 's'}`}
              {appliedSearch ? ` · “${appliedSearch}”` : ''}
            </span>
          </div>
        </div>
      </header>

      <div className="crm-page-body">
        <div className="crm-content-card crm-split-card">
          <aside className="crm-split-sidebar">
            <div className="crm-list-header">
              <div className="flex items-center justify-between gap-2">
                <span>All contacts</span>
                <span className="crm-toolbar-count">{total.toLocaleString()}</span>
              </div>
              <p className="mt-1 text-[11px] normal-case tracking-normal font-medium text-[#7a8696]">
                Saved leads and pipeline contacts
              </p>
            </div>
            <div className="crm-list-scroll">
              {loading && !contacts.length ? (
                <LoadingExperience
                  message={LOADING_MESSAGES.contacts}
                  compact
                  fill={false}
                  className="bg-white min-h-[160px]"
                />
              ) : null}
              {contacts.map((c) => {
                const name =
                  c.fullName || [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unnamed'
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={`crm-list-item ${selectedId === c.id ? 'is-selected' : ''}`}
                  >
                    <p className="crm-list-item-name">{name}</p>
                    <p className="crm-list-item-meta">{c.company || '—'}</p>
                    {c.email && <p className="crm-list-item-sub">{c.email}</p>}
                  </button>
                )
              })}
              {!loading && !contacts.length && (
                <div className="crm-empty-state px-4 py-8">
                  <p>No contacts yet</p>
                  <p className="crm-empty-hint">
                    Add a lead in Pipeline or import a sheet — a contact record is created
                    automatically.
                  </p>
                </div>
              )}
            </div>
          </aside>

          <section className="crm-split-main">
            {!selectedId ? (
              <div className="crm-empty-state">
                <p>Select a contact</p>
                <p className="crm-empty-hint">
                  View and edit details here, or open one from Pipeline → Edit contact.
                </p>
              </div>
            ) : (
              <div className="crm-detail-pane">
                <div className="crm-detail-card crm-detail-card-wide">
                  <div className="crm-contact-hero">
                    <div className="crm-contact-avatar">
                      {([form.firstName, form.lastName]
                        .filter(Boolean)
                        .join(' ')
                        .split(' ')
                        .map((part) => part[0])
                        .join('')
                        .slice(0, 2) || 'C').toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="crm-detail-title">
                        {[form.firstName, form.lastName].filter(Boolean).join(' ') || 'Contact'}
                      </h2>
                      <p className="crm-detail-subtitle">
                        {[form.title, form.company].filter(Boolean).join(' at ') || 'No company'}
                      </p>
                      <div className="crm-contact-meta">
                        {form.email ? <span className="crm-contact-meta-pill">{form.email}</span> : null}
                        {form.phone ? <span className="crm-contact-meta-pill">{form.phone}</span> : null}
                        {selected?.industry ? (
                          <span className="crm-contact-meta-pill">{selected.industry}</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {pipelineLeadForContact ? (
                        <button
                          type="button"
                          onClick={openInPipeline}
                          className="crm-btn crm-btn-secondary"
                        >
                          Open in pipeline
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await toggleSaveLead({
                                id: selectedId,
                                ...form,
                                contactId: selectedId,
                                companyId: selected?.companyId,
                              })
                              setNotice('Added to pipeline')
                              await refreshSavedLeads?.()
                            } catch (e) {
                              setError(e.message)
                            }
                          }}
                          disabled={isSaved(selectedId)}
                          className="crm-btn crm-btn-primary"
                        >
                          {isSaved(selectedId) ? 'In pipeline' : '+ Add to pipeline'}
                        </button>
                      )}
                    </div>
                  </div>

                  {(notice || error) && (
                    <p className={`crm-alert ${error ? 'crm-alert-error' : 'crm-alert-success'}`}>
                      {error || notice}
                    </p>
                  )}

                  <div className="crm-contact-section">
                    <div className="crm-contact-section-head">
                      <div>
                        <p className="crm-field-label mb-1">Core details</p>
                        <p className="text-[11px] text-[#7a8696]">Keep contact and company details clean for campaigns and pipeline.</p>
                      </div>
                    </div>
                  <div className="crm-form-grid crm-form-grid-2">
                    <input
                      value={form.firstName}
                      onChange={(e) => setField('firstName', e.target.value)}
                      placeholder="First name"
                      className="crm-input"
                    />
                    <input
                      value={form.lastName}
                      onChange={(e) => setField('lastName', e.target.value)}
                      placeholder="Last name"
                      className="crm-input"
                    />
                  </div>
                  <div className="crm-form-grid mt-2.5">
                    <input
                      value={form.company}
                      onChange={(e) => setField('company', e.target.value)}
                      placeholder="Company"
                      className="crm-input"
                    />
                    <input
                      value={form.title}
                      onChange={(e) => setField('title', e.target.value)}
                      placeholder="Job title"
                      className="crm-input"
                    />
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setField('email', e.target.value)}
                      placeholder="Email"
                      className="crm-input"
                    />
                    <input
                      value={form.phone}
                      onChange={(e) => setField('phone', e.target.value)}
                      placeholder="Phone"
                      className="crm-input"
                    />
                    <div className="crm-form-grid crm-form-grid-2">
                      <input
                        value={form.city}
                        onChange={(e) => setField('city', e.target.value)}
                        placeholder="City"
                        className="crm-input"
                      />
                      <input
                        value={form.state}
                        onChange={(e) => setField('state', e.target.value)}
                        placeholder="State"
                        className="crm-input"
                      />
                    </div>
                    <input
                      value={form.industry}
                      onChange={(e) => setField('industry', e.target.value)}
                      placeholder="Industry"
                      className="crm-input"
                    />
                    <input
                      value={form.website}
                      onChange={(e) => setField('website', e.target.value)}
                      placeholder="Website"
                      className="crm-input"
                    />
                  </div>
                  </div>

                  <div className="crm-contact-section mt-4 space-y-2">
                    <div className="crm-contact-section-head">
                      <div>
                        <label className="crm-field-label">LinkedIn</label>
                        <p className="text-[11px] text-[#7a8696]">Find or confirm the right profile before saving the contact.</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={form.linkedin}
                        onChange={(e) => {
                          setField('linkedin', e.target.value)
                          if (e.target.value.trim()) {
                            setAiMatches([])
                            setAiError(null)
                          }
                        }}
                        placeholder="https://linkedin.com/in/…"
                        className="crm-input flex-1 min-w-0"
                      />
                      {!form.linkedin.trim() && (
                        <button
                          type="button"
                          onClick={runLinkedinAiSearch}
                          disabled={aiSearching}
                          className="crm-btn crm-btn-secondary shrink-0"
                        >
                          {aiSearching ? 'Searching…' : 'Search with AI'}
                        </button>
                      )}
                    </div>
                    {aiError && <p className="crm-alert crm-alert-error">{aiError}</p>}
                    {aiNotice && !aiMatches.length && !aiError && (
                      <p className="text-xs text-[#516f90]">{aiNotice}</p>
                    )}
                    {aiMatches.length > 0 && (
                      <div className="rounded-lg border border-[#dfe3eb] bg-[#f5f8fa] p-3 space-y-2">
                        <p className="text-xs font-semibold text-[#33475b]">
                          AI matches — pick the best profile
                        </p>
                        {aiMatches.map((match, index) => {
                          const label =
                            match.fullName ||
                            [match.firstName, match.lastName].filter(Boolean).join(' ') ||
                            'LinkedIn profile'
                          const confidence = String(match.confidence || '').toLowerCase()
                          return (
                            <div
                              key={match.id || match.linkedin || index}
                              className="bg-white border border-[#dfe3eb] rounded-lg p-3"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-[#33475b]">{label}</p>
                                  <p className="text-xs text-[#516f90] mt-0.5">
                                    {[match.title, match.company].filter(Boolean).join(' · ') ||
                                      '—'}
                                  </p>
                                  <p className="text-xs text-[#0091ae] truncate mt-1">
                                    {match.linkedin}
                                  </p>
                                  {match.reason && (
                                    <p className="text-[11px] text-[#7c98b6] mt-1 leading-snug">
                                      {match.reason}
                                    </p>
                                  )}
                                </div>
                                {confidence && (
                                  <span
                                    className={`crm-status-pill ${
                                      confidence === 'high'
                                        ? 'crm-status-active'
                                        : confidence === 'low'
                                          ? 'crm-status-draft'
                                          : 'crm-status-paused'
                                    }`}
                                  >
                                    {confidence}
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => applyLinkedinMatch(match)}
                                className="crm-link-btn mt-2 p-0"
                              >
                                Use this profile
                              </button>
                            </div>
                          )
                        })}
                        {aiNotice && (
                          <p className="text-[10px] text-[#7c98b6]">{aiNotice}</p>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    className="crm-btn crm-btn-primary w-full mt-5"
                  >
                    {saving ? 'Saving…' : 'Save contact'}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
