import { useMemo, useState } from 'react'
import FilterDropdown from './FilterDropdown'
import {
  DEAL_MONTH_OPTIONS,
  dealYearOptions,
  isoWeeksOverlappingMonth,
} from '../../lib/pipelineDealsFilter'
import { DEFAULT_TIME_ZONE } from '../../lib/dateLocale'
import {
  filterErpRevenuePeriods,
  getLeadErp,
  sumErpPeriodMetrics,
} from '../../../../lib/leadErp.js'
import { formatDealValue } from '../../lib/crmTimeline'
import { formatCrmDate } from '../../lib/crmConstants'
import {
  LwEmpty,
  LwInfoGrid,
  LwSection,
  LwStatCard,
} from './leadWorkspaceUi'
import { PipelineIcon, SparkIcon } from '../ui/icons'

function money(amount, currency = 'INR') {
  if (amount == null) return '—'
  return formatDealValue(amount, currency)
}

function periodLabel(p) {
  const bits = []
  if (p.year) bits.push(String(p.year))
  if (p.month) bits.push(DEAL_MONTH_OPTIONS.find((m) => m.value === String(p.month))?.label || `M${p.month}`)
  if (p.week) bits.push(`Week ${p.week}`)
  return bits.join(' · ') || 'Period'
}

export default function LeadErpPanels({ lead, tab }) {
  const erp = useMemo(() => getLeadErp(lead), [lead])
  const timeZone = DEFAULT_TIME_ZONE
  const [years, setYears] = useState([])
  const [months, setMonths] = useState([])
  const [weeks, setWeeks] = useState([])

  const yearOptions = useMemo(() => {
    const extras = (erp.revenue.periods || [])
      .map((p) => p.year)
      .filter(Boolean)
    return dealYearOptions(new Date(), extras, timeZone)
  }, [erp.revenue.periods, timeZone])

  const weekOptions = useMemo(() => {
    if (years.length !== 1 || months.length !== 1) return []
    return isoWeeksOverlappingMonth(Number(years[0]), Number(months[0]), timeZone)
  }, [years, months, timeZone])

  const filteredPeriods = useMemo(
    () => filterErpRevenuePeriods(erp.revenue.periods, { years, months, weeks }),
    [erp.revenue.periods, years, months, weeks]
  )

  const periodTotals = useMemo(() => sumErpPeriodMetrics(filteredPeriods), [filteredPeriods])
  const periodFilterActive = years.length + months.length + weeks.length > 0

  if (tab === 'erp-revenue') {
    const revenue = periodFilterActive ? periodTotals.revenue : erp.revenue.revenue
    const shipments = periodFilterActive ? periodTotals.shipmentCount : erp.revenue.shipmentCount
    const hasData =
      revenue != null ||
      shipments != null ||
      erp.revenue.lastShipmentDate ||
      (erp.revenue.periods || []).length > 0

    return (
      <>
        <LwSection icon={PipelineIcon} title="ERP Revenue">
          <div className="lw-chip-row mb-3">
            <FilterDropdown
              label="Year"
              multiSelect
              values={years}
              options={yearOptions}
              onMultiChange={setYears}
              emptyLabel="All years"
            />
            <FilterDropdown
              label="Month"
              multiSelect
              values={months}
              options={DEAL_MONTH_OPTIONS}
              onMultiChange={setMonths}
              emptyLabel="All months"
            />
            <FilterDropdown
              label="Week"
              multiSelect
              values={weeks}
              options={weekOptions}
              onMultiChange={setWeeks}
              emptyLabel="All weeks"
              disabled={weekOptions.length === 0}
            />
          </div>
          {!hasData ? (
            <LwEmpty>
              No ERP revenue yet. Open this lead after a workspace shipment upload or trading import
              that matches this company or customer code.
            </LwEmpty>
          ) : (
            <>
              <div className="lw-stat-row">
                <LwStatCard label="Revenue" value={money(revenue, erp.revenue.currency)} />
                <LwStatCard
                  label="Shipments"
                  value={shipments != null ? String(shipments) : '—'}
                />
                <LwStatCard
                  label="Last shipment"
                  value={erp.revenue.lastShipmentDate ? formatCrmDate(erp.revenue.lastShipmentDate) : '—'}
                />
              </div>
              {filteredPeriods.length > 0 ? (
                <LwInfoGrid
                  items={filteredPeriods.map((p, i) => ({
                    label: `${periodLabel(p)} (${i + 1})`,
                    value: `${money(p.revenue, erp.revenue.currency)} · ${p.shipmentCount ?? 0} shipments`,
                  }))}
                />
              ) : null}
            </>
          )}
        </LwSection>
      </>
    )
  }

  const finance = erp.finance
  const hasFinance =
    finance.invoiceStatus ||
    finance.lastPaymentDate ||
    finance.lastPaymentAmount != null ||
    finance.pendingPayments != null ||
    finance.ledger.length > 0

  return (
    <LwSection icon={SparkIcon} title="ERP Finance">
      {!hasFinance ? (
        <LwEmpty>
          No ERP finance yet. Invoice status, payments, and ledger fill from matched shipments and
          open or won deals.
        </LwEmpty>
      ) : (
        <>
          <div className="lw-stat-row">
            <LwStatCard label="Invoice status" value={finance.invoiceStatus || '—'} />
            <LwStatCard
              label="Last payment"
              value={
                finance.lastPaymentDate
                  ? `${formatCrmDate(finance.lastPaymentDate)}${
                      finance.lastPaymentAmount != null
                        ? ` · ${money(finance.lastPaymentAmount, finance.currency)}`
                        : ''
                    }`
                  : money(finance.lastPaymentAmount, finance.currency)
              }
            />
            <LwStatCard
              label="Pending payments"
              value={money(finance.pendingPayments, finance.currency)}
            />
          </div>
          {finance.ledger.length ? (
            <div className="mt-4">
              <p className="lw-info-grid__label mb-2">Ledger</p>
              <ul className="space-y-2">
                {finance.ledger.map((row, i) => (
                  <li key={`${row.date}-${i}`} className="text-sm text-[var(--lw-text-secondary)]">
                    <span className="font-medium text-[var(--lw-text)]">
                      {row.date ? formatCrmDate(row.date) : '—'}
                    </span>
                    {' · '}
                    {row.description}
                    {row.debit != null ? ` · Dr ${money(row.debit, finance.currency)}` : ''}
                    {row.credit != null ? ` · Cr ${money(row.credit, finance.currency)}` : ''}
                    {row.balance != null ? ` · Bal ${money(row.balance, finance.currency)}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </LwSection>
  )
}
