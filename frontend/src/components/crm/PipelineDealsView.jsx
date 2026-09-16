import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { getDealStageMeta } from '../../lib/crmConstants'
import {
  freightRouteLabel,
  formatDealValue,
  formatFreightGross,
  transportModeLabel,
  freightCustomerTypeLabel,
  summarizePipelineDealRows,
} from '../../lib/freightDeals'
import { estimatedFreightRevenueInr, sumEstimatedFreightRevenue, FREIGHT_DEAL_STAGES, resolveFreightDealCurrency, FALLBACK_USD_INR, isFreightDealOrg } from '../../lib/freightDeal'
import { userCanDeleteCrmRecords } from '../../lib/orgActionAccess'
import {
  DEAL_MONTH_OPTIONS,
  DEAL_TRANSPORT_FILTERS,
  dealYearOptions,
  dealYearsFromRows,
  filterPipelineDealRows,
  formatDealPeriodLabel,
  isoWeeksOverlappingMonth,
} from '../../lib/pipelineDealsFilter'
import { DashboardSegmented } from '../dashboard/dashboardUi'
import FilterDropdown from './FilterDropdown'
import SaveReportModal from './SaveReportModal'

function formatWeight(freight) {
  return formatFreightGross(freight)
}

function dealRowKey({ leadId, deal }) {
  return `${leadId}:${deal.id}`
}

