import * as XLSX from 'xlsx'

export const ACTIVE_TRADING_COLUMNS = [
  'mobile',
  'company',
  'first_shipment_date',
  'last_shipment_date',
  'shipment_count',
  'shipments',
  'customer_code',
  'gstin',
  'notes',
]

export const ACTIVE_TRADING_SAMPLE_ROWS = [
  {
    mobile: '919876543210',
    company: 'Rajasthan Handicrafts Export House',
    first_shipment_date: '2026-01-15',
    last_shipment_date: '2026-03-20',
    shipment_count: 3,
    shipments: '2026-01-15; 2026-02-10; 2026-03-20',
    customer_code: 'CUST-1001',
    gstin: '08AAAAA0000A1Z5',
    notes: 'First load Jaipur → Mundra',
  },
]

export function downloadActiveTradingTemplateCsv() {
  const header = ACTIVE_TRADING_COLUMNS.join(',')
  const sample = ACTIVE_TRADING_COLUMNS.map((col) => {
    const v = ACTIVE_TRADING_SAMPLE_ROWS[0][col] || ''
    return `"${String(v).replace(/"/g, '""')}"`
  }).join(',')
  const blob = new Blob([`${header}\n${sample}\n`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'active-trading-import-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadActiveTradingTemplateXlsx() {
  const ws = XLSX.utils.json_to_sheet(ACTIVE_TRADING_SAMPLE_ROWS, { header: ACTIVE_TRADING_COLUMNS })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Active customers')
  XLSX.writeFile(wb, 'active-trading-import-template.xlsx')
}
