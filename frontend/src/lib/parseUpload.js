import * as XLSX from 'xlsx'

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

export function parseCsvText(text) {
  const lines = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line) => line.trim())

  if (lines.length < 2) return []

  const headers = splitCsvLine(lines[0])
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line)
    return headers.reduce((row, header, index) => {
      row[header] = values[index] || ''
      return row
    }, {})
  })
}

export async function parseUploadFile(file) {
  const lowerName = file.name.toLowerCase()

  if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const firstSheet = workbook.SheetNames[0]
    if (!firstSheet) return []
    return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: '' })
  }

  const text = await file.text()
  if (file.name.toLowerCase().endsWith('.json')) {
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? parsed : []
  }
  return parseCsvText(text)
}
