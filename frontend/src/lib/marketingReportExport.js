import * as XLSX from 'xlsx'

function recipientExportRow(r) {
  return {
    Name: r.name,
    Email: r.email,
    Phone: r.phone || '',
    Company: r.company,
    Status: r.deliveryStatus,
    Opens: r.opens,
    Clicks: r.clicks,
    Sent: r.sentCount,
    Error: r.lastError || '',
    LastOpen: r.lastOpenAt || '',
    LastClick: r.lastClickAt || '',
  }
}

export function exportCampaignReportCsv(report, filename = 'campaign-report.csv') {
  const rows = report?.recipients || []
  const headers = 'name,email,phone,company,delivery,opens,clicks,sent_count,last_error,last_open,last_click'
  const lines = [
    headers,
    ...rows.map((r) =>
      [
        r.name,
        r.email,
        r.phone,
        r.company,
        r.deliveryStatus,
        r.opens,
        r.clicks,
        r.sentCount,
        r.lastError,
        r.lastOpenAt,
        r.lastClickAt,
      ]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(',')
    ),
  ]
  downloadBlob(lines.join('\n'), filename, 'text/csv')
}

export function exportCampaignReportExcel(report, filename = 'campaign-report.xlsx') {
  const rows = (report?.recipients || []).map(recipientExportRow)
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Recipients')
  if (report?.stats) {
    const statsRows = Object.entries(report.stats).map(([k, v]) => ({ Metric: k, Value: v }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(statsRows), 'Summary')
  }
  if (report?.abVariants?.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(report.abVariants), 'AB Variants')
  }
  if (report?.revenue?.deals?.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(report.revenue.deals), 'Revenue')
  }
  XLSX.writeFile(wb, filename)
}

export function exportCampaignReportPdf(report) {
  const w = window.open('', '_blank', 'noopener,noreferrer')
  if (!w) return
  const stats = report?.stats || {}
  const rev = report?.revenue || {}
  const rows = report?.recipients || []
  w.document.write(`<!DOCTYPE html><html><head><title>${report?.campaign?.name || 'Report'}</title>
    <style>body{font-family:system-ui,sans-serif;padding:24px}table{border-collapse:collapse;width:100%;font-size:12px}
    th,td{border:1px solid #ddd;padding:6px;text-align:left}th{background:#f1f5f9}</style></head><body>
    <h1>${report?.campaign?.name || 'Campaign report'}</h1>
    <p>Sent: ${stats.sent || 0} · Opens: ${stats.uniqueOpens || 0} (${stats.openRate || 0}%) · Clicks: ${stats.uniqueClicks || 0}</p>
    <p>Attributed revenue: ${rev.attributedRevenue || 0} ${rev.currency || ''} (${rev.attributedDeals || 0} deals)</p>
    <table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Company</th><th>Status</th><th>Opens</th><th>Clicks</th></tr></thead><tbody>
    ${rows
      .slice(0, 200)
      .map(
        (r) =>
          `<tr><td>${r.name || ''}</td><td>${r.email || ''}</td><td>${r.phone || ''}</td><td>${r.company || ''}</td><td>${r.deliveryStatus}</td><td>${r.opens}</td><td>${r.clicks}</td></tr>`
      )
      .join('')}
    </tbody></table></body></html>`)
  w.document.close()
  w.focus()
  w.print()
}

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
