import * as XLSX from 'xlsx'
import { detectLogisticsPivot, flattenLogisticsPivot, parseSheetWithPivotSupport } from './workspacePivotParse'
import { pickWorkspaceDataSheet, validateWorkspaceRows } from './workspaceImportTemplate'

function splitCsvLine(line) {
  const values = []
  let current = ''
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]

    if (char === '"') {
      const next = line[index + 1]
      if (quoted && next === '"') {
        current += '"'
        index += 1
      } else {
        quoted = !quoted
      }
      continue
    }

    if (char === ',' && !quoted) {
      values.push(current)
      current = ''
      continue
    }

    current += char
  }

  values.push(current)
  return values.map((value) => value.trim())
}

/** Normalize header keys from user spreadsheets (spaces, case, BOM). */
export function normalizeImportRow(row) {
  if (!row || typeof row !== 'object') return {}
  const out = {}
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = String(key || '')
      .replace(/^\uFEFF/, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
    if (!normalizedKey || normalizedKey.startsWith('__empty')) continue
    out[normalizedKey] = value
  }
  if (!out.company && out.company_name) out.company = out.company_name
  if (!out.company && out.business_name) out.company = out.business_name
  if (!out.first_name && out.firstname) out.first_name = out.firstname
  if (!out.last_name && out.lastname) out.last_name = out.lastname
  if (!out.email && out.work_email) out.email = out.work_email
  if (!out.phone && out.mobile) out.phone = out.mobile
  return out
}

export function rowHasImportCompany(row) {
  const normalized = normalizeImportRow(row)
  const company = String(
    normalized.company ||
      normalized.business_name ||
      normalized.company_name ||
      ''
  ).trim()
  return Boolean(company)
}

export function summarizeImportRows(rows) {
  const normalized = (rows || []).map(normalizeImportRow)
  const withCompany = normalized.filter((r) =>
    Boolean(
      String(r.company || r.business_name || r.company_name || '').trim()
    )
  )
  return {
    total: normalized.length,
    withCompany: withCompany.length,
    rows: normalized,
  }
}

function pickWorkbookSheet(workbook) {
  const names = workbook.SheetNames || []
  if (!names.length) return null

  const dataSheetName = names.find((n) => /^data$/i.test(String(n).trim()))
  if (dataSheetName) return workbook.Sheets[dataSheetName]

  for (const name of names) {
    const sheet = workbook.Sheets[name]
    if (!sheet) continue
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
    const headerRow = (matrix[0] || []).map((cell) =>
      String(cell || '')
        .trim()
        .toLowerCase()
    )
    if (headerRow.some((h) => h === 'company' || h === 'company_name' || h === 'business_name')) {
      return sheet
    }
  }

  return workbook.Sheets[names[0]]
}

export function parseCsvText(text) {
  const lines = String(text || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line) => line.trim())

  if (lines.length < 2) return []

  const headers = splitCsvLine(lines[0]).map((h) =>
    h
      .replace(/^\uFEFF/, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
  )

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line)
    const row = headers.reduce((acc, header, index) => {
      if (header) acc[header] = values[index] || ''
      return acc
    }, {})
    return normalizeImportRow(row)
  })
}

/** Workspace upload — prefers template Data sheet; optional pivot flatten with warning. */
export async function parseWorkspaceUploadFile(file) {
  const lowerName = file.name.toLowerCase()
  if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const templateSheet = pickWorkspaceDataSheet(workbook)
    if (!templateSheet) return { rows: [], format: 'empty', validation: validateWorkspaceRows([]) }

    const matrix = XLSX.utils.sheet_to_json(templateSheet, { header: 1, defval: '' })
    const headerRow = (matrix[0] || []).map((c) => String(c || '').trim().toLowerCase())
    const looksLikeTemplate = headerRow.includes('shipment_date') && headerRow.includes('shipper')

    if (looksLikeTemplate) {
      const raw = XLSX.utils.sheet_to_json(templateSheet, { defval: '' })
      const rows = raw.map(normalizeImportRow).filter((row) => Object.keys(row).length > 0)
      const validation = validateWorkspaceRows(rows)
      return { rows, format: 'template', validation }
    }

    if (detectLogisticsPivot(matrix)) {
      const rows = flattenLogisticsPivot(matrix)
      if (rows.length) {
        return {
          rows,
          format: 'logistics_pivot',
          validation: {
            ok: true,
            pivotWarning:
              'Pivot layout detected. For reliable reports, use the downloadable workspace template (one row per shipment).',
          },
        }
      }
    }

    const parsed = parseSheetWithPivotSupport(templateSheet, XLSX)
    const validation = validateWorkspaceRows(parsed.rows)
    return { ...parsed, validation }
  }
  const rows = await parseUploadFile(file)
  const validation = validateWorkspaceRows(rows)
  return { rows, format: 'flat', validation }
}

export async function parseUploadFile(file) {
  const lowerName = file.name.toLowerCase()

  if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = pickWorkbookSheet(workbook)
    if (!sheet) return []
    const parsed = parseSheetWithPivotSupport(sheet, XLSX)
    return parsed.rows
  }

  const text = await file.text()
  if (file.name.toLowerCase().endsWith('.json')) {
    const parsed = JSON.parse(text)
    const list = Array.isArray(parsed) ? parsed : []
    return list.map(normalizeImportRow)
  }
  return parseCsvText(text)
}
