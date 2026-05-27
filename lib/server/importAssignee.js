import { listTeamMembers } from './organizations.js'

function levenshtein(a, b) {
  const m = a.length
  const n = b.length
  if (!m) return n
  if (!n) return m
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  return dp[m][n]
}

function normalizeAssigneeTokens(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/**
 * Resolve org pipeline assignee from import row:
 * – assignee_email / team_leader_email / owner_email (exact, case-insensitive)
 * – team_leader / assigned_to / assignee containing @ → treated as email
 * – Otherwise fuzzy-match name against active team member display names (typo-tolerant).
 */
export function resolveAssigneeUserIdForOrg(store, organizationId, row, fallbackUserId) {
  const members = listTeamMembers(store, organizationId).filter((m) => (m.status || 'active') === 'active')
  const byEmail = new Map(
    members.filter((m) => m.email).map((m) => [String(m.email).trim().toLowerCase(), m.userId])
  )

  const rawEmailCols = ['assignee_email', 'team_leader_email', 'owner_email', 'assignee_mail']
  for (const col of rawEmailCols) {
    const v = row[col]
    if (v == null || !String(v).trim()) continue
    const mail = String(v).trim().toLowerCase()
    if (byEmail.has(mail)) return byEmail.get(mail)
  }

  const nameCols = ['team_leader', 'team_leader_name', 'assigned_to', 'assignedto', 'assignee', 'owner']
  let nameCandidate = ''
  for (const col of nameCols) {
    const v = row[col]
    if (v == null || !String(v).trim()) continue
    const s = String(v).trim()
    if (s.includes('@')) {
      const mail = s.toLowerCase()
      if (byEmail.has(mail)) return byEmail.get(mail)
      continue
    }
    nameCandidate = s
    break
  }

  if (nameCandidate) {
    const target = normalizeAssigneeTokens(nameCandidate)
    if (!target) return fallbackUserId

    let bestUserId = null
    let bestDist = Infinity
    for (const m of members) {
      const mn = normalizeAssigneeTokens(m.name)
      if (!mn) continue
      if (mn === target) return m.userId
      const dist = levenshtein(target, mn)
      const maxLen = Math.max(target.length, mn.length)
      const threshold = maxLen <= 3 ? 0 : maxLen <= 6 ? 1 : 2
      if (dist <= threshold && dist < bestDist) {
        bestDist = dist
        bestUserId = m.userId
      }
    }
    if (bestUserId) return bestUserId
  }

  return fallbackUserId
}
