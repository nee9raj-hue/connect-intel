import { updateStorePartial } from './store.js'

const MAX_DAILY_KEYS = 120
const MIN_PULSE_GAP_MS = 50_000
const MAX_MINUTES_PER_DAY = 480

function pruneDailyMap(map) {
  if (!map || typeof map !== 'object') return {}
  const keys = Object.keys(map).sort()
  while (keys.length > MAX_DAILY_KEYS) {
    delete map[keys.shift()]
  }
  return map
}

export function aggregateWorkspaceUsage(user, since) {
  const usage = user?.workspaceUsage || {}
  let minutes = 0
  let activeDays = 0
  let leadsOpened = 0

  for (const [date, mins] of Object.entries(usage.dailyMinutes || {})) {
    const t = new Date(date).getTime()
    if (Number.isNaN(t) || t < since) continue
    minutes += Number(mins) || 0
    if (mins > 0) activeDays += 1
  }

  for (const [date, leads] of Object.entries(usage.leadsOpenedDaily || {})) {
    const t = new Date(date).getTime()
    if (Number.isNaN(t) || t < since) continue
    leadsOpened += Object.keys(leads || {}).length
  }

  return {
    minutes,
    hours: Math.round((minutes / 60) * 10) / 10,
    activeDays,
    leadsOpened,
    lastActiveAt: usage.lastPulseAt || user?.lastLoginAt || null,
  }
}

/** Daily CRM time for charts (minutes per UTC day since `since`). */
export function buildDailyUsageSeries(user, since) {
  const usage = user?.workspaceUsage || {}
  const rows = []
  for (const [date, mins] of Object.entries(usage.dailyMinutes || {})) {
    const t = new Date(date).getTime()
    if (Number.isNaN(t) || t < since) continue
    rows.push({
      date,
      minutes: Number(mins) || 0,
      hours: Math.round(((Number(mins) || 0) / 60) * 10) / 10,
    })
  }
  rows.sort((a, b) => a.date.localeCompare(b.date))
  return rows
}

/** Record ~1 minute of active workspace time when tab is visible (debounced). */
export async function recordWorkspacePulse(userId, { panel = null, leadId = null } = {}) {
  if (!userId) return { ok: false }

  await updateStorePartial(['users'], (draft) => {
    const row = draft.users.find((u) => u.id === userId)
    if (!row) return draft

    const now = new Date()
    const todayKey = now.toISOString().slice(0, 10)
    const usage = row.workspaceUsage || {
      dailyMinutes: {},
      leadsOpenedDaily: {},
      panelHits: {},
      lastPulseAt: null,
    }

    const lastPulse = usage.lastPulseAt ? new Date(usage.lastPulseAt).getTime() : 0
    if (Date.now() - lastPulse >= MIN_PULSE_GAP_MS) {
      usage.dailyMinutes = pruneDailyMap(usage.dailyMinutes || {})
      usage.dailyMinutes[todayKey] = Math.min(
        MAX_MINUTES_PER_DAY,
        (usage.dailyMinutes[todayKey] || 0) + 1
      )
      usage.lastPulseAt = now.toISOString()
    }

    if (panel) {
      usage.panelHits = usage.panelHits || {}
      usage.panelHits[panel] = (usage.panelHits[panel] || 0) + 1
    }

    if (leadId) {
      usage.leadsOpenedDaily = pruneDailyMap(usage.leadsOpenedDaily || {})
      if (!usage.leadsOpenedDaily[todayKey]) usage.leadsOpenedDaily[todayKey] = {}
      usage.leadsOpenedDaily[todayKey][String(leadId)] = 1
    }

    row.workspaceUsage = usage
    return draft
  })

  return { ok: true }
}
