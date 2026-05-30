/**
 * Company workspace analytics — reads uploaded spreadsheets only.
 * Does not read or write CRM pipeline records.
 */

const MAX_ROWS = 5000

const REVENUE_KEYS = [
  'revenue',
  'amount',
  'sales',
  'sale',
  'turnover',
  'gmv',
  'value',
  'total',
  'inr',
  'rs',
  'final_amount',
  'gross',
  'weight',
  'charge',
  'freight',
  'invoice',
]
const DATE_KEYS = [
  'date',
  'shipment_date',
  'trade_date',
  'invoice_date',
  'last_shipment',
  'last_trade',
  'etd',
  'eta',
  'month',
  'period',
]
const CUSTOMER_KEYS = [
  'customer',
  'customer_name',
  'company',
  'client',
  'account',
  'buyer',
  'consignee',
  'shipper',
]
const CATEGORY_KEYS = [
  'shipping',
  'method',
  'mode',
  'service',
  'lane',
  'zone',
  'route',
  'product',
  'category',
  'type',
  'carrier',
  'port',
]
const LEADER_KEYS = ['leader', 'sales_person', 'rm', 'kam', 'owner', 'executive', 'rep', 'manager']

export const WORKSPACE_QUESTION_CATALOG = {
  last_60_days_revenue: {
    id: 'last_60_days_revenue',
    label: 'Last 60 days total revenue',
    description: 'Sum of revenue in the most recent 60 days from your file.',
  },
  revenue_leader_weekly: {
    id: 'revenue_leader_weekly',
    label: 'Revenue by sales leader (weekly)',
    description: 'Weekly totals per leader or owner column.',
  },
  revenue_leader_monthly: {
    id: 'revenue_leader_monthly',
    label: 'Revenue by sales leader (monthly)',
    description: 'Monthly totals per leader or owner column.',
  },
  customer_last_trade: {
    id: 'customer_last_trade',
    label: 'Last trading date per customer',
    description: 'Most recent activity date for each customer in the file.',
  },
  top_customers_revenue: {
    id: 'top_customers_revenue',
    label: 'Top customers by revenue',
    description: 'Ranked list of customers by total revenue in the file.',
  },
  inactive_60_days: {
    id: 'inactive_60_days',
    label: 'No trade in 60+ days (preview list)',
    description: 'Customers whose last date in the file is older than 60 days — for review only, not CRM tags.',
  },
}

export function capWorkspaceRows(rows) {
  const list = Array.isArray(rows) ? rows : []
  if (list.length <= MAX_ROWS) return { rows: list, truncated: false, total: list.length }
  return { rows: list.slice(0, MAX_ROWS), truncated: true, total: list.length }
}

function pickColumnKey(row, roles, role) {
  if (!row) return null
  const keys = Object.keys(row)
  const mapped = roles?.[role]
  if (mapped && keys.includes(mapped)) return mapped
  const patterns = role === 'revenue' ? REVENUE_KEYS : role === 'date' ? DATE_KEYS : role === 'customer' ? CUSTOMER_KEYS : LEADER_KEYS
  return keys.find((k) => patterns.some((p) => k.includes(p))) || null
}

