import { useMemo, useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { pipelineCountsFromSummary } from '../../lib/navConfig'
import { useGmailOnboardingConfig } from '../../lib/gmailOnboarding'
import { loadChromeExtensionDistribution, openChromeWebStore } from '../../lib/chromeExtension'

const DISMISS_PREFIX = 'ci_crm_setup_dismissed_'

function pipelineRoleLabel(user) {
  if (user?.isOrgAdmin || user?.orgRole === 'org_admin') return 'Admin'
  const pr = String(user?.pipelineRole || '').toLowerCase()
  if (pr === 'manager') return 'Manager'
  return 'Sales rep'
}

export default function CrmGettingStarted({ onNavigate, pipelineSummary }) {
  const { user, teamMembers } = useApp()
  const orgId = user?.organizationId
  const dismissKey = orgId ? `${DISMISS_PREFIX}${orgId}` : null
  const [dismissed, setDismissed] = useState(() => {
    if (!dismissKey || typeof window === 'undefined') return false
    return window.localStorage.getItem(dismissKey) === '1'
  })
  const [extensionStoreUrl, setExtensionStoreUrl] = useState(null)
  const { promptEnabled: gmailOnboardingEnabled } = useGmailOnboardingConfig()

  useEffect(() => {
    loadChromeExtensionDistribution()
      .then((dist) => setExtensionStoreUrl(dist.storeUrl))
      .catch(() => {})
  }, [])

  const leadCount = useMemo(() => {
    const counts = pipelineCountsFromSummary(pipelineSummary, [])
    return counts.all || 0
  }, [pipelineSummary])

  const memberCount = teamMembers?.filter((m) => m.status !== 'inactive')?.length || 0
  const isAdmin = Boolean(user?.isOrgAdmin)

  const gmailStep = (forAdmin) => ({
    id: 'gmail',
    title: 'Connect work Gmail (optional)',
    detail: forAdmin
      ? 'Link work email when your team is ready to send and receive from the CRM.'
      : 'Only needed when you want to send email from lead records.',
    done: false,
    optional: true,
    action: { panel: forAdmin ? 'team' : 'my-email', teamTab: forAdmin ? 'integrations' : undefined },
    cta: 'Work email',
  })

  const steps = useMemo(() => {
    if (isAdmin) {
      return [
        {
          id: 'invite',
          title: 'Invite your team',
          detail: 'Reps join via email invite — same @company domain does not auto-join.',
          done: memberCount > 1,
          action: { panel: 'team', teamTab: 'members' },
          cta: 'Open team',
        },
        {
          id: 'import',
          title: 'Add leads to Pipeline',
          detail: 'Import CSV or add leads manually — this is your single source of truth.',
          done: leadCount > 0,
          action: { panel: 'pipeline', status: 'all' },
          cta: 'Open pipeline',
        },
        {
          id: 'extension',
          title: 'Install Chrome extension',
          detail: extensionStoreUrl
            ? 'Primary path for Gmail trail sync, send-and-log, and LinkedIn capture while web Gmail OAuth is deferred.'
            : 'Load unpacked from the repo extension/ folder, or install from Chrome Web Store when published.',
          done: false,
          optional: false,
          externalUrl: extensionStoreUrl,
          action: { panel: 'team', teamTab: 'integrations' },
          cta: extensionStoreUrl ? 'Install' : 'Integrations',
        },
        ...(gmailOnboardingEnabled ? [gmailStep(true)] : []),
        {
          id: 'calendar',
          title: 'Plan follow-ups',
          detail: 'Tasks and meetings live on Calendar and each lead.',
          done: false,
          optional: true,
          action: { panel: 'crm-calendar' },
          cta: 'Calendar',
        },
      ]
    }
    return [
      {
        id: 'pipeline',
        title: 'Review your leads',
        detail: 'Work assigned leads in Pipeline — tasks and status in one place.',
        done: leadCount > 0,
        action: { panel: 'pipeline', status: 'all', scopeOwner: 'me' },
        cta: 'My pipeline',
      },
      {
        id: 'extension',
        title: 'Install Chrome extension',
        detail: extensionStoreUrl
          ? 'Use Gmail trail sync and send-and-log from your browser — recommended until in-app Gmail connect returns.'
          : 'Ask your admin for the Web Store link, or use Team → Integrations for setup.',
        done: false,
        optional: false,
        externalUrl: extensionStoreUrl,
        action: { panel: 'team', teamTab: 'integrations' },
        cta: extensionStoreUrl ? 'Install' : 'Integrations',
      },
      ...(gmailOnboardingEnabled ? [gmailStep(false)] : []),
      {
        id: 'calendar',
        title: 'Check today’s calendar',
        detail: 'Meetings and tasks due today.',
        done: false,
        optional: true,
        action: { panel: 'crm-calendar', upcomingOnly: true },
        cta: 'Calendar',
      },
    ]
  }, [isAdmin, memberCount, leadCount, extensionStoreUrl, gmailOnboardingEnabled])

  const requiredSteps = steps.filter((s) => !s.optional)
  const doneCount = requiredSteps.filter((s) => s.done).length
  const allDone = doneCount >= requiredSteps.length

  if (!user || user.isPlatformAdmin || dismissed || allDone) return null

  const dismiss = () => {
    if (dismissKey) window.localStorage.setItem(dismissKey, '1')
    setDismissed(true)
  }

  return (
    <section className="dash-home__card dash-home__card--setup mb-4">
      <div className="dash-home__card-head">
        <div>
          <h3 className="dash-home__card-title">Get started with CRM</h3>
          <p className="dash-home__card-sub">
            {user.organizationName || 'Your workspace'} · {pipelineRoleLabel(user)} · {doneCount} of{' '}
            {requiredSteps.length} complete
          </p>
        </div>
        <button type="button" className="dash-home__link" onClick={dismiss}>
          Dismiss
        </button>
      </div>
      <ul className="dash-home__setup-list">
        {steps.map((step) => (
          <li key={step.id} className={`dash-home__setup-row${step.done ? ' is-done' : ''}`}>
            <span className="dash-home__setup-check" aria-hidden>
              {step.done ? '✓' : '○'}
            </span>
            <div className="dash-home__setup-body">
              <strong>{step.title}</strong>
              <span>{step.detail}</span>
            </div>
            <button
              type="button"
              className="dash-home__link shrink-0"
              onClick={() => {
                if (step.externalUrl) {
                  openChromeWebStore(step.externalUrl)
                  return
                }
                onNavigate?.(step.action.panel, step.action)
              }}
            >
              {step.cta} →
            </button>
          </li>
        ))}
      </ul>
      {!isAdmin && user?.accountType === 'company' && (
        <p className="dash-home__card-sub mt-3 text-[#64748b]">
          Joining {user.organizationName || 'your company'}? Use the invite link from your admin — signing up as
          Company again creates a separate workspace.
        </p>
      )}
    </section>
  )
}