/** Pipeline view — all freight deals across leads, filterable by deal stage. */
export default function PipelineDealsView({
  dealStage = 'all',
  onOpenLead,
  onDealStageChange,
  assigneeFilter = null,
}) {
  const { refreshSavedLeads, refreshPipelineSummary, user } = useApp()
  const freightOrg = isFreightDealOrg(user)
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(() => new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const [exportBusy, setExportBusy] = useState(false)
  const [saveReportOpen, setSaveReportOpen] = useState(false)
  const [savedReports, setSavedReports] = useState([])
  const [periodYear, setPeriodYear] = useState('')
  const [periodMonth, setPeriodMonth] = useState('')
  const [selectedWeeks, setSelectedWeeks] = useState([])
  const [transportMode, setTransportMode] = useState('all')
  const [selectedStages, setSelectedStages] = useState([])
  const [usdInrRate, setUsdInrRate] = useState(FALLBACK_USD_INR)

  const timeZone = user?.timezone || undefined

  const isAllDealsView = dealStage === 'all'

  const filteredRows = useMemo(
    () =>
      filterPipelineDealRows(rows, {
        year: periodYear,
        month: periodMonth,
        weeks: selectedWeeks,
        transportMode,
        stages: isAllDealsView ? selectedStages : [],
        dateStages: isAllDealsView ? selectedStages : [dealStage],
        timeZone,
      }),
    [rows, periodYear, periodMonth, selectedWeeks, transportMode, selectedStages, isAllDealsView, timeZone]
  )

  const estimatedRevenueTotal = useMemo(
    () => Math.round(sumEstimatedFreightRevenue(filteredRows, usdInrRate)),
    [filteredRows, usdInrRate]
  )

  const summary = useMemo(
    () => summarizePipelineDealRows(filteredRows, { usdInrRate }),
    [filteredRows, usdInrRate]
  )

  const filtersActive =
    Boolean(periodYear) ||
    transportMode !== 'all' ||
    (isAllDealsView && selectedStages.length > 0)
  const rangeLabel = formatDealPeriodLabel({
    year: periodYear,
    month: periodMonth,
    weeks: selectedWeeks,
  })

  const stageMeta = useMemo(() => {
    if (dealStage === 'all') return { label: 'All Deals' }
    return getDealStageMeta(dealStage, { freightOrg: true })
  }, [dealStage])

  const canExportDeals =
    !user?.organizationId ||
    user?.accountType !== 'company' ||
    !user?.orgPermissions ||
    Boolean(user.orgPermissions.export_leads)
  const canDeleteDeals = userCanDeleteCrmRecords(user)

  const serverFilters = useMemo(
    () => ({
      dealStage,
      assigneeUserId: assigneeFilter || null,
      transportMode,
      year: periodYear || null,
      month: periodMonth || null,
      weeks: selectedWeeks.length ? selectedWeeks : null,
    }),
    [dealStage, assigneeFilter, transportMode, periodYear, periodMonth, selectedWeeks]
  )

  const filterSummary = useMemo(() => {
    const parts = [stageMeta.label]
    if (rangeLabel) parts.push(rangeLabel)
    if (transportMode !== 'all') {
      const mode = DEAL_TRANSPORT_FILTERS.find((opt) => opt.id === transportMode)
      if (mode) parts.push(mode.label)
    }
    if (isAllDealsView && selectedStages.length > 0) {
      const labels = FREIGHT_DEAL_STAGES.filter((s) => selectedStages.includes(s.id)).map((s) => s.label)
      if (labels.length) parts.push(labels.join(', '))
    }
    if (assigneeFilter) parts.push('Assigned filter')
    return parts.join(' · ')
  }, [stageMeta.label, rangeLabel, transportMode, assigneeFilter, isAllDealsView, selectedStages])

  const runExport = useCallback(async () => {
    if (!canExportDeals || exportBusy) return
    setExportBusy(true)
    setError(null)
    try {
      const result = await api.exportDealsReport(serverFilters, { timeZone, timeoutMs: 120_000 })
      setNotice(`Exported ${result.rowCount || 0} deal${result.rowCount === 1 ? '' : 's'}`)
    } catch (e) {
      setError(e.message || 'Export failed')
    } finally {
      setExportBusy(false)
    }
  }, [canExportDeals, exportBusy, serverFilters, timeZone])

  const runSavedReportExport = useCallback(
    async (report) => {
      if (!canExportDeals || exportBusy) return
      setExportBusy(true)
      setError(null)
      try {
        const result = await api.exportDealsReport({}, { reportId: report.id, timeZone, timeoutMs: 120_000 })
        setNotice(`Exported “${report.name}” (${result.rowCount || 0} deals)`)
      } catch (e) {
        setError(e.message || 'Export failed')
      } finally {
        setExportBusy(false)
      }
    },
    [canExportDeals, exportBusy, timeZone]
  )

  const loadSavedReports = useCallback(async () => {
    try {
      const data = await api.getReportDefinitions('deals')
      setSavedReports(data.reports || [])
    } catch {
      setSavedReports([])
    }
  }, [])

  useEffect(() => {
    if (canExportDeals) void loadSavedReports()
  }, [canExportDeals, loadSavedReports])

  useEffect(() => {
    let cancelled = false
    api
      .getUsdInrRate()
      .then((data) => {
        const rate = Number(data?.rate)
        if (!cancelled && Number.isFinite(rate) && rate > 0) setUsdInrRate(rate)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.fetchPipelineDeals({
        dealStage,
        limit: isAllDealsView ? 500 : 200,
        assigneeUserId: assigneeFilter || undefined,
      })
      const list = data.deals || []
      setRows(list)
      setTotal(data.total ?? list.length)
      setSelected((prev) => {
        const valid = new Set(list.map(dealRowKey))
        const next = new Set()
        for (const key of prev) {
          if (valid.has(key)) next.add(key)
        }
        return next
      })
      void refreshPipelineSummary?.()
    } catch (e) {
      setError(e.message || 'Could not load deals')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [dealStage, assigneeFilter, refreshPipelineSummary, isAllDealsView])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!isAllDealsView) setSelectedStages([])
  }, [isAllDealsView])

  const allSelected = filteredRows.length > 0 && filteredRows.every((row) => selected.has(dealRowKey(row)))

  const toggleRow = (row, checked) => {
    const key = dealRowKey(row)
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
  }

  const toggleAll = (checked) => {
    if (checked) setSelected(new Set(filteredRows.map(dealRowKey)))
    else setSelected(new Set())
  }

  const selectedRows = useMemo(
    () => filteredRows.filter((row) => selected.has(dealRowKey(row))),
    [filteredRows, selected]
  )

  const runBulk = async (action, { confirmDelete = false, lostReason = '' } = {}) => {
    if (!selectedRows.length || bulkBusy) return
    if (action === 'delete' && !canDeleteDeals) return
    if (confirmDelete) {
      const ok = window.confirm(
        `Delete ${selectedRows.length} deal${selectedRows.length === 1 ? '' : 's'}? This cannot be undone.`
      )
      if (!ok) return
    }
    setBulkBusy(true)
    setNotice(null)
    setError(null)
    let okCount = 0
    let failCount = 0
    try {
      for (const { deal, leadId } of selectedRows) {
        try {
          if (action === 'delete') {
            await api.deleteCrmDeal(deal.id)
          } else {
            await api.patchCrmDeal({
              dealId: deal.id,
              action,
              ...(action === 'lost' && lostReason ? { lostReason } : {}),
            })
          }
          okCount += 1
        } catch {
          failCount += 1
        }
      }
      const verb =
        action === 'won' ? 'marked won' : action === 'lost' ? 'marked lost' : 'deleted'
      setNotice(
        failCount
          ? `${okCount} ${verb}, ${failCount} failed`
          : `${okCount} deal${okCount === 1 ? '' : 's'} ${verb}`
      )
      setSelected(new Set())
      await load()
      void refreshSavedLeads().catch(() => {})
    } catch (e) {
      setError(e.message || 'Bulk update failed')
    } finally {
      setBulkBusy(false)
    }
  }

  const stageFilterDisplay = useMemo(() => {
    if (!selectedStages.length) return null
    const labels = FREIGHT_DEAL_STAGES.filter((s) => selectedStages.includes(s.id)).map((s) => s.label)
    if (!labels.length) return null
    if (labels.length === 1) return labels[0]
    return `${labels[0]} +${labels.length - 1}`
  }, [selectedStages])

  const yearOptions = useMemo(
    () => dealYearOptions(new Date(), dealYearsFromRows(rows, timeZone), timeZone),
    [rows, timeZone]
  )

  const weekOptions = useMemo(() => {
    if (!periodYear || !periodMonth) return []
    return isoWeeksOverlappingMonth(periodYear, periodMonth, timeZone)
  }, [periodYear, periodMonth, timeZone])

  const weekFilterDisplay = useMemo(() => {
    if (!selectedWeeks.length) return null
    const labels = weekOptions.filter((opt) => selectedWeeks.includes(opt.value)).map((opt) => opt.label)
    if (!labels.length) return selectedWeeks.map((w) => `week${w}`).join(', ')
    if (labels.length === 1) return labels[0]
    return `${labels[0]} +${labels.length - 1}`
  }, [selectedWeeks, weekOptions])

  const monthFilterDisplay = useMemo(() => {
    if (!periodMonth) return null
    return DEAL_MONTH_OPTIONS.find((opt) => opt.value === String(periodMonth))?.label || null
  }, [periodMonth])

  const markBulkLost = () => {
    const reason = window.prompt('Lost reason (optional — applies to all selected):', '') ?? null
    if (reason === null) return
    void runBulk('lost', { lostReason: reason.trim() })
  }

  return (
    <div className="pipeline-deals-view space-y-3 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">{stageMeta.label}</h2>
          <p className="text-xs text-gray-500">
            Select deals for bulk actions, or click a row to open the lead.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canExportDeals ? (
            <>
              <button
                type="button"
                className="crm-filter-link-btn"
                disabled={exportBusy || loading}
                onClick={() => void runExport()}
              >
                {exportBusy ? 'Exporting…' : 'Export CSV'}
              </button>
              <button
                type="button"
                className="crm-filter-link-btn"
                disabled={exportBusy || loading}
                onClick={() => setSaveReportOpen(true)}
              >
                Save report
              </button>
              {savedReports.length > 0 ? (
                <details className="pipeline-deals-saved-reports">
                  <summary className="crm-filter-link-btn cursor-pointer list-none">
                    Saved reports ({savedReports.length})
                  </summary>
                  <ul className="pipeline-saved-reports-list mt-1">
                    {savedReports.map((report) => (
                      <li key={report.id}>
                        <button
                          type="button"
                          className="crm-filter-link-btn text-left w-full"
                          disabled={exportBusy}
                          onClick={() => void runSavedReportExport(report)}
                        >
                          {report.shared ? `${report.name} (Team)` : report.name}
                          {report.schedule?.enabled
                            ? ` · ${report.schedule.cadence === 'weekly' ? 'Weekly' : 'Daily'} email`
                            : ''}
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </>
          ) : null}
          <p className="text-xs text-gray-500 tabular-nums">
            {filteredRows.length}
            {filtersActive && rows.length !== filteredRows.length ? ` of ${rows.length}` : ''} deal
            {filteredRows.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {filteredRows.length > 0 || rows.length > 0 ? (
        <div className="pipeline-deals-forecast" role="region" aria-label="Deal totals for this view">
          <article className="pipeline-deals-forecast__card">
            <span className="pipeline-deals-forecast__label">Open pipeline</span>
            <strong className="pipeline-deals-forecast__value">{formatDealValue(summary.openRevenue)}</strong>
            <span className="pipeline-deals-forecast__hint">
              {summary.openCount} open deal{summary.openCount === 1 ? '' : 's'}
            </span>
          </article>
          <article className="pipeline-deals-forecast__card">
            <span className="pipeline-deals-forecast__label">Revenue</span>
            <strong className="pipeline-deals-forecast__value">
              {formatDealValue(summary.totalRevenue || estimatedRevenueTotal)}
            </strong>
            <span className="pipeline-deals-forecast__hint">Chargeable × freight (ocean USD→INR)</span>
          </article>
          <article className="pipeline-deals-forecast__card">
            <span className="pipeline-deals-forecast__label">Customers</span>
            <strong className="pipeline-deals-forecast__value">{summary.customerCount}</strong>
            <span className="pipeline-deals-forecast__hint">
              {summary.dealCount} deal{summary.dealCount === 1 ? '' : 's'} in this view
            </span>
          </article>
          <article className="pipeline-deals-forecast__card">
            <span className="pipeline-deals-forecast__label">Booked</span>
            <strong className="pipeline-deals-forecast__value">{formatDealValue(summary.bookedRevenue)}</strong>
            <span className="pipeline-deals-forecast__hint">
              {summary.bookedCount} booked
              {summary.wonCount ? ` · ${summary.wonCount} won` : ''}
              {summary.bookRate != null ? ` · ${summary.bookRate}% of closed` : ''}
            </span>
          </article>
          <article className="pipeline-deals-forecast__card">
            <span className="pipeline-deals-forecast__label">Lost</span>
            <strong className="pipeline-deals-forecast__value">{formatDealValue(summary.lostRevenue)}</strong>
            <span className="pipeline-deals-forecast__hint">
              {summary.lostCount} lost deal{summary.lostCount === 1 ? '' : 's'}
            </span>
          </article>
        </div>
      ) : null}

      <div className="pipeline-deals-filters" role="search" aria-label="Deal filters">
        <div className="pipeline-deals-filters__dates">
          <div className="pipeline-deals-filters__dropdown">
            <FilterDropdown
              label="Year"
              value={periodYear}
              displayValue={periodYear || null}
              options={yearOptions}
              emptyLabel="All years"
              onChange={(next) => {
                setPeriodYear(String(next || ''))
                setPeriodMonth('')
                setSelectedWeeks([])
                setSelected(new Set())
              }}
            />
          </div>
          <div className="pipeline-deals-filters__dropdown">
            <FilterDropdown
              label="Month"
              value={periodMonth}
              displayValue={monthFilterDisplay}
              options={DEAL_MONTH_OPTIONS}
              emptyLabel="All months"
              disabled={!periodYear}
              onChange={(next) => {
                setPeriodMonth(String(next || ''))
                setSelectedWeeks([])
                setSelected(new Set())
              }}
            />
          </div>
          <div className="pipeline-deals-filters__dropdown">
            <FilterDropdown
              label="Week Number"
              multiSelect
              values={selectedWeeks}
              displayValue={weekFilterDisplay}
              options={weekOptions}
              emptyLabel="All weeks"
              disabled={!periodYear || !periodMonth}
              onMultiChange={(next) => {
                setSelectedWeeks((next || []).map(String))
                setSelected(new Set())
              }}
            />
          </div>
          <div className="pipeline-deals-filters__stages">
            <FilterDropdown
              label="Stages"
              multiSelect
              values={isAllDealsView ? selectedStages : dealStage !== 'all' ? [dealStage] : selectedStages}
              displayValue={
                isAllDealsView
                  ? stageFilterDisplay
                  : getDealStageMeta(dealStage, { freightOrg: true })?.label || null
              }
              options={FREIGHT_DEAL_STAGES.map((stage) => ({
                id: stage.id,
                value: stage.id,
                label: stage.label,
              }))}
              emptyLabel="All stages"
              onMultiChange={(next) => {
                const ids = (next || []).map(String)
                setSelectedStages(ids)
                setSelected(new Set())
                if (!onDealStageChange) return
                if (ids.length === 1) onDealStageChange(ids[0])
                else onDealStageChange('all')
              }}
            />
          </div>
        </div>
        {rangeLabel ? (
          <p className="pipeline-deals-filters__week-hint">{rangeLabel}</p>
        ) : (
          <p className="pipeline-deals-filters__week-hint">
            Choose a year, then month, then week numbers. Stages stay independent.
          </p>
        )}
        <DashboardSegmented
          value={transportMode}
          onChange={(mode) => {
            setTransportMode(mode)
            setSelected(new Set())
          }}
          options={DEAL_TRANSPORT_FILTERS.map((opt) => ({ value: opt.id, label: opt.label }))}
        />
        {filtersActive ? (
          <button
            type="button"
            className="pipeline-deals-filters__clear"
            onClick={() => {
              setPeriodYear('')
              setPeriodMonth('')
              setSelectedWeeks([])
              setTransportMode('all')
              setSelectedStages([])
              setSelected(new Set())
              onDealStageChange?.('all')
            }}
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {selected.size > 0 && (
        <div className="pipeline-bulk-hs-bar" role="toolbar" aria-label="Bulk deal actions">
          <span className="pipeline-bulk-hs-bar__count">
            {selected.size} deal{selected.size === 1 ? '' : 's'} selected
          </span>
          <div className="pipeline-bulk-hs-bar__actions">
            <button
              type="button"
              className="pipeline-bulk-hs-bar__btn"
              disabled={bulkBusy}
              onClick={() => runBulk('won')}
            >
              Mark won
            </button>
            <button
              type="button"
              className="pipeline-bulk-hs-bar__btn"
              disabled={bulkBusy}
              onClick={markBulkLost}
            >
              Mark lost
            </button>
            {canDeleteDeals ? (
            <button
              type="button"
              className="pipeline-bulk-hs-bar__btn"
              disabled={bulkBusy}
              onClick={() => runBulk('delete', { confirmDelete: true })}
            >
              Delete
            </button>
            ) : null}
          </div>
          <span className="pipeline-bulk-hs-bar__spacer" />
          <button
            type="button"
            className="pipeline-bulk-hs-bar__clear"
            disabled={bulkBusy}
            onClick={() => setSelected(new Set())}
          >
            Clear
          </button>
        </div>
      )}

      {notice && (
        <p className="text-xs text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2" role="status">
          {notice}
        </p>
      )}

      {loading && <p className="text-xs text-gray-500 py-8 text-center">Loading deals…</p>}
      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}
      {!loading && !error && filteredRows.length === 0 && (
        <p className="text-xs text-gray-500 py-10 text-center border rounded-xl bg-gray-50">
          {rows.length > 0 && filtersActive
            ? 'No deals match these filters. Try another period or transport mode.'
            : "No deals in this stage yet. Create one from a lead's Deals tab."}
        </p>
      )}

      {!loading && filteredRows.length > 0 && (
        <>
          <ul className="pipeline-deals-mobile-list" aria-label="Deals">
            {filteredRows.map((row) => {
              const { deal, leadId, leadName, company } = row
              const key = dealRowKey(row)
              const meta = getDealStageMeta(deal.stage, { freightOrg: true })
              const freight = deal.freight
              const dates = filledDealMilestones(deal)
              const isChecked = selected.has(key)
              return (
                <li key={`m-${key}`} className={`pipeline-deals-mobile-card ${isChecked ? 'is-checked' : ''}`}>
                  <div className="pipeline-deals-mobile-card__top">
                    <label className="pipeline-deals-mobile-card__check" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="pipeline-hs-checkbox"
                        checked={isChecked}
                        aria-label={`Select ${deal.name}`}
                        onChange={(e) => toggleRow(row, e.target.checked)}
                      />
                    </label>
                    <button
                      type="button"
                      className="pipeline-deals-mobile-card__open"
                      onClick={() => onOpenLead?.(leadId, 'deals')}
                    >
                      <span className="pipeline-deals-mobile-card__name">{deal.name}</span>
                      <span className="pipeline-deals-mobile-card__lead">
                        {leadName}
                        {company && company !== leadName ? ` · ${company}` : ''}
                      </span>
                      {freightOrg && freightRouteLabel(freight) !== '—' ? (
                        <span className="pipeline-deals-mobile-card__route">{freightRouteLabel(freight)}</span>
                      ) : null}
                      {dates.length > 0 ? (
                        <span className="pipeline-deals-mobile-card__dates">
                          {dates.map((field) => `${field.label} ${field.display}`).join(' · ')}
                        </span>
                      ) : null}
                    </button>
                  </div>
                  <div className="pipeline-deals-mobile-card__meta">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-semibold uppercase ${meta.color}`}
                    >
                      {meta.label}
                    </span>
                    <span className="pipeline-deals-mobile-card__mode">
                      {transportModeLabel(freight?.transportMode)}
                    </span>
                    <span className="pipeline-deals-mobile-card__amount tabular-nums font-semibold">
                      {formatDealValue(deal.amount, resolveFreightDealCurrency(deal))}
                    </span>
                    <span className="pipeline-deals-mobile-card__rev tabular-nums">
                      Rev {formatDealValue(estimatedFreightRevenueInr(deal, usdInrRate), 'INR')}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="pipeline-deals-table-wrap">
            <table className="pipeline-deals-table">
              <colgroup>
                <col className="pipeline-deals-col-check" />
                <col className="pipeline-deals-col-deal" />
                <col className="pipeline-deals-col-lead" />
                <col className="pipeline-deals-col-type" />
                <col className="pipeline-deals-col-stage" />
                <col className="pipeline-deals-col-mode" />
                <col className="pipeline-deals-col-route" />
                <col className="pipeline-deals-col-weight" />
                <col className="pipeline-deals-col-freight" />
                <col className="pipeline-deals-col-revenue" />
                <col className="pipeline-deals-col-invoice" />
              </colgroup>
              <thead>
                <tr>
                  <th className="pipeline-deals-th pipeline-deals-th-check">
                    <input
                      type="checkbox"
                      className="pipeline-hs-checkbox"
                      checked={allSelected}
                      aria-label="Select all deals"
                      onChange={(e) => toggleAll(e.target.checked)}
                    />
                  </th>
                  <th className="pipeline-deals-th">Deal</th>
                  <th className="pipeline-deals-th">Lead / company</th>
                  <th className="pipeline-deals-th">Type</th>
                  <th className="pipeline-deals-th">Stage</th>
                  <th className="pipeline-deals-th">Mode</th>
                  <th className="pipeline-deals-th">Route / lanes</th>
                  <th className="pipeline-deals-th pipeline-deals-th-num">Gross</th>
                  <th className="pipeline-deals-th pipeline-deals-th-num">Freight</th>
                  <th className="pipeline-deals-th pipeline-deals-th-num">Revenue</th>
                  <th className="pipeline-deals-th pipeline-deals-th-num">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const { deal, leadId, leadName, company } = row
                  const key = dealRowKey(row)
                  const meta = getDealStageMeta(deal.stage, { freightOrg: true })
                  const freight = deal.freight
                  const dates = filledDealMilestones(deal)
                  const isChecked = selected.has(key)
                  return (
                    <tr
                      key={key}
                      className={`pipeline-deals-row ${isChecked ? 'is-checked' : ''}`}
                      onClick={() => onOpenLead?.(leadId, 'deals')}
                    >
                      <td
                        className="pipeline-deals-td pipeline-deals-td-check"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className="pipeline-hs-checkbox"
                          checked={isChecked}
                          aria-label={`Select ${deal.name}`}
                          onChange={(e) => toggleRow(row, e.target.checked)}
                        />
                      </td>
                      <td className="pipeline-deals-td pipeline-deals-td-deal">
                        <span className="pipeline-deals-primary" title={deal.name}>
                          {deal.name}
                        </span>
                        {dates.length > 0 ? (
                          <span className="pipeline-deals-dates">
                            {dates.map((field) => `${field.label} ${field.display}`).join(' · ')}
                          </span>
                        ) : null}
                      </td>
                      <td className="pipeline-deals-td">
                        <p className="truncate" title={leadName}>
                          {leadName}
                        </p>
                        {company && company !== leadName && (
                          <p className="truncate text-[10px] text-gray-400" title={company}>
                            {company}
                          </p>
                        )}
                      </td>
                      <td className="pipeline-deals-td whitespace-nowrap">
                        {freightCustomerTypeLabel(freight?.customerType)}
                      </td>
                      <td className="pipeline-deals-td">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-semibold uppercase ${meta.color}`}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td className="pipeline-deals-td whitespace-nowrap">
                        {transportModeLabel(freight?.transportMode)}
                      </td>
                      <td className="pipeline-deals-td pipeline-deals-td-route" title={freightRouteLabel(freight)}>
                        {freightRouteLabel(freight)}
                      </td>
                      <td className="pipeline-deals-td pipeline-deals-td-num tabular-nums">
                        {formatWeight(freight)}
                      </td>
                      <td className="pipeline-deals-td pipeline-deals-td-num tabular-nums font-medium">
                        {formatDealValue(deal.amount, resolveFreightDealCurrency(deal))}
                      </td>
                      <td className="pipeline-deals-td pipeline-deals-td-num tabular-nums font-semibold">
                        {formatDealValue(estimatedFreightRevenueInr(deal, usdInrRate), 'INR')}
                      </td>
                      <td className="pipeline-deals-td pipeline-deals-td-num tabular-nums text-gray-600">
                        {formatDealValue(freight?.invoiceAmount, 'INR')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      <SaveReportModal
        open={saveReportOpen}
        module="deals"
        filterSummary={filterSummary}
        serverFilters={serverFilters}
        canShareOrg={Boolean(user?.isOrgAdmin)}
        userEmail={user?.email || ''}
        onClose={() => setSaveReportOpen(false)}
        onSaved={() => {
          setSaveReportOpen(false)
          setNotice('Report saved')
          void loadSavedReports()
        }}
      />
    </div>
  )
}
