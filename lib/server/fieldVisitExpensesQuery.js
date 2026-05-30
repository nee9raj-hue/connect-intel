import { normalizeExtendedCrm } from './crmWorkflow.js'
import { listPipelineSavedEntries } from './organizations.js'
import {
  buildLeadDestinationLabel,
  computeTravelClaimAmount,
  travelModeLabel,
} from '../fieldVisitExpenses.js'
import { getOrgFieldVisitExpenseSettings } from './fieldVisitExpenseSettings.js'

function leadDisplayName(lead) {
  const n = [lead?.firstName, lead?.lastName].filter(Boolean).join(' ').trim()
  return n || lead?.company || 'Lead'
}

function visitOwnerIds(entry, meeting) {
  return [
    meeting.visitLoggedByUserId,
    meeting.assignedToUserId,
    entry.assignedToUserId,
    entry.savedByUserId,
    entry.userId,
  ].filter(Boolean)
}

function userCanSeeVisit(user, entry, meeting) {
  if (user.isOrgAdmin || user.orgRole === 'org_admin') return true
  const uid = String(user.id)
  return visitOwnerIds(entry, meeting).some((id) => String(id) === uid)
}

function parseMonth(monthStr) {
  const m = String(monthStr || '').trim()
  if (!/^\d{4}-\d{2}$/.test(m)) return null
  const [y, mo] = m.split('-').map(Number)
  if (!y || mo < 1 || mo > 12) return null
  return { year: y, month: mo, key: m }
}

function visitTimestamp(meeting) {
  return (
    meeting.visitTravel?.visitAt ||
    meeting.actualVisitAt ||
    meeting.visitRecordedAt ||
    meeting.scheduledAt ||
    null
  )
}

function inMonth(iso, monthInfo) {
  if (!monthInfo || !iso) return true
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return false
  return d.getFullYear() === monthInfo.year && d.getMonth() + 1 === monthInfo.month
}

export function listFieldVisitExpenseRows(
  store,
  user,
  { month, assigneeUserId, organizationId } = {}
) {
  const monthInfo = month ? parseMonth(month) : null
  const settings = organizationId
    ? getOrgFieldVisitExpenseSettings(store, organizationId)
    : null

  let entries = listPipelineSavedEntries(store, user)
  if (organizationId) {
    entries = entries.filter((e) => e.organizationId === organizationId)
  }

  const rows = []
  for (const entry of entries) {
    const lead = entry.lead || {}
    const crm = normalizeExtendedCrm(entry.crm)
    for (const meeting of crm.meetings) {
      if (meeting.type !== 'field_visit' || !meeting.visitRecordedAt) continue
      if (!userCanSeeVisit(user, entry, meeting)) continue

      const owners = visitOwnerIds(entry, meeting)
      const primaryOwner = meeting.visitLoggedByUserId || meeting.assignedToUserId || entry.assignedToUserId
      if (assigneeUserId && !owners.some((id) => String(id) === String(assigneeUserId))) continue

      const at = visitTimestamp(meeting)
      if (!inMonth(at, monthInfo)) continue

      const travel = meeting.visitTravel || null
      const claimAmount = travel ? computeTravelClaimAmount(travel, settings) : 0

      rows.push({
        id: `${lead.id}:${meeting.id}`,
        leadId: lead.id,
        meetingId: meeting.id,
        leadName: leadDisplayName(lead),
        company: lead.company || '',
        visitAt: at,
        recordedAt: meeting.visitRecordedAt,
        outcome: meeting.visitOutcome || '',
        notes: meeting.visitNotes || '',
        title: meeting.title || 'Field visit',
        loggedByUserId: primaryOwner || null,
        travel: travel
          ? {
              ...travel,
              modeLabel: travelModeLabel(travel.mode),
              claimAmount,
            }
          : null,
        claimAmount,
        destination: travel?.endLabel || meeting.location || buildLeadDestinationLabel(lead),
        startLocation: travel?.startLabel || '',
      })
    }
  }

  rows.sort((a, b) => new Date(b.visitAt || 0).getTime() - new Date(a.visitAt || 0).getTime())
  return rows
}

export function summarizeFieldVisitRows(rows) {
  let totalClaim = 0
  let totalKm = 0
  let visitCount = rows.length
  let withTravel = 0
  for (const row of rows) {
    totalClaim += Number(row.claimAmount) || 0
    if (row.travel) {
      withTravel += 1
      if (row.travel.mode === 'bike' || row.travel.mode === 'car') {
        totalKm += Number(row.travel.distanceKm) || 0
      }
    }
  }
  return {
    visitCount,
    withTravel,
    totalKm: Math.round(totalKm * 10) / 10,
    totalClaim: Math.round(totalClaim * 100) / 100,
  }
}
