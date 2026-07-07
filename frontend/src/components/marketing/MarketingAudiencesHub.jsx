import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { CRM_STATUSES } from '../../lib/crmConstants'
import MarketingSegmentsPanel from './MarketingSegmentsPanel'
import MarketingListsPanel from './MarketingListsPanel'
import WhatsAppInboxPanel from './WhatsAppInboxPanel'
import LeadTag from '../ui/LeadTag'
import { ChevronRightIcon, MailIcon, NoteIcon } from '../ui/icons'

const SURVEY_TEMPLATES = [
  {
    id: 'post-purchase-10',
    category: 'Satisfaction',
    title: 'Post-purchase (1-10 scale) survey',
    desc: 'Includes an intro and 2 questions.',
  },
  {
    id: 'post-event-10',
    category: 'Satisfaction',
    title: 'Post-event (1-10 scale) survey',
    desc: 'Includes an intro and 2 questions.',
  },
  {
    id: 'growth',
    category: 'Growth strategy',
    title: 'Growth opportunities',
    desc: 'A five-question survey to identify new products or services.',
  },
  {
    id: 'attribution',
    category: 'Marketing effectiveness',
    title: 'Where did you hear about us?',
    desc: 'A simple one-question survey to assess marketing channels.',
  },
  {
    id: 'post-purchase-emoji',
    category: 'Satisfaction',
    title: 'Post-purchase emojis survey',
    desc: 'Use emojis to collect quick feedback after a purchase.',
  },
  {
    id: 'post-event-emoji',
    category: 'Satisfaction',
    title: 'Post-event emojis survey',
    desc: 'Use emojis to collect quick feedback after an event.',
  },
]

function AudienceHero({ title, description, primaryLabel, onPrimary, secondaryLabel, onSecondary, helpLabel, onHelp, illustration }) {
  return (
    <div className="mc-audience-hero">
      <div className="mc-audience-hero__inner">
        <div className="mc-audience-hero__copy">
          <h2>{title}</h2>
          <p>{description}</p>
          <div className="mc-audience-hero__actions">
            {primaryLabel ? (
              <button type="button" className="mc-btn mc-btn--primary" onClick={onPrimary}>
                {primaryLabel}
              </button>
            ) : null}
            {secondaryLabel ? (
              <button type="button" className="mc-btn mc-btn--outline" onClick={onSecondary}>
                {secondaryLabel}
              </button>
            ) : null}
          </div>
          {helpLabel ? (
            <button type="button" className="mc-audience-help-link" onClick={onHelp}>
              <NoteIcon className="mc-audience-help-link__icon" />
              {helpLabel}
            </button>
          ) : null}
        </div>
        <div className="mc-audience-hero__art" aria-hidden>
          {illustration}
        </div>
      </div>
    </div>
  )
}

function ContactsIllustration() {
  return (
    <div className="mc-audience-illus mc-audience-illus--contacts">
      <span className="mc-audience-illus__avatar" />
      <span className="mc-audience-illus__avatar" />
      <span className="mc-audience-illus__avatar" />
      <span className="mc-audience-illus__send">
        <MailIcon className="w-5 h-5" />
      </span>
    </div>
  )
}

function TagsIllustration() {
  return (
    <div className="mc-audience-illus mc-audience-illus--tags">
      <span className="mc-audience-illus__tag-icon">#</span>
      <div className="mc-audience-illus__stat-card">
        <span>42</span>
        <span>21</span>
        <span>12</span>
        <span>30</span>
      </div>
    </div>
  )
}

function SegmentsIllustration() {
  return (
    <div className="mc-audience-illus mc-audience-illus--segments">
      <div className="mc-audience-illus__profile-card">
        <span className="mc-audience-illus__profile-photo" />
        <span className="mc-audience-illus__profile-lines" />
      </div>
      <div className="mc-audience-illus__stat-card">
        <span>42</span>
        <span>21</span>
        <span>12</span>
        <span>30</span>
      </div>
    </div>
  )
}

function PreferencesIllustration() {
  return (
    <div className="mc-audience-illus mc-audience-illus--prefs">
      <div className="mc-audience-illus__pref-card">
        <span className="mc-audience-illus__pref-avatar" />
        <span className="mc-audience-illus__pref-name">Amy Wei</span>
        <span className="mc-audience-illus__pref-stars">★★★</span>
      </div>
      <div className="mc-audience-illus__pref-card">
        <span className="mc-audience-illus__pref-avatar" />
        <span className="mc-audience-illus__pref-name">Markus Okoro</span>
        <span className="mc-audience-illus__pref-stars">★★★★</span>
      </div>
      <div className="mc-audience-illus__pref-card">
        <span className="mc-audience-illus__pref-avatar" />
        <span className="mc-audience-illus__pref-name">Jamal Mann</span>
        <span className="mc-audience-illus__pref-stars">★★</span>
      </div>
    </div>
  )
}

