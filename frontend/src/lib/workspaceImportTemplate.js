import * as XLSX from 'xlsx'

/**
 * Canonical columns for Company Workspace uploads.
 * One row per shipment. Do not rename headers on the Data sheet.
 */
export const WORKSPACE_TEMPLATE_COLUMNS = [
  'shipment_date',
  'shipper',
  'final_amount',
  'shipping_method',
  'sales_leader',
  'final_weight',
  'customer_code',
  'notes',
]

export const WORKSPACE_TEMPLATE_SAMPLE_ROWS = [
  {
    shipment_date: '2026-03-15',
    shipper: 'CALVIN HANDICRAFTS',
    final_amount: 118149.19,
    shipping_method: 'AE',
    sales_leader: 'Ankita Bha',
    final_weight: 428.5,
    customer_code: 'CUST-1001',
    notes: 'Air express',
  },
  {
    shipment_date: '2026-03-18',
    shipper: 'THE HOME CENTRIC',
    final_amount: 83746.86,
    shipping_method: 'AN',
    sales_leader: 'Ankita Bha',
    final_weight: 312.0,
    customer_code: 'CUST-1002',
    notes: '',
  },
  {
    shipment_date: '2026-02-28',
    shipper: 'Bhagwandas Retail Private Limited',
    final_amount: 45200,
    shipping_method: 'IE',
    sales_leader: 'Dakash Ra',
    final_weight: 890.2,
    customer_code: 'CUST-2044',
    notes: 'Repeat shipper',
  },
]

const INSTRUCTIONS_ROWS = [
  ['Company Workspace — upload template'],
  [''],
  ['Use the "Data" sheet only. Keep row 1 column names exactly as shown.'],
  ['One row = one shipment (not a pivot table).'],
  [''],
  ['Required columns'],
  ['shipment_date', 'Date of shipment (YYYY-MM-DD)'],
  ['shipper', 'Customer / company name'],
  ['final_amount', 'Revenue or invoice amount (numbers only)'],
  [''],
  ['Recommended columns'],
  ['shipping_method', 'AE, AN, AP, IE, IP, XL, etc.'],
  ['sales_leader', 'Sales owner / KAM name'],
  ['final_weight', 'Chargeable or gross weight'],
  ['customer_code', 'Your internal account code'],
  ['notes', 'Free text'],
  [''],
  ['Reports this enables'],
  ['• Last 60 days revenue', '• Top shippers by amount'],
  ['• Amount by shipping method', '• Amount by sales leader'],
  ['• Last trade date per customer', '• Inactive 60+ days (preview)'],
  [''],
  ['Do not upload CRM pipeline exports or pivot summaries here — use this layout only.'],
]

export function pickWorkspaceDataSheet(workbook) {
  const names = workbook.SheetNames || []
  if (!names.length) return null
  const preferred = ['workspace data', 'data', 'shipments']
  for (const label of preferred) {
    const hit = names.find((n) => String(n).trim().toLowerCase() === label)
    if (hit) return workbook.Sheets[hit]
  }
  return workbook.Sheets[names[0]]
}

export function validateWorkspaceRows(rows) {
  if (!rows?.length) {
    return {
      ok: false,
      message: 'No data rows found. Use the workspace template "Data" sheet and keep the header row.',
    }
  }

  const keys = new Set()
  for (const row of rows.slice(0, 50)) {
    if (!row || typeof row !== 'object') continue
    for (const key of Object.keys(row)) keys.add(key)
  }

  const hasShipper = keys.has('shipper') || keys.has('company') || keys.has('customer')
  const hasAmount =
    keys.has('final_amount') || keys.has('amount') || keys.has('revenue') || keys.has('final_amount_inr')
  const hasDate =
    keys.has('shipment_date') ||
    keys.has('trade_date') ||
    keys.has('date') ||
    keys.has('invoice_date')

  const missing = []
  if (!hasShipper) missing.push('shipper')
  if (!hasAmount) missing.push('final_amount')
  if (!hasDate) missing.push('shipment_date')

  if (missing.length) {
    return {
      ok: false,
      missing,
      message: `Missing required column(s): ${missing.join(', ')}. Download the workspace Excel template, copy your shipments into the "Data" sheet without changing the header names, then upload again.`,
    }
  }

  return { ok: true, hasShipper, hasAmount, hasDate }
}

export function downloadWorkspaceTemplateCsv(filename = 'company-workspace-template.csv') {
  const header = WORKSPACE_TEMPLATE_COLUMNS.join(',')
  const lines = WORKSPACE_TEMPLATE_SAMPLE_ROWS.map((row) =>
    WORKSPACE_TEMPLATE_COLUMNS.map((col) => {
      const v = row[col] ?? ''
      return `"${String(v).replace(/"/g, '""')}"`
    }).join(',')
  )
  const blob = new Blob([`${header}\n${lines.join('\n')}\n`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadWorkspaceTemplateXlsx(filename = 'company-workspace-template.xlsx') {
  const dataSheet = XLSX.utils.json_to_sheet(WORKSPACE_TEMPLATE_SAMPLE_ROWS, {
    header: WORKSPACE_TEMPLATE_COLUMNS,
  })
  const instructionsSheet = XLSX.utils.aoa_to_sheet(INSTRUCTIONS_ROWS)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, instructionsSheet, 'Instructions')
  XLSX.utils.book_append_sheet(wb, dataSheet, 'Data')
  XLSX.writeFile(wb, filename)
}
