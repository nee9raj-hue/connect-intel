import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import UniqueCustomersDashboard, {
  defaultUniqueCustomerFilters,
} from './UniqueCustomersDashboard'
import RetentionOnboardingDashboard, {
  defaultRetentionFilters,
} from './RetentionOnboardingDashboard'
import SalesPipelineSnapshot from './enterprise/SalesPipelineSnapshot'
import { dashboardNavOptions } from '../../lib/dashboardNavigation'
import { CRM_STATUSES } from '../../lib/crmConstants'
import { pipelineCountsFromSummary } from '../../lib/navConfig'
import '../../styles/dashboard-home.css'
import '../../styles/dashboard-enterprise.css'

function isCompanyRepUser(user) {
  if (!user || user.accountType !== 'company') return false
  if (user.isOrgAdmin || user.orgRole === 'org_admin') return false
  return String(user.pipelineRole || '').toLowerCase() !== 'manager'
}

function flattenOrgTeams(hierarchy) {
  return (hierarchy?.departments || []).flatMap((dept) =>
    (dept.teams || []).map((team) => ({
      value: String(team.id),
      label: dept.name ? `${team.name} (${dept.name})` : team.name,
    }))
  )
}

function salesPipelineSnapshotFromSummary(pipelineSummary) {
  if (Array.isArray(pipelineSummary?.stages) && pipelineSummary.stages.length) {
    return {
      stages: pipelineSummary.stages,
      total: Number(pipelineSummary.leadCount ?? pipelineSummary.total) || 0,
    }
  }
  const counts = pipelineCountsFromSummary(pipelineSummary, [])
  const total = Number(pipelineSummary?.leadCount ?? pipelineSummary?.total ?? counts.all) || 0
  const stages = CRM_STATUSES.map((s) => ({
    id: s.id,
    count: counts[s.id] || 0,
    pct: total ? Math.round(((counts[s.id] || 0) / total) * 100) : 0,
  }))
  return { stages, total }
}

export default function HomeDashboard({ onNavigate, isActive = true, pipelineSummary = {} }) {
  const { user, openPipelineLead, orgLeadTags, teamMembers, refreshTeam, refreshOrgLeadTags } = useApp()
  const [filters, setFilters] = useState(defaultUniqueCustomerFilters)
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [retentionFilters, setRetentionFilters] = useState(defaultRetentionFilters)
  const [retentionReport, setRetentionReport] = useState(null)
  const [retentionLoading, setRetentionLoading] = useState(true)
  const [retentionError, setRetentionError] = useState(null)
  const [teamOptions, setTeamOptions] = useState([])

  const role = user?.isOrgAdmin || user?.orgRole === 'org_admin'
    ? 'org_admin'
    : String(user?.pipelineRole || '').toLowerCase() === 'manager'
      ? 'manager'
      : 'rep'

  const tagOptions = useMemo(
    () => (orgLeadTags || []).map((t) => ({ value: String(t.id), label: t.name || t.label || t.id })),
    [orgLeadTags]
  )
  const ownerOptions = useMemo(() => {
    const rows = teamMembers || []
    return rows.map((m) => ({
      value: String(m.userId),
      label: m.name || m.email || 'Team member',
    }))
  }, [teamMembers])

  const query = useMemo(() => {
    const qs = new URLSearchParams()
    if (filters.year) qs.set('year', filters.year)
    if (filters.month) qs.set('month', filters.month)
    if (filters.weeks.length) qs.set('weeks', filters.weeks.join(','))
    if (filters.tagIds.length) qs.set('tagIds', filters.tagIds.join(','))
    if (filters.statuses.length) qs.set('statuses', filters.statuses.join(','))
    if (filters.ownerIds.length) qs.set('ownerIds', filters.ownerIds.join(','))
    return qs.toString()
  }, [filters])

  const retentionQuery = useMemo(() => {
    const qs = new URLSearchParams()
    if (retentionFilters.year) qs.set('year', retentionFilters.year)
    if (retentionFilters.month) qs.set('month', retentionFilters.month)
    if (retentionFilters.weeks.length) qs.set('weeks', retentionFilters.weeks.join(','))
    if (retentionFilters.ownerIds.length) qs.set('ownerIds', retentionFilters.ownerIds.join(','))
    if (retentionFilters.teamIds.length) qs.set('teamIds', retentionFilters.teamIds.join(','))
    return qs.toString()
  }, [retentionFilters])

  const load = useCallback(async () => {
    if (!isActive) return
    setLoading(true)
    setError(null)
    try {
      const data = await api.getCrmUniqueCustomers(query)
      setReport(data)
    } catch (e) {
      setError(e.message || 'Could not load unique customers')
    } finally {
      setLoading(false)
    }
  }, [isActive, query])

  const loadRetention = useCallback(async () => {
    if (!isActive) return
    setRetentionLoading(true)
    setRetentionError(null)
    try {
      const data = await api.getCrmOnboardingRetention(retentionQuery)
      setRetentionReport(data)
    } catch (e) {
      setRetentionError(e.message || 'Could not load onboarding retention')
    } finally {
      setRetentionLoading(false)
    }
  }, [isActive, retentionQuery])

  useEffect(() => {
    if (!isActive) return undefined
    load()
    return undefined
  }, [isActive, load])

  useEffect(() => {
    if (!isActive) return undefined
    loadRetention()
    return undefined
  }, [isActive, loadRetention])

  useEffect(() => {
    if (!isActive) return undefined
    void refreshTeam?.()
    void refreshOrgLeadTags?.()
    let cancelled = false
    api
      .getOrgHierarchy({ skipLeadCounts: true, silent: true })
      .then((data) => {
        if (!cancelled) setTeamOptions(flattenOrgTeams(data))
      })
      .catch(() => {
        if (!cancelled) setTeamOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [isActive, refreshTeam, refreshOrgLeadTags])

  const patchFilters = useCallback((partial) => {
    setFilters((prev) => ({ ...prev, ...partial }))
  }, [])

  const patchRetentionFilters = useCallback((partial) => {
    setRetentionFilters((prev) => ({ ...prev, ...partial }))
  }, [])

  const onLead = useCallback(
    (leadId) => {
      if (!leadId) return
      openPipelineLead(leadId)
      onNavigate?.('pipeline', { returnTo: 'overview' })
    },
    [openPipelineLead, onNavigate]
  )

  const runPipeline = useCallback(
    (action = {}) => {
      const opts = dashboardNavOptions({ ...action, returnTo: action.returnTo || 'overview' }, user)
      onNavigate?.(action.panel || 'pipeline', opts)
    },
    [onNavigate, user]
  )

  const ps = salesPipelineSnapshotFromSummary(pipelineSummary)

  return (
    <div className="dash-home dash-home--enterprise">
      <div className="dash-home__inner dash-home__inner--wide">
        <UniqueCustomersDashboard
          report={report}
          loading={loading}
          error={error}
          filters={filters}
          onChangeFilters={patchFilters}
          tagOptions={tagOptions}
          ownerOptions={ownerOptions}
          onRetry={load}
          onOpenLead={onLead}
        />

        <SalesPipelineSnapshot
          stages={ps.stages}
          total={ps.total}
          role={isCompanyRepUser(user) ? 'rep' : role}
          onStageClick={runPipeline}
        />

        <RetentionOnboardingDashboard
          report={retentionReport}
          loading={retentionLoading}
          error={retentionError}
          filters={retentionFilters}
          onChangeFilters={patchRetentionFilters}
          ownerOptions={ownerOptions}
          teamOptions={teamOptions}
          onRetry={loadRetention}
        />
      </div>
    </div>
  )
}