function statusLabel(lead) {
  const id = lead?.crm?.status || lead?.status || 'new'
  return CRM_STATUSES.find((s) => s.id === id)?.label || id
}

function ContactsPage({
  totalContacts,
  savedLeads,
  lists,
  onNavigate,
  setNotice,
  showLists,
  onShowLists,
  listsPanelProps,
}) {
  const [addOpen, setAddOpen] = useState(false)
  const previewLeads = useMemo(() => (savedLeads || []).slice(0, 25), [savedLeads])

  if (showLists) {
    return (
      <div className="mc-audience-embedded">
        <button type="button" className="mc-link mc-audience-back-link" onClick={() => onShowLists(false)}>
          ← Back to contacts
        </button>
        <MarketingListsPanel {...listsPanelProps} />
      </div>
    )
  }

  return (
    <>
      <header className="mc-audience-header">
        <h1 className="mc-audience-header__title">Contacts</h1>
        <div className="mc-audience-header__actions">
          <button type="button" className="mc-audience-more-btn" aria-label="More options">
            …
          </button>
          <button
            type="button"
            className="mc-btn mc-btn--outline"
            onClick={() => onNavigate?.('pipeline')}
          >
            Open pipeline
          </button>
          <div className="mc-audience-split">
            <button
              type="button"
              className="mc-btn mc-btn--primary mc-audience-split__main"
              onClick={() => setAddOpen((v) => !v)}
            >
              Add contacts
            </button>
            <button
              type="button"
              className="mc-btn mc-btn--primary mc-audience-split__caret"
              aria-label="Add contacts options"
              onClick={() => setAddOpen((v) => !v)}
            >
              <ChevronRightIcon className="rotate-90 w-3.5 h-3.5" />
            </button>
            {addOpen ? (
              <div className="mc-audience-split__menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAddOpen(false)
                    onNavigate?.('pipeline')
                  }}
                >
                  Import from pipeline
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAddOpen(false)
                    onShowLists(true)
                  }}
                >
                  Create marketing list
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {totalContacts === 0 && !lists?.length ? (
        <AudienceHero
          title="Add your contacts"
          description="Contacts are the people who make up your audience. Import them from your CRM pipeline, or let them subscribe using a form."
          primaryLabel="Add contacts"
          onPrimary={() => onNavigate?.('pipeline')}
          secondaryLabel="Create popup form"
          onSecondary={() => onNavigate?.('marketing', { tab: 'forms' })}
          helpLabel="How to add contacts"
          onHelp={() => onNavigate?.('pipeline')}
          illustration={<ContactsIllustration />}
        />
      ) : (
        <>
          <p className="mc-audience-count">
            <strong>{totalContacts.toLocaleString()}</strong> contacts in your CRM audience
            {lists?.length ? (
              <>
                {' '}
                ·{' '}
                <button type="button" className="mc-link" onClick={() => onShowLists(true)}>
                  {lists.length} marketing list{lists.length === 1 ? '' : 's'}
                </button>
              </>
            ) : null}
          </p>
          <div className="mc-table-wrap">
            <table className="mc-table mc-audience-contacts-table">
              <thead>
                <tr>
                  <th className="mc-table__check">
                    <input type="checkbox" aria-label="Select all contacts" disabled />
                  </th>
                  <th>Email address</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Tags</th>
                </tr>
              </thead>
              <tbody>
                {previewLeads.map((lead) => (
                  <tr key={lead.id}>
                    <td className="mc-table__check">
                      <input type="checkbox" aria-label={`Select ${lead.email}`} />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="mc-templates-name-link"
                        onClick={() => onNavigate?.('pipeline', { leadId: lead.id })}
                      >
                        {lead.email || '—'}
                      </button>
                    </td>
                    <td>{lead.name || lead.company || '—'}</td>
                    <td>{statusLabel(lead)}</td>
                    <td>
                      {(lead.crm?.tagIds || []).length ? (
                        <span className="mc-audience-tag-count">{lead.crm.tagIds.length} tag(s)</span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {previewLeads.length < totalContacts ? (
              <p className="mc-audience-table-foot">
                Showing {previewLeads.length} of {totalContacts.toLocaleString()} —{' '}
                <button type="button" className="mc-link" onClick={() => onNavigate?.('pipeline')}>
                  View all in pipeline
                </button>
              </p>
            ) : null}
          </div>
        </>
      )}
    </>
  )
}

function TagsPage({ orgLeadTags, refreshOrgLeadTags, setError, setNotice, busy, setBusy, onNavigate }) {
  const [createOpen, setCreateOpen] = useState(false)
  const [tagName, setTagName] = useState('')

  const handleCreate = async () => {
    const name = tagName.trim()
    if (!name) return
    setBusy?.(true)
    try {
      await api.createOrgLeadTag({ name })
      setTagName('')
      setCreateOpen(false)
      await refreshOrgLeadTags?.()
      setNotice?.(`Tag “${name}” created`)
    } catch (e) {
      setError?.(e.message)
    } finally {
      setBusy?.(false)
    }
  }

  return (
    <>
      <header className="mc-audience-header">
        <h1 className="mc-audience-header__title">Tags</h1>
        <div className="mc-audience-header__actions">
          <button
            type="button"
            className="mc-btn mc-btn--outline"
            onClick={() => onNavigate?.('pipeline')}
          >
            Bulk tag
          </button>
          <button type="button" className="mc-btn mc-btn--primary" onClick={() => setCreateOpen(true)}>
            Create new tag
          </button>
        </div>
      </header>

      {!orgLeadTags?.length ? (
        <AudienceHero
          title="Create your first tag"
          description="Tags are static labels you apply to contacts to organize them. (Example: VIPs.) Use tags to personalize your marketing based on criteria you define."
          primaryLabel="Create tag"
          onPrimary={() => setCreateOpen(true)}
          helpLabel="About tags"
          onHelp={() => onNavigate?.('pipeline')}
          illustration={<TagsIllustration />}
        />
      ) : (
        <div className="mc-table-wrap">
          <table className="mc-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contacts</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orgLeadTags.map((tag) => (
                <tr key={tag.id}>
                  <td>
                    <LeadTag name={tag.name} color={tag.color} />
                  </td>
                  <td className="mc-audience-muted">—</td>
                  <td>
                    <button type="button" className="mc-link" onClick={() => onNavigate?.('pipeline')}>
                      Use in pipeline
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen ? (
        <div className="mc-modal" role="dialog" aria-modal="true">
          <div className="mc-modal__backdrop" onClick={() => setCreateOpen(false)} />
          <div className="mc-modal__card">
            <h3 style={{ marginTop: 0 }}>Create tag</h3>
            <div className="mc-field">
              <label htmlFor="mc-tag-name">Tag name</label>
              <input
                id="mc-tag-name"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="e.g. VIP"
                autoFocus
              />
            </div>
            <div className="mc-accordion__actions">
              <button type="button" className="mc-btn mc-btn--primary" disabled={busy} onClick={() => void handleCreate()}>
                Create tag
              </button>
              <button type="button" className="mc-btn mc-btn--ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function SegmentsPage({ segments, segmentPanelProps }) {
  const [showBuilder, setShowBuilder] = useState(Boolean(segments?.length))

  useEffect(() => {
    if (segments?.length) setShowBuilder(true)
  }, [segments?.length])

  return (
    <>
      <header className="mc-audience-header mc-audience-header--with-sub">
        <div>
          <h1 className="mc-audience-header__title">Segments</h1>
          <button type="button" className="mc-audience-help-link mc-audience-help-link--inline">
            <NoteIcon className="mc-audience-help-link__icon" />
            About Segments
          </button>
        </div>
        <button type="button" className="mc-btn mc-btn--primary" onClick={() => setShowBuilder(true)}>
          Create segment
        </button>
      </header>

      {!showBuilder ? (
        <>
          <AudienceHero
            title="Create your first segment"
            description="A segment is a dynamic set of contacts that you create. Use segments to target contacts by location, engagement, behavior, and more."
            primaryLabel="Create segment"
            onPrimary={() => setShowBuilder(true)}
            helpLabel="About segments"
            illustration={<SegmentsIllustration />}
          />
          <footer className="mc-audience-segments-foot">
            <div>
              <strong>Need help getting started?</strong>
              <p>Choose one of our pre-built segments that are based off of best practices for marketing.</p>
            </div>
            <button type="button" className="mc-link mc-audience-segments-foot__link">
              View all pre-built segments
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </footer>
        </>
      ) : (
        <div className="mc-audience-embedded">
          <MarketingSegmentsPanel
            {...segmentPanelProps}
            segments={segments}
            startCreating={!segments?.length}
          />
        </div>
      )}
    </>
  )
}

function SurveysPage({ onNavigate, setNotice }) {
  return (
    <>
      <header className="mc-audience-header">
        <h1 className="mc-audience-header__title">Surveys</h1>
        <button
          type="button"
          className="mc-btn mc-btn--primary"
          onClick={() => {
            setNotice?.('Create a survey form in Forms — then share it with your audience.')
            onNavigate?.('marketing', { tab: 'forms' })
          }}
        >
          Create new survey
        </button>
      </header>

      <section className="mc-audience-surveys-hero">
        <h2>Go from responses to results</h2>
        <p>
          Our surveys let you target, gather, and manage customer feedback that can turn reviews and
          requests into research-based products and services.
        </p>
      </section>

      <h2 className="mc-audience-section-title">Start with a template</h2>
      <div className="mc-audience-surveys-grid">
        {SURVEY_TEMPLATES.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            className="mc-audience-survey-card"
            onClick={() => {
              setNotice?.(`Starting from “${tpl.title}” — customize in Forms.`)
              onNavigate?.('marketing', { tab: 'forms' })
            }}
          >
            <span className="mc-audience-survey-card__cat">{tpl.category}</span>
            <span className="mc-audience-survey-card__title">{tpl.title}</span>
            <span className="mc-audience-survey-card__desc">{tpl.desc}</span>
          </button>
        ))}
      </div>
    </>
  )
}

function PreferencesPage({ onNavigate, setNotice }) {
  return (
    <>
      <header className="mc-audience-header">
        <h1 className="mc-audience-header__title">Subscriber preferences</h1>
      </header>
      <AudienceHero
        title="Build your preferences center"
        description="Let contacts manage their marketing preferences, and use groups to organize contacts by interest to further target your marketing."
        primaryLabel="Build preferences center"
        onPrimary={() => {
          setNotice?.('Preference groups use CRM tags and segments — set them up in Tags or Segments.')
          onNavigate?.('marketing', { tab: 'audiences', audienceTab: 'tags' })
        }}
        secondaryLabel="Add groups"
        onSecondary={() => onNavigate?.('marketing', { tab: 'audiences', audienceTab: 'tags' })}
        helpLabel="How to use groups"
        onHelp={() => onNavigate?.('marketing', { tab: 'audiences', audienceTab: 'segments' })}
        illustration={<PreferencesIllustration />}
      />
    </>
  )
}

function InboxPage({ onNavigate }) {
  return (
    <>
      <header className="mc-audience-header">
        <h1 className="mc-audience-header__title">Inbox</h1>
      </header>
      <div className="mc-audience-inbox-wrap">
        <WhatsAppInboxPanel onNavigate={onNavigate} />
      </div>
    </>
  )
}

export default function MarketingAudiencesHub(props) {
  const {
    initialTab = 'contacts',
    audienceStats = {},
    user,
    teamMembers,
    refreshTeam,
    lists,
    setLists,
    segments,
    savedLeads,
    orgLeadTags,
    refreshOrgLeadTags,
    campaigns,
    onReload,
    onNavigate,
    busy,
    setBusy,
    setError,
    setNotice,
  } = props

  const [showLists, setShowLists] = useState(false)

  useEffect(() => {
    setShowLists(false)
  }, [initialTab])

  const totalContacts =
    audienceStats.totalContacts ??
    savedLeads?.length ??
    lists?.reduce((n, l) => n + (l.memberCount || l.leadIds?.length || 0), 0) ??
    0

  const listsPanelProps = {
    user,
    teamMembers,
    refreshTeam,
    savedLeads,
    lists,
    setLists,
    busy,
    setBusy,
    setError,
    setNotice,
    onListsReload: onReload,
    orgLeadTags,
  }

  const segmentPanelProps = {
    user,
    teamMembers,
    campaigns,
    busy,
    setBusy,
    setError,
    setNotice,
    onReload,
    orgLeadTags,
  }

  const subTab = initialTab === 'studio' ? 'contacts' : initialTab

  const page = (() => {
    switch (subTab) {
      case 'tags':
        return (
          <TagsPage
            orgLeadTags={orgLeadTags}
            refreshOrgLeadTags={refreshOrgLeadTags}
            setError={setError}
            setNotice={setNotice}
            busy={busy}
            setBusy={setBusy}
            onNavigate={onNavigate}
          />
        )
      case 'segments':
        return <SegmentsPage segments={segments} segmentPanelProps={segmentPanelProps} />
      case 'inbox':
        return <InboxPage onNavigate={onNavigate} />
      case 'surveys':
      case 'preferences':
      case 'contacts':
      default:
        return (
          <ContactsPage
            totalContacts={totalContacts}
            savedLeads={savedLeads}
            lists={lists}
            onNavigate={onNavigate}
            setNotice={setNotice}
            showLists={showLists}
            onShowLists={setShowLists}
            listsPanelProps={listsPanelProps}
          />
        )
    }
  })()

  return (
    <div className="mc-page mc-audience-page">
      {page}
      <button type="button" className="mc-feedback-tab" tabIndex={-1} aria-hidden>
        Feedback
      </button>
    </div>
  )
}
