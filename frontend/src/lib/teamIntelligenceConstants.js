export const INTEL_CHART_COLORS = [
  '#00a4bd',
  '#ff7a59',
  '#516f90',
  '#25d366',
  '#f5c518',
  '#7c3aed',
  '#647185',
  '#e85d75',
]

export function formatDelta(delta) {
  if (delta == null || Number.isNaN(delta)) return null
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta}%`
}

export function formatHours(h) {
  if (h == null) return '0h'
  if (h < 1) return `${Math.round(h * 60)}m`
  return `${h}h`
}

export function formatShortDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  } catch {
    return '—'
  }
}