function parseNum(value) {
  if (value == null || value === '') return 0
  const n = Number(String(value).replace(/[,₹\s]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function parseDate(value) {
  if (!value) return null
  const raw = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const d = new Date(raw.length === 10 ? `${raw}T12:00:00Z` : raw)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  const dmY = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/)
  if (dmY) {
    const day = Number(dmY[1])
    const month = Number(dmY[2]) - 1
    let year = Number(dmY[3])
    if (year < 100) year += 2000
    const d = new Date(Date.UTC(year, month, day))
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function inferColumnRoles(sampleRow) {
  const roles = {}
  const keys = Object.keys(sampleRow || {})
  for (const key of keys) {
    const k = key.toLowerCase()
    if (!roles.revenue && REVENUE_KEYS.some((p) => k.includes(p))) roles.revenue = key
    if (!roles.date && DATE_KEYS.some((p) => k.includes(p))) roles.date = key
    if (!roles.customer && CUSTOMER_KEYS.some((p) => k.includes(p))) roles.customer = key
    if (!roles.leader && LEADER_KEYS.some((p) => k.includes(p))) roles.leader = key
  }
  return roles
}

export function mergeColumnRoles(heuristic, aiMapping = {}) {
  const pick = (role) => {
    const ai = aiMapping[role]
    if (ai && ai !== 'null' && String(ai).trim()) return String(ai).trim()
    return heuristic[role] || null
  }
  return {
    revenue: pick('revenue'),
    date: pick('date'),
    customer: pick('customer'),
    leader: pick('leader'),
  }
}

export function filterNonemptyRows(rows) {
  return (rows || []).filter((row) => {
    if (!row || typeof row !== 'object') return false
    return Object.values(row).some((v) => String(v ?? '').trim() !== '')
  })
}

function rowHasData(row) {
  return row && typeof row === 'object' && Object.values(row).some((v) => String(v ?? '').trim() !== '')
}

function isLikelyCategoryColumn(rows, key) {
  const samples = rows
    .slice(0, 400)
    .map((r) => r?.[key])
    .filter((v) => String(v ?? '').trim() !== '')
  if (samples.length < 2) return false
  let numericLike = 0
  for (const v of samples) {
    const s = String(v).trim()
    if (/^[\d,.eE+-]+$/.test(s.replace(/[,₹\s]/g, '')) && parseNum(v) !== 0) numericLike += 1
  }
  return numericLike / samples.length < 0.2
}

function pickCategoryColumn(row, rows = []) {
  const keys = Object.keys(row || {})
  const ordered = [
    'shipper',
    'customer',
    'company',
    'sales_leader',
    'shipping_method',
    ...keys.filter((k) => CATEGORY_KEYS.some((p) => k.toLowerCase().includes(p))),
  ]
  for (const key of ordered) {
    if (!keys.includes(key)) continue
    if (/amount|weight|revenue|total|inr|rs|sum|final_/.test(key)) continue
    if (rows.length && !isLikelyCategoryColumn(rows, key)) continue
    return key
  }
  return null
}

function findBestNumericColumn(rows) {
  const sample = rows.find(rowHasData) || rows[0] || {}
  const preferred = ['final_amount', 'amount', 'revenue', 'total_amount', 'total_sum_of_final_amount']
  for (const key of preferred) {
    if (key in sample && isLikelyCategoryColumn(rows, key) === false) {
      const sum = rows.slice(0, 200).reduce((s, r) => s + Math.abs(parseNum(r[key])), 0)
      if (sum > 0) return key
    }
  }
  const sums = new Map()
  for (const row of rows.slice(0, 500)) {
    if (!row) continue
    for (const [key, value] of Object.entries(row)) {
      if (isLikelyCategoryColumn(rows, key)) continue
      const n = parseNum(value)
      if (n === 0) continue
      sums.set(key, (sums.get(key) || 0) + Math.abs(n))
    }
  }
  let best = null
  let bestSum = 0
  for (const [key, sum] of sums.entries()) {
    if (sum > bestSum) {
      bestSum = sum
      best = key
    }
  }
  return best
}

/** Resolve actual column keys present in rows (AI mapping + heuristics + pivot fallbacks). */
export function resolveReportColumns(rows, columnRoles = {}) {
  const sample = rows.find(rowHasData) || rows[0] || {}
  const merged = mergeColumnRoles(inferColumnRoles(sample), columnRoles)
  const revenue =
    (merged.revenue && sample[merged.revenue] !== undefined ? merged.revenue : null) ||
    pickColumnKey(sample, merged, 'revenue') ||
    findBestNumericColumn(rows)
  const date =
    (merged.date && sample[merged.date] !== undefined ? merged.date : null) ||
    pickColumnKey(sample, merged, 'date')
  const customer =
    (merged.customer && sample[merged.customer] !== undefined ? merged.customer : null) ||
    (sample.shipper !== undefined ? 'shipper' : null) ||
    pickColumnKey(sample, merged, 'customer') ||
    pickCategoryColumn(sample, rows)
  const leader =
    (merged.leader && sample[merged.leader] !== undefined ? merged.leader : null) ||
    (sample.sales_leader !== undefined ? 'sales_leader' : null) ||
    pickColumnKey(sample, merged, 'leader')
  return { revenue, date, customer, leader }
}

function monthKey(iso) {
  if (!iso) return null
  return iso.slice(0, 7)
}

function weekKey(iso) {
  if (!iso) return null
  const d = new Date(iso)
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = start.getUTCDay() || 7
  start.setUTCDate(start.getUTCDate() - day + 1)
  return start.toISOString().slice(0, 10)
}

export function buildWorkspaceReport(rowsIn, goals = {}, columnRoles = {}) {
  const selected = new Set(goals.selectedQuestionIds || [])
  const rows = filterNonemptyRows(rowsIn)
  const cols = resolveReportColumns(rows, columnRoles)

  const now = Date.now()
  const days60 = 60 * 24 * 60 * 60 * 1000
  const since60 = now - days60

  const report = {
    generatedAt: new Date().toISOString(),
    rowCount: rows.length,
    columnRoles: cols,
    blocks: [],
    pivotStyle: !cols.date && Boolean(cols.customer && cols.revenue),
  }

  if (!rows.length) return report

  const revKey = cols.revenue
  const dateKey = cols.date
  const custKey = cols.customer
  const leaderKey = cols.leader

  if (selected.has('last_60_days_revenue') && revKey && dateKey) {
    let total = 0
    for (const row of rows) {
      const at = parseDate(row[dateKey])
      if (!at || new Date(at).getTime() < since60) continue
      total += parseNum(row[revKey])
    }
    report.blocks.push({
      id: 'last_60_days_revenue',
      type: 'kpi',
      label: 'Revenue (last 60 days)',
      value: Math.round(total),
    })
  } else if (selected.has('last_60_days_revenue') && revKey) {
    let total = 0
    for (const row of rows) total += parseNum(row[revKey])
    report.blocks.push({
      id: 'last_60_days_revenue',
      type: 'kpi',
      label: `Total (${humanizeColumn(revKey)}) — all rows in file`,
      value: Math.round(total),
    })
  }

  const byCustomer = new Map()
  for (const row of rows) {
    const name = custKey
      ? String(row[custKey] || 'Unknown').trim() || 'Unknown'
      : `Row ${byCustomer.size + 1}`
    if (!byCustomer.has(name)) byCustomer.set(name, { revenue: 0, lastDate: null })
    const entry = byCustomer.get(name)
    if (revKey) entry.revenue += parseNum(row[revKey])
    if (dateKey) {
      const at = parseDate(row[dateKey])
      if (at && (!entry.lastDate || at > entry.lastDate)) entry.lastDate = at
    }
  }

  if (selected.has('customer_last_trade') && custKey && dateKey) {
    const list = [...byCustomer.entries()]
      .map(([name, v]) => ({ name, lastTrade: v.lastDate }))
      .sort((a, b) => String(b.lastTrade || '').localeCompare(String(a.lastTrade || '')))
      .slice(0, 50)
    report.blocks.push({
      id: 'customer_last_trade',
      type: 'table',
      label: 'Last trading date per customer',
      columns: ['Customer', 'Last date'],
      rows: list.map((r) => [r.name, r.lastTrade ? r.lastTrade.slice(0, 10) : '—']),
    })
  }

  if (selected.has('top_customers_revenue') && custKey && revKey) {
    const list = [...byCustomer.entries()]
      .map(([name, v]) => ({ name, revenue: Math.round(v.revenue) }))
      .filter((r) => r.revenue > 0 || String(r.name).trim())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20)
    report.blocks.push({
      id: 'top_customers_revenue',
      type: 'table',
      label: custKey === 'shipper' ? 'Top shippers by amount' : dateKey ? 'Top customers by revenue' : `Top groups by ${humanizeColumn(custKey)}`,
      columns: [humanizeColumn(custKey), humanizeColumn(revKey)],
      rows: list.map((r) => [r.name, r.revenue.toLocaleString()]),
    })
  }

  const methodKey = rows[0] && 'shipping_method' in rows[0] ? 'shipping_method' : null
  if (methodKey && revKey && (selected.has('top_customers_revenue') || selected.has('last_60_days_revenue'))) {
    const byMethod = new Map()
    for (const row of rows) {
      const method = String(row[methodKey] || '').trim() || 'Unknown'
      if (method === 'TOTAL') continue
      byMethod.set(method, (byMethod.get(method) || 0) + parseNum(row[revKey]))
    }
    const methodList = [...byMethod.entries()]
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
    if (methodList.length) {
      report.blocks.push({
        id: 'revenue_by_shipping_method',
        type: 'table',
        label: 'Amount by shipping method',
        columns: ['Method', humanizeColumn(revKey)],
        rows: methodList.map((r) => [r.name, r.value.toLocaleString()]),
      })
    }
  }

  if (leaderKey && revKey && selected.has('revenue_leader_monthly') && !dateKey) {
    const byLeader = new Map()
    for (const row of rows) {
      const leader = String(row[leaderKey] || 'Unassigned').trim() || 'Unassigned'
      byLeader.set(leader, (byLeader.get(leader) || 0) + parseNum(row[revKey]))
    }
    const series = [...byLeader.entries()]
      .map(([leader, value]) => ({
        leader,
        periods: [{ period: 'All rows', value: Math.round(value) }],
      }))
      .sort((a, b) => (b.periods[0]?.value || 0) - (a.periods[0]?.value || 0))
    if (series.length) {
      report.blocks.push({
        id: 'revenue_leader_monthly',
        type: 'leader_series',
        label: 'Amount by sales leader',
        series,
      })
    }
  }

  if (selected.has('inactive_60_days') && custKey && dateKey) {
    const inactive = [...byCustomer.entries()]
      .filter(([, v]) => !v.lastDate || new Date(v.lastDate).getTime() < since60)
      .map(([name]) => name)
      .slice(0, 100)
    report.blocks.push({
      id: 'inactive_60_days',
      type: 'list',
      label: 'No trade in 60+ days (preview — does not change CRM tags)',
      items: inactive,
      count: inactive.length,
    })
  }

  const aggregateLeader = (periodFn) => {
    const map = new Map()
    for (const row of rows) {
      if (!leaderKey || !revKey || !dateKey) continue
      const leader = String(row[leaderKey] || 'Unassigned').trim() || 'Unassigned'
      const at = parseDate(row[dateKey])
      if (!at) continue
      const period = periodFn(at)
      const key = `${leader}::${period}`
      map.set(key, (map.get(key) || 0) + parseNum(row[revKey]))
    }
    const byLeader = new Map()
    for (const [key, value] of map.entries()) {
      const [leader, period] = key.split('::')
      if (!byLeader.has(leader)) byLeader.set(leader, [])
      byLeader.get(leader).push({ period, value: Math.round(value) })
    }
    return [...byLeader.entries()].map(([leader, periods]) => ({
      leader,
      periods: periods.sort((a, b) => a.period.localeCompare(b.period)),
    }))
  }

  if (selected.has('revenue_leader_monthly') && leaderKey && revKey && dateKey) {
    report.blocks.push({
      id: 'revenue_leader_monthly',
      type: 'leader_series',
      label: 'Revenue by leader (monthly)',
      series: aggregateLeader(monthKey),
    })
  }

  if (selected.has('revenue_leader_weekly') && leaderKey && revKey && dateKey) {
    report.blocks.push({
      id: 'revenue_leader_weekly',
      type: 'leader_series',
      label: 'Revenue by leader (weekly)',
      series: aggregateLeader(weekKey),
    })
  }

  if (!report.blocks.length && selected.size > 0) {
    appendFallbackBlocks(report, rows, cols, selected)
  }

  return report
}

function humanizeColumn(key) {
  if (!key) return 'Value'
  return String(key)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function appendFallbackBlocks(report, rows, cols, selected) {
  report.blocks.push({
    id: 'file_overview',
    type: 'kpi',
    label: 'Non-empty rows analyzed',
    value: rows.length,
  })

  if (cols.revenue) {
    let total = 0
    for (const row of rows) total += parseNum(row[cols.revenue])
    report.blocks.push({
      id: 'total_metric',
      type: 'kpi',
      label: `Total ${humanizeColumn(cols.revenue)}`,
      value: Math.round(total),
    })
  }

  if (cols.customer && cols.revenue) {
    const map = new Map()
    for (const row of rows) {
      const name = String(row[cols.customer] || '').trim()
      if (!name) continue
      map.set(name, (map.get(name) || 0) + parseNum(row[cols.revenue]))
    }
    const list = [...map.entries()]
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15)
    if (list.length) {
      report.blocks.push({
        id: 'top_groups',
        type: 'table',
        label: `Breakdown by ${humanizeColumn(cols.customer)}`,
        columns: [humanizeColumn(cols.customer), humanizeColumn(cols.revenue)],
        rows: list.map((r) => [r.name, r.value.toLocaleString()]),
      })
    }
  }

  const hints = [
    report.pivotStyle
      ? 'This file looks like a pivot or summary export (no clear date column). We showed totals and group breakdowns instead.'
      : 'Some selected reports need date, customer, and amount columns in the same row.',
  ]
  if (cols.revenue) hints.push(`Amount column: ${cols.revenue}`)
  if (cols.customer) hints.push(`Group column: ${cols.customer}`)
  if (cols.date) hints.push(`Date column: ${cols.date}`)
  else hints.push('No date column detected — time-based reports were skipped.')

  report.blocks.push({
    id: 'report_hints',
    type: 'list',
    label: 'About these charts',
    items: hints,
    count: hints.length,
  })
}

export function sampleRowsForAi(rows, limit = 8) {
  return (rows || []).slice(0, limit).map((row) => {
    const out = {}
    for (const [k, v] of Object.entries(row)) {
      out[k] = String(v ?? '').slice(0, 120)
    }
    return out
  })
}
