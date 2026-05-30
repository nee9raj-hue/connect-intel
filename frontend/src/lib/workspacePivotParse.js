import { normalizeImportRow } from './parseUpload'

function norm(cell) {
  return String(cell ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
}

function parseNum(value) {
  if (value == null || value === '') return 0
  const n = Number(String(value).replace(/[,₹\s]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function isMethodCode(text) {
  const t = norm(text).replace(/\s/g, '')
  if (!t || t.length > 4) return false
  if (/^(ae|an|ap|ie|ip|xl|sea|air|lcl|fcl|exw|ddp|dap)$/.test(t)) return true
  return /^[a-z]{2,3}$/i.test(t)
}

/** Detect Xindus-style pivot: Sales lead + Shipper rows, AE/AN/AP method columns, Sum of Final Amount. */
export function detectLogisticsPivot(matrix) {
  if (!matrix?.length || matrix.length < 4) return false
  for (let r = 0; r < Math.min(12, matrix.length - 1); r++) {
    const row = matrix[r] || []
    const texts = row.map(norm)
    const hasShipper = texts.some((t) => t === 'shipper' || t.includes('shipper'))
    const hasMethod = texts.some(isMethodCode)
    const next = (matrix[r + 1] || []).map(norm)
    const hasAmountSub = next.some((t) => t.includes('final amount') || t.includes('sum of final amount'))
    if (hasShipper && (hasMethod || hasAmountSub)) return true
  }
  return false
}

function findHeaderRows(matrix) {
  for (let r = 0; r < Math.min(12, matrix.length - 1); r++) {
    const texts = (matrix[r] || []).map(norm)
    const next = (matrix[r + 1] || []).map(norm)
    const hasShipper = texts.some((t) => t === 'shipper' || (t.includes('sales') && t.includes('lead')) || t.includes('shipper'))
    const hasAmountSub = next.some((t) => t.includes('final amount'))
    const hasMethod = texts.some(isMethodCode)
    if (texts.some((t) => t.includes('shipper')) && (hasAmountSub || hasMethod)) {
      return { headerRow: r, subHeaderRow: r + 1 }
    }
  }
  return null
}

function findMethodBlocks(headerRow, subRow) {
  const blocks = []
  const seen = new Set()
  for (let c = 0; c < headerRow.length; c++) {
    const methodRaw = norm(headerRow[c]).replace(/\s/g, '')
    if (!isMethodCode(methodRaw)) continue
    const method = methodRaw.toUpperCase()
    const subA = norm(subRow[c])
    const subB = norm(subRow[c + 1] || '')
    let amountCol = c
    let weightCol = null
    if (subA.includes('amount')) {
      amountCol = c
      weightCol = subB.includes('weight') ? c + 1 : null
    } else if (subB.includes('amount')) {
      amountCol = c + 1
      weightCol = norm(subRow[c + 2] || '').includes('weight') ? c + 2 : null
    } else {
      amountCol = c
      weightCol = c + 1
    }
    const key = `${method}:${amountCol}`
    if (seen.has(key)) continue
    seen.add(key)
    blocks.push({ method, amountCol, weightCol })
  }
  return blocks
}

/**
 * Flatten pivot export → one row per shipper × shipping method (long format).
 */
export function flattenLogisticsPivot(matrix) {
  const hdr = findHeaderRows(matrix)
  if (!hdr) return []

  const headerRow = matrix[hdr.headerRow] || []
  const subRow = matrix[hdr.subHeaderRow] || []

  let salesLeaderCol = 0
  let shipperCol = 1
  for (let c = 0; c < headerRow.length; c++) {
    const t = norm(headerRow[c])
    if (t.includes('sales') && t.includes('lead')) salesLeaderCol = c
    if (t === 'shipper' || (t.includes('shipper') && !t.includes('total'))) shipperCol = c
  }

  const methodBlocks = findMethodBlocks(headerRow, subRow)
  let totalAmountCol = -1
  let totalWeightCol = -1
  for (let c = 0; c < headerRow.length; c++) {
    const t = norm(headerRow[c])
    if (t.includes('total') && t.includes('amount')) totalAmountCol = c
    if (t.includes('total') && (t.includes('weight') || t.includes('gross'))) totalWeightCol = c
  }

  const out = []
  let currentLeader = ''
  const dataStart = hdr.subHeaderRow + 1

  for (let r = dataStart; r < matrix.length; r++) {
    const row = matrix[r] || []
    const leaderCell = String(row[salesLeaderCol] ?? '').trim()
    if (leaderCell && !norm(leaderCell).includes('sales')) currentLeader = leaderCell

    const shipper = String(row[shipperCol] ?? '').trim()
    if (!shipper || norm(shipper) === 'shipper' || norm(shipper).includes('grand total')) continue

    let rowHasMetric = false
    for (const block of methodBlocks) {
      const amount = parseNum(row[block.amountCol])
      const weight = block.weightCol != null ? parseNum(row[block.weightCol]) : 0
      if (amount === 0 && weight === 0) continue
      rowHasMetric = true
      out.push(
        normalizeImportRow({
          sales_leader: currentLeader,
          shipper,
          company: shipper,
          customer: shipper,
          shipping_method: block.method,
          final_amount: amount,
          amount,
          revenue: amount,
          final_weight: weight,
          weight,
        })
      )
    }

    if (!rowHasMetric && totalAmountCol >= 0) {
      const amount = parseNum(row[totalAmountCol])
      const weight = totalWeightCol >= 0 ? parseNum(row[totalWeightCol]) : 0
      if (amount > 0 || weight > 0) {
        out.push(
          normalizeImportRow({
            sales_leader: currentLeader,
            shipper,
            company: shipper,
            customer: shipper,
            shipping_method: 'TOTAL',
            final_amount: amount,
            amount,
            revenue: amount,
            final_weight: weight,
            weight,
          })
        )
      }
    }
  }

  return out
}

export function parseSheetWithPivotSupport(sheet, xlsx) {
  const matrix = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  if (detectLogisticsPivot(matrix)) {
    const flat = flattenLogisticsPivot(matrix)
    if (flat.length) return { rows: flat, format: 'logistics_pivot' }
  }
  const raw = xlsx.utils.sheet_to_json(sheet, { defval: '' })
  return {
    rows: raw.map(normalizeImportRow).filter((row) => Object.keys(row).length > 0),
    format: 'flat',
  }
}
