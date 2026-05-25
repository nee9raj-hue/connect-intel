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

  const loadList = useCallback(async (q = search) => {
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
  }, [search])

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

  return (
    <div className="panel-shell bg-[#f6f7f9]">
      <header className="shrink-0 bg-white border-b border-gray-200 px-5 py-4">
        <h1 className="text-lg font-semibold text-gray-900">Contacts</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Customers on <strong>your pipeline</strong> only (assigned to you or saved by you). Company admins see
          the full team pipeline.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadList(search)}
            placeholder="Search name, company, email…"
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
          />
          <button
            type="button"
            onClick={() => loadList(search)}
            className="text-sm font-semibold px-4 py-2 bg-gray-900 text-white rounded-lg"
          >
            Search
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <aside className="w-full md:w-[300px] shrink-0 border-r border-gray-200 bg-white flex flex-col min-h-0">
          <div className="px-3 py-2 border-b text-[11px] text-gray-500 font-medium">
            {loading ? 'Loading…' : `${total} contact${total === 1 ? '' : 's'}`}
          </div>
          <ul className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {loading && !contacts.length ? (
              <li className="flex-1 min-h-[160px]">
                <LoadingExperience message={LOADING_MESSAGES.contacts} compact fill={false} className="bg-white" />
              </li>
            ) : null}
            {contacts.map((c) => {
              const name = c.fullName || [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unnamed'
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 ${
                      selectedId === c.id ? 'bg-[#fffbeb] border-l-2 border-[#ffcb2b]' : ''
                    }`}
                  >
                    <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                    <p className="text-xs text-gray-600 truncate">{c.company || '—'}</p>
                    {c.email && <p className="text-[11px] text-gray-400 truncate mt-0.5">{c.email}</p>}
                  </button>
                </li>
              )
            })}
            {!loading && !contacts.length && (
              <li className="px-3 py-8 text-center text-xs text-gray-500">
                No contacts yet. Add a lead in Pipeline or import a sheet — a contact record is created automatically.
              </li>
            )}
          </ul>
        </aside>

        <section className="flex-1 min-w-0 overflow-y-auto p-5">
          {!selectedId ? (
            <div className="max-w-md mx-auto mt-16 text-center text-sm text-gray-500">
              Select a contact to view and edit details, or open one from Pipeline → Edit contact.
            </div>
          ) : (
            <div className="max-w-lg mx-auto bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">
                    {[form.firstName, form.lastName].filter(Boolean).join(' ') || 'Contact'}
                  </h2>
                  <p className="text-xs text-gray-500">{form.company || 'No company'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {pipelineLeadForContact ? (
                    <button
                      type="button"
                      onClick={openInPipeline}
                      className="text-xs font-semibold px-2.5 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50"
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
                      className="text-xs font-semibold px-2.5 py-1.5 bg-[#ffcb2b] text-[#242424] rounded-lg disabled:opacity-50"
                    >
                      {isSaved(selectedId) ? 'In pipeline' : '+ Add to pipeline'}
                    </button>
                  )}
                </div>
              </div>

              {(notice || error) && (
                <p
                  className={`text-xs rounded-lg px-2 py-1.5 ${
                    error ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'
                  }`}
                >
                  {error || notice}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2">
                <input
                  value={form.firstName}
                  onChange={(e) => setField('firstName', e.target.value)}
                  placeholder="First name"
                  className="text-sm border rounded-lg px-3 py-2"
                />
                <input
                  value={form.lastName}
                  onChange={(e) => setField('lastName', e.target.value)}
                  placeholder="Last name"
                  className="text-sm border rounded-lg px-3 py-2"
                />
              </div>
              <input
                value={form.company}
                onChange={(e) => setField('company', e.target.value)}
                placeholder="Company"
                className="w-full text-sm border rounded-lg px-3 py-2"
              />
              <input
                value={form.title}
                onChange={(e) => setField('title', e.target.value)}
                placeholder="Job title"
                className="w-full text-sm border rounded-lg px-3 py-2"
              />
              <input
                type="email"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                placeholder="Email"
                className="w-full text-sm border rounded-lg px-3 py-2"
              />
              <input
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
                placeholder="Phone"
                className="w-full text-sm border rounded-lg px-3 py-2"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={form.city}
                  onChange={(e) => setField('city', e.target.value)}
                  placeholder="City"
                  className="text-sm border rounded-lg px-3 py-2"
                />
                <input
                  value={form.state}
                  onChange={(e) => setField('state', e.target.value)}
                  placeholder="State"
                  className="text-sm border rounded-lg px-3 py-2"
                />
              </div>
              <input
                value={form.industry}
                onChange={(e) => setField('industry', e.target.value)}
                placeholder="Industry"
                className="w-full text-sm border rounded-lg px-3 py-2"
              />
              <input
                value={form.website}
                onChange={(e) => setField('website', e.target.value)}
                placeholder="Website"
                className="w-full text-sm border rounded-lg px-3 py-2"
              />
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-gray-500">LinkedIn</label>
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
                    className="flex-1 min-w-0 text-sm border rounded-lg px-3 py-2"
                  />
                  {!form.linkedin.trim() && (
                    <button
                      type="button"
                      onClick={runLinkedinAiSearch}
                      disabled={aiSearching}
                      className="shrink-0 text-xs font-semibold px-3 py-2 rounded-lg border border-[#ffcb2b] bg-[#fffbeb] text-[#5b4a00] hover:bg-[#fff4cc] disabled:opacity-50 whitespace-nowrap"
                    >
                      {aiSearching ? 'Searching…' : 'Search with AI'}
                    </button>
                  )}
                </div>
                {aiError && (
                  <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">
                    {aiError}
                  </p>
                )}
                {aiNotice && !aiMatches.length && !aiError && (
                  <p className="text-xs text-gray-600">{aiNotice}</p>
                )}
                {aiMatches.length > 0 && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 space-y-2">
                    <p className="text-[11px] font-semibold text-gray-700">
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
                          className="bg-white border border-gray-200 rounded-lg p-2.5 text-left"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900">{label}</p>
                              <p className="text-xs text-gray-600 mt-0.5">
                                {[match.title, match.company].filter(Boolean).join(' · ') || '—'}
                              </p>
                              <p className="text-[11px] text-blue-700 truncate mt-1">{match.linkedin}</p>
                              {match.reason && (
                                <p className="text-[11px] text-gray-500 mt-1 leading-snug">{match.reason}</p>
                              )}
                            </div>
                            {confidence && (
                              <span
                                className={`shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                  confidence === 'high'
                                    ? 'bg-green-100 text-green-800'
                                    : confidence === 'low'
                                      ? 'bg-gray-100 text-gray-600'
                                      : 'bg-amber-100 text-amber-900'
                                }`}
                              >
                                {confidence}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => applyLinkedinMatch(match)}
                            className="mt-2 text-xs font-semibold text-[#5b4a00] hover:underline"
                          >
                            Use this profile
                          </button>
                        </div>
                      )
                    })}
                    {aiNotice && <p className="text-[10px] text-gray-500">{aiNotice}</p>}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="w-full py-2.5 text-sm font-semibold bg-gray-900 text-white rounded-lg disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save contact'}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
