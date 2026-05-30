import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import LoadingExperience from '../ui/LoadingExperience'
import FullScreenDetailModal from '../ui/FullScreenDetailModal'
import ContactDetailEditor from './ContactDetailEditor'
import PipelineBulkActionsBar from '../crm/PipelineBulkActionsBar'
import BulkLeadTagsModal from '../crm/BulkLeadTagsModal'
import { LOADING_MESSAGES } from '../../lib/loadingQuotes'
import useIsMobile from '../../hooks/useIsMobile'

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
    orgLeadTags,
    bulkUpdatePipeline,
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
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [bulkTagsOpen, setBulkTagsOpen] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkNotice, setBulkNotice] = useState(null)
  const isMobile = useIsMobile()

  const leadByContactId = useMemo(() => {
    const map = new Map()
    for (const lead of savedLeads) {
      if (lead.contactId) map.set(lead.contactId, lead)
      map.set(lead.id, lead)
    }
    return map
  }, [savedLeads])

  const selectedLeads = useMemo(
    () =>
      [...selectedIds]
        .map((id) => leadByContactId.get(id))
        .filter(Boolean),
    [selectedIds, leadByContactId]
  )

  const selectedLeadIds = useMemo(() => selectedLeads.map((l) => l.id), [selectedLeads])

  useEffect(() => {
    if (!bulkNotice) return undefined
    const timer = setTimeout(() => setBulkNotice(null), 5000)
    return () => clearTimeout(timer)
  }, [bulkNotice])

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

  const closeContact = () => {
    setSelectedId(null)
    setError(null)
    setNotice(null)
  }

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

  const contactTitle =
    [form.firstName, form.lastName].filter(Boolean).join(' ') || 'Contact details'

  const buildLinkedinSearchPayload = () => {
    const lead = pipelineLeadForContact?.lead || {}
    const pick = (primary, ...fallbacks) => {
      const value = String(primary || '').trim()
      if (value) return value
      for (const entry of fallbacks) {
        const next = String(entry || '').trim()
        if (next) return next
      }
      return ''
    }
    return {
      firstName: pick(form.firstName, lead.firstName, lead.first_name),
      lastName: pick(form.lastName, lead.lastName, lead.last_name),
      title: pick(form.title, lead.title),
      company: pick(form.company, lead.company),
      email: pick(form.email, lead.email),
      phone: pick(form.phone, lead.phone),
      city: pick(form.city, lead.city),
      state: pick(form.state, lead.state),
      industry: pick(form.industry, lead.industry),
      website: pick(form.website, lead.companyDomain, lead.website),
    }
  }

  const applySearch = () => {
    setAppliedSearch(search.trim())
  }

  const runLinkedinAiSearch = async () => {
    if (!selectedId || aiSearching) return
    const payload = buildLinkedinSearchPayload()
    const hasHint =
      payload.firstName || payload.lastName || payload.company || payload.email
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
      const data = await api.searchContactLinkedin(selectedId, payload)
      setAiMatches(data.matches || [])
      const sourceNote = data.provider ? `Sources: ${data.provider}. ` : ''
      setAiNotice(data.notice ? `${sourceNote}${data.notice}` : sourceNote || null)
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

  const handleToggleSaveLead = async () => {
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
  }

  const editorProps = {
    form,
    setField,
    selected,
    pipelineLeadForContact,
    notice,
    error,
    aiSearching,
    aiMatches,
    aiError,
    aiNotice,
    isSaved,
    selectedId,
    onOpenInPipeline: openInPipeline,
    onToggleSaveLead: handleToggleSaveLead,
    onLinkedinAiSearch: runLinkedinAiSearch,
    onApplyLinkedinMatch: applyLinkedinMatch,
    onSave: save,
    saving,
  }

  const searchDirty = search.trim() !== appliedSearch

  const toggleContactSelect = (contactId, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(contactId)
      else next.delete(contactId)
      return next
    })
  }

  const selectAllVisibleContacts = (checked) => {
    if (checked) setSelectedIds(new Set(contacts.map((c) => c.id)))
    else setSelectedIds(new Set())
  }

  const runBulkTags = async (actions) => {
    if (!selectedLeadIds.length) {
      window.alert('Selected contacts are not in your pipeline yet. Add them to pipeline first.')
      return
    }
    const skipped = selectedIds.size - selectedLeadIds.length
    setBulkBusy(true)
    setBulkNotice(null)
    try {
      await bulkUpdatePipeline(selectedLeadIds, actions)
      await refreshSavedLeads()
      const count = selectedLeadIds.length
      setBulkNotice(
        skipped > 0
          ? `Tags updated on ${count} contact${count === 1 ? '' : 's'} (${skipped} skipped — not in pipeline).`
          : count === 1
            ? 'Tags updated on 1 contact.'
            : `Tags updated on ${count} contacts.`
      )
      setSelectedIds(new Set())
      setBulkTagsOpen(false)
    } catch (e) {
      window.alert(e.message || 'Bulk tag update failed')
    } finally {
      setBulkBusy(false)
    }
  }

  const allVisibleSelected =
    contacts.length > 0 && contacts.every((c) => selectedIds.has(c.id))

  return (
    <div className="crm-workspace hs-canvas flex h-full min-h-0 w-full overflow-hidden">
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
        <div className="crm-content-card flex-1 min-h-0 flex flex-col">
          {selectedIds.size > 0 && (
            <PipelineBulkActionsBar
              count={selectedIds.size}
              busy={bulkBusy}
              recordLabel="contact"
              showAssign={false}
              showEdit={false}
              showEmail={false}
              showWhatsApp={false}
              showMore={false}
              onTags={
                orgLeadTags?.length
                  ? () => {
                      if (!selectedLeadIds.length) {
                        window.alert(
                          'None of the selected contacts are in your pipeline yet. Add them to pipeline first, then tag in bulk.'
                        )
                        return
                      }
                      setBulkTagsOpen(true)
                    }
                  : undefined
              }
              onClear={() => setSelectedIds(new Set())}
            />
          )}
          {bulkNotice && (
            <div
              className="shrink-0 mx-2 md:mx-4 mb-1 text-xs md:text-sm font-medium text-green-900 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5 md:px-3 md:py-2"
              role="status"
            >
              {bulkNotice}
            </div>
          )}
          <div className="crm-split-card flex-1 min-h-0">
          <aside className="crm-split-sidebar">
            <div className="crm-list-header">
              <div className="flex items-center justify-between gap-2">
                <label className="crm-list-select-all flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(e) => selectAllVisibleContacts(e.target.checked)}
                    aria-label="Select all visible contacts"
                    className="pipeline-hs-checkbox"
                  />
                  <span className="truncate">All contacts</span>
                </label>
                <span className="crm-toolbar-count">{total.toLocaleString()}</span>
              </div>
              <p className="mt-1 text-xs normal-case tracking-normal font-medium text-[#7a8696]">
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
                const rowSelected = selectedId === c.id
                const checked = selectedIds.has(c.id)
                return (
                  <div
                    key={c.id}
                    className={`crm-list-item-row ${rowSelected ? 'is-selected' : ''} ${checked ? 'is-checked' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => toggleContactSelect(c.id, e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select ${name}`}
                      className="pipeline-hs-checkbox crm-list-item-check"
                    />
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={`crm-list-item crm-list-item--flex ${rowSelected ? 'is-selected' : ''}`}
                    >
                      <p className="crm-list-item-name">{name}</p>
                      <p className="crm-list-item-meta">{c.company || '—'}</p>
                      {c.email && <p className="crm-list-item-sub">{c.email}</p>}
                    </button>
                  </div>
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

          {!isMobile && (
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
                  <ContactDetailEditor {...editorProps} showInlineSave />
                </div>
              )}
            </section>
          )}
          </div>
        </div>
      </div>

      <BulkLeadTagsModal
        open={bulkTagsOpen}
        count={selectedLeadIds.length || selectedIds.size}
        leads={selectedLeads}
        orgLeadTags={orgLeadTags}
        busy={bulkBusy}
        recordLabel="contact"
        onClose={() => setBulkTagsOpen(false)}
        onSubmit={runBulkTags}
      />

      {isMobile && selectedId ? (
        <FullScreenDetailModal
          open
          onClose={closeContact}
          title={contactTitle}
          subtitle={[form.title, form.company].filter(Boolean).join(' at ') || undefined}
          footer={
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="crm-btn crm-btn-primary w-full"
            >
              {saving ? 'Saving…' : 'Save contact'}
            </button>
          }
        >
          <ContactDetailEditor {...editorProps} showInlineSave={false} />
        </FullScreenDetailModal>
      ) : null}
    </div>
  )
}
