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
  hasLeadErpDisplayData,
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

function yesNo(value) {
  if (value === true) return 'Yes'
  if (value === false) return 'No'
  return '—'
}

function periodLabel(p) {
  const bits = []
  if (p.year) bits.push(String(p.year))
  if (p.month) bits.push(DEAL_MONTH_OPTIONS.find((m) => m.value === String(p.month))?.label || `M${p.month}`)
  if (p.week) bits.push(`Week ${p.week}`)
  return bits.join(' · ') || 'Period'
}

function gridItems(pairs) {
  return pairs
    .filter((row) => row.value != null && row.value !== '' && row.value !== '—')
    .map((row) => ({ label: row.label, value: row.value }))
}

function ErpPill({ tone = 'neutral', children }) {
  return <span className={`lw-erp-pill lw-erp-pill--${tone}`}>{children}</span>
}

function invoiceTone(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'overdue' || s === 'blocked') return 'danger'
  if (s === 'partial' || s === 'open') return 'warn'
  if (s === 'paid' || s === 'invoiced') return 'ok'
  return 'neutral'
}

export default function LeadErpPanels({ lead, tab }) {
  const erp = useMemo(() => getLeadErp(lead), [lead])
  const timeZone = DEFAULT_TIME_ZONE
  const [years, setYears] = useState([])
  const [months, setMonths] = useState([])
  const [weeks, setWeeks] = useState([])
  const rev = erp.revenue
  const fin = erp.finance

  const yearOptions = useMemo(() => {
    const extras = (rev.periods || []).map((p) => p.year).filter(Boolean)
    return dealYearOptions(new Date(), extras, timeZone)
  }, [rev.periods, timeZone])

  const weekOptions = useMemo(() => {
    if (years.length !== 1 || months.length !== 1) return []
    return isoWeeksOverlappingMonth(Number(years[0]), Number(months[0]), timeZone)
  }, [years, months, timeZone])

  const filteredPeriods = useMemo(
    () => filterErpRevenuePeriods(rev.periods, { years, months, weeks }),
    [rev.periods, years, months, weeks]
  )

  const periodTotals = useMemo(() => sumErpPeriodMetrics(filteredPeriods), [filteredPeriods])
  const periodFilterActive = years.length + months.length + weeks.length > 0

  if (tab === 'erp-revenue') {
    const revenue = periodFilterActive ? periodTotals.revenue : rev.revenue
    const shipments = periodFilterActive ? periodTotals.shipmentCount : rev.shipmentCount
    const lastShip = rev.lastShipmentDate || rev.lastTransactedDate
    const hasTrading = revenue != null || shipments != null || lastShip
    const hasShipping = Boolean(rev.shipmentMethod || rev.shipType || rev.countries || rev.shipmentTypes || rev.taxTypes || rev.incoTerm)
    const hasVolume =
      rev.dailyAverageLoadMoq != null ||
      rev.volumeFirst7Days != null ||
      rev.volume7To15Days != null ||
      rev.volume15To30Days != null
    const hasSavings = rev.totalSavings != null
    const hasPeriods = filteredPeriods.length > 0
    const hasData = hasLeadErpDisplayData({ revenue: rev, finance: {} }) || hasTrading || hasShipping || hasVolume || hasSavings

    if (!hasData) {
      return (
        <LwSection icon={PipelineIcon} title="ERP Revenue">
          <LwEmpty>
            No trading snapshot on this customer yet. Values come from the Xindus customer file
            (shipment count, last transacted date, shipping profile).
          </LwEmpty>
        </LwSection>
      )
    }

    return (
      <div className="lw-erp">
        <LwSection icon={PipelineIcon} title="Trading activity">
          <p className="lw-erp-subcopy">How often this account ships with Xindus.</p>
          <div className="lw-stat-row">
            <LwStatCard
              label="Shipments"
              value={shipments != null ? String(Math.round(shipments)) : '—'}
              sub="Lifetime count on file"
            />
            <LwStatCard
              label="Last transacted"
              value={lastShip ? formatCrmDate(lastShip) : '—'}
              sub="Last shipment / trade date"
            />
            <LwStatCard
              label="Recorded revenue"
              value={money(revenue, rev.currency)}
              sub={revenue == null ? 'Not on customer file' : rev.currency}
            />
          </div>
        </LwSection>

        {hasShipping ? (
          <LwSection title="Shipping profile">
            <p className="lw-erp-subcopy">How they usually move cargo.</p>
            <LwInfoGrid
              items={gridItems([
                { label: 'Method', value: rev.shipmentMethod },
                { label: 'Ship type', value: rev.shipType },
                { label: 'Incoterm', value: rev.incoTerm },
                { label: 'Countries', value: rev.countries },
                { label: 'Shipment types', value: rev.shipmentTypes },
                { label: 'Tax types', value: rev.taxTypes },
              ])}
            />
          </LwSection>
        ) : null}

        {hasVolume ? (
          <LwSection title="Volume outlook">
            <p className="lw-erp-subcopy">Daily averages from onboarding / account setup.</p>
            <LwInfoGrid
              items={gridItems([
                { label: 'Load MOQ', value: rev.dailyAverageLoadMoq != null ? String(rev.dailyAverageLoadMoq) : null },
                { label: 'First 7 days', value: rev.volumeFirst7Days != null ? String(rev.volumeFirst7Days) : null },
                { label: 'Days 7–15', value: rev.volume7To15Days != null ? String(rev.volume7To15Days) : null },
                { label: 'Days 15–30', value: rev.volume15To30Days != null ? String(rev.volume15To30Days) : null },
              ])}
            />
          </LwSection>
        ) : null}

        {hasSavings ? (
          <LwSection title="Savings">
            <div className="lw-stat-row">
              <LwStatCard
                label="Total savings"
                value={money(rev.totalSavings, rev.currency)}
                sub="Recorded on the customer account"
              />
            </div>
          </LwSection>
        ) : null}

        {hasPeriods ? (
          <LwSection title="By period">
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
            <LwInfoGrid
              items={filteredPeriods.map((p, i) => ({
                label: `${periodLabel(p)} (${i + 1})`,
                value: `${money(p.revenue, rev.currency)} · ${p.shipmentCount ?? 0} shipments`,
              }))}
            />
          </LwSection>
        ) : null}
      </div>
    )
  }

  const hasInvoices = Boolean(fin.lastInvoiceDate || fin.lastDutyInvoiceDate || fin.invoiceStatus)
  const hasCredit =
    fin.creditLimit != null ||
    fin.creditPeriod ||
    fin.paymentMethod ||
    fin.overdue != null ||
    fin.shouldBlock != null
  const hasTax = Boolean(fin.taxFilingMethod || fin.eInvoicing != null || fin.billingDays || fin.dutyBillingDays)
  const hasBank = Boolean(fin.bankName || fin.bankAccountMasked || fin.ifsc)
  const hasDeals = Boolean(
    fin.lastPaymentDate || fin.lastPaymentAmount != null || fin.pendingPayments != null || fin.ledger.length
  )
  const hasFinance = hasInvoices || hasCredit || hasTax || hasBank || hasDeals

  if (!hasFinance) {
    return (
      <LwSection icon={SparkIcon} title="ERP Finance">
        <LwEmpty>
          No finance snapshot on this customer yet. Values come from the Xindus customer file
          (invoices, credit limit, overdue, payment method).
        </LwEmpty>
      </LwSection>
    )
  }

  return (
    <div className="lw-erp">
      <LwSection icon={SparkIcon} title="Account standing">
        <p className="lw-erp-subcopy">Credit health and whether this account can keep booking.</p>
        <div className="lw-erp-pills">
          <ErpPill tone={fin.overdue ? 'danger' : 'ok'}>Overdue {yesNo(fin.overdue)}</ErpPill>
          <ErpPill tone={fin.shouldBlock ? 'danger' : 'ok'}>
            {fin.shouldBlock ? 'Booking blocked' : 'Booking open'}
          </ErpPill>
          {fin.invoiceStatus ? (
            <ErpPill tone={invoiceTone(fin.invoiceStatus)}>{fin.invoiceStatus}</ErpPill>
          ) : null}
        </div>
        <div className="lw-stat-row mt-3">
          <LwStatCard
            label="Credit limit"
            value={money(fin.creditLimit, fin.currency)}
            sub="Pending payment limit on file"
          />
          <LwStatCard
            label="Payment method"
            value={fin.paymentMethod || '—'}
            sub={fin.creditPeriod ? `${fin.creditPeriod} day credit` : 'How they pay'}
          />
          <LwStatCard
            label="Open in CRM"
            value={money(fin.pendingPayments, fin.currency)}
            sub="From open deals, if any"
          />
        </div>
      </LwSection>

      {hasInvoices || hasDeals ? (
        <LwSection title="Invoices & payments">
          <p className="lw-erp-subcopy">Latest billing dates from ERP, plus CRM deal payments.</p>
          <LwInfoGrid
            items={gridItems([
              {
                label: 'Last invoice',
                value: fin.lastInvoiceDate ? formatCrmDate(fin.lastInvoiceDate) : null,
              },
              {
                label: 'Last duty invoice',
                value: fin.lastDutyInvoiceDate ? formatCrmDate(fin.lastDutyInvoiceDate) : null,
              },
              {
                label: 'Last payment',
                value: fin.lastPaymentDate
                  ? `${formatCrmDate(fin.lastPaymentDate)}${
                      fin.lastPaymentAmount != null ? ` · ${money(fin.lastPaymentAmount, fin.currency)}` : ''
                    }`
                  : fin.lastPaymentAmount != null
                    ? money(fin.lastPaymentAmount, fin.currency)
                    : null,
              },
            ])}
          />
        </LwSection>
      ) : null}

      {hasTax ? (
        <LwSection title="Billing terms">
          <LwInfoGrid
            items={gridItems([
              { label: 'Tax filing', value: fin.taxFilingMethod },
              { label: 'E-invoicing', value: fin.eInvoicing == null ? null : yesNo(fin.eInvoicing) },
              { label: 'Billing days', value: fin.billingDays },
              { label: 'Duty billing days', value: fin.dutyBillingDays },
              { label: 'Duty credit period', value: fin.dutyCreditPeriod },
              { label: 'Currency', value: fin.currency },
            ])}
          />
        </LwSection>
      ) : null}

      {hasBank ? (
        <LwSection title="Bank on file">
          <p className="lw-erp-subcopy">Account number is masked. Full digits stay in ERP.</p>
          <LwInfoGrid
            items={gridItems([
              { label: 'Bank', value: fin.bankName },
              { label: 'Account', value: fin.bankAccountMasked },
              { label: 'IFSC', value: fin.ifsc },
              { label: 'Zoho Books', value: fin.zohoBooksId },
            ])}
          />
        </LwSection>
      ) : null}

      {fin.ledger.length ? (
        <LwSection title="Ledger">
          <ul className="lw-erp-ledger">
            {fin.ledger.map((row, i) => (
              <li key={`${row.date}-${i}`}>
                <span className="lw-erp-ledger__date">{row.date ? formatCrmDate(row.date) : '—'}</span>
                <span className="lw-erp-ledger__desc">{row.description}</span>
                <span className="lw-erp-ledger__amt">
                  {row.debit != null ? `Dr ${money(row.debit, fin.currency)}` : ''}
                  {row.credit != null ? `Cr ${money(row.credit, fin.currency)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </LwSection>
      ) : null}
    </div>
  )
}
