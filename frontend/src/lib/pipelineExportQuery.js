import { serializePipelineFilters } from '../../../lib/server/pipelineQueryParams'

/** Build query string for GET /api/reports/pipeline-export from pipeline server filters. */
export function buildPipelineExportQuery(serverFilters = {}, { reportId } = {}) {
  const params = serializePipelineFilters(serverFilters)
  if (reportId) params.set('reportId', reportId)
  return params
}

export function triggerCsvDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
