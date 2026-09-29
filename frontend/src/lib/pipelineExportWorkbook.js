import * as XLSX from 'xlsx'

function setWidths(sheet, rows) {
  const keys = Object.keys(rows[0] || {})
  sheet['!cols'] = keys.map((key) => ({
    wch: Math.min(42, Math.max(12, key.length, ...rows.map((row) => String(row[key] || '').slice(0, 42).length))),
  }))
}

function worksheet(rows, fallbackColumns) {
  const values = rows.length ? rows : [Object.fromEntries(fallbackColumns.map((column) => [column, '']))]
  const sheet = XLSX.utils.json_to_sheet(values)
  setWidths(sheet, values)
  return sheet
}

export function downloadPipelineWorkbook(data) {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    workbook,
    worksheet(data.leadRows || [], ['Name', 'Company', 'Phone', 'Email', 'Lead owner', 'Status', 'Last shipment date', 'Tags', 'Deals', 'Last touch date', 'Notes']),
    'Leads'
  )
  XLSX.utils.book_append_sheet(
    workbook,
    worksheet(
      data.dealRows || [],
      ['Lead name', 'Company', 'Lead owner', 'Deal', 'Stage', 'Freight', 'Revenue', 'Currency', 'Type', 'Mode', 'Route / lane', 'Gross weight', 'Invoice amount', 'Expected close', 'Query received', 'Rates quoted', 'Booked', 'Won', 'Lost', 'Updated', 'Notes']
    ),
    'Deals'
  )
  XLSX.writeFile(workbook, 'pipeline-export.xlsx')
}
