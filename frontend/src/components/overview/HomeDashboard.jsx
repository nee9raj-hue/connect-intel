import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import UniqueCustomersDashboard, {
  defaultUniqueCustomerFilters,
} from './UniqueCustomersDashboard'
import SalesPipelineSnapshot from './enterprise/SalesPipelineSnapshot'
import { dashboardNavOptions } from '../../lib/dashboardNavigation'
import '../../styles/dashboard-home.css'
import '../../styles/dashboard-enterprise.css'

function isCompanyRepUser(user) {
  if (!user || user.accountType !== 'company') return false
  if (user.isOrgAdmin || user.orgRole === 'org_admin') return false
  return String(user.pipelineRole || '').toLowerCase() !== 'manager'
}

export default function HomeDashboard({ onNavigate, isActive = true, pipelineSummary = {} }) {
  const { user, openPipelineLead, orgLeadTags, teamMembers, refreshTeam, refreshOrgLeadTags } = useApp()
  const [filters, setFilters] = useState(defaultUniqueCustomerFilters)
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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

  useEffect(() => {
    if (!isActive) return undefined
    load()
    return undefined
  }, [isActive, load])

  useEffect(() => {
    if (isActive) {
      void refreshTeam?.()
      void refreshOrgLeadTags?.()
    }
  }, [isActive, refreshTeam, refreshOrgLeadTags])

  const patchFilters = useCallback((partial) => {
    setFilters((prev) => ({ ...prev, ...partial }))
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

  const ps = pipelineSummary || {}

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
          total={ps.leadCount}
          role={isCompanyRepUser(user) ? 'rep' : role}
          onStageClick={runPipeline}
        />
      </div>
    </div>
  )
}
