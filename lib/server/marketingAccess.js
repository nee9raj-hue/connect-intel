import { getOrganization, getPipelineLeadIds } from './organizations.js'

export function requireMarketingUser(user) {
  if (!user?.id) return { ok: false, error: 'Sign in required' }
  return { ok: true, user }
}

export function isOrgMarketingAdmin(user) {
  return Boolean(
    user?.organizationId && (user.isOrgAdmin || user.orgRole === 'org_admin' || user.isPlatformAdmin)
  )
}

export function marketingScopeKey(user) {
  if (user.organizationId) {
    return { organizationId: user.organizationId, createdByUserId: null }
  }
  return { organizationId: null, createdByUserId: user.id }
}

export function rowInMarketingScope(row, user) {
  if (!row || !user) return false
  if (user.organizationId) return row.organizationId === user.organizationId
  return row.createdByUserId === user.id && !row.organizationId
}

/** Company admins see all org assets; reps only see what they created. */
export function canAccessMarketingAsset(row, user) {
  if (!rowInMarketingScope(row, user)) return false
  if (!user.organizationId) {
    return !row.createdByUserId || row.createdByUserId === user.id
  }
  if (isOrgMarketingAdmin(user)) return true
  return row.createdByUserId === user.id
}

/** View reports and org-wide stats; org members can read any org campaign. */
export function canViewMarketingCampaign(row, user) {
  if (!rowInMarketingScope(row, user)) return false
  if (!user.organizationId) return canAccessMarketingAsset(row, user)
  return row.organizationId === user.organizationId
}

export function marketingCampaignIdsForUser(store, user) {
  const campaigns = store.marketingCampaigns || []
  if (user.organizationId) {
    return new Set(campaigns.filter((c) => canViewMarketingCampaign(c, user)).map((c) => c.id))
  }
  return new Set(filterMarketingRows(campaigns, user).map((c) => c.id))
}

export function filterMarketingRows(rows, user) {
  return (rows || []).filter((row) => canAccessMarketingAsset(row, user))
}

/** Campaign list + overview: org members see all org campaigns (read); manage stays creator-only. */
export function filterMarketingCampaignsVisible(rows, user) {
  return (rows || []).filter((row) => canViewMarketingCampaign(row, user))
}

export function resolveMarketingCreatorName(store, userId) {
  if (!userId) return 'Team'
  const u = (store.users || []).find((row) => row.id === userId)
  return u?.name || u?.email?.split('@')[0] || 'Team member'
}

export function enrichMarketingRows(store, viewer, rows) {
  return (rows || []).map((row) => ({
    ...row,
    createdByName: resolveMarketingCreatorName(store, row.createdByUserId),
    isOwn: row.createdByUserId === viewer.id,
  }))
}

/**
 * Filter marketing assets by creator (reps) and optionally trim list leadIds to visible pipeline.
 */
export function filterMarketingAssets(
  store,
  user,
  rows,
  { filterLeadIds = false, hideEmptyLists = true } = {}
) {
  let result = filterMarketingRows(rows, user)
  if (filterLeadIds) {
    const visibleLeadIds = getPipelineLeadIds(store, user)
    result = result.map((row) => {
      if (!Array.isArray(row.leadIds)) return row
      const leadIds = row.leadIds.filter((id) => visibleLeadIds.has(id))
      return { ...row, leadIds }
    })
    if (hideEmptyLists) {
      result = result.filter((row) => !Array.isArray(row.leadIds) || row.leadIds.length > 0)
    }
  }
  return result
}

/** @deprecated Use filterMarketingAssets — kept for imports that only need lead trimming on lists. */
export function filterMarketingRowsForUser(store, user, rows) {
  return filterMarketingAssets(store, user, rows, { filterLeadIds: true })
}

/** Campaign report enrollments: all rows for the campaign (not limited to assigned pipeline leads). */
export function filterCampaignEnrollmentsForReport(store, user, enrollments, campaignId) {
  const campaignIds = marketingCampaignIdsForUser(store, user)
  if (!campaignId || !campaignIds.has(campaignId)) return []
  return (enrollments || []).filter(
    (row) => rowInMarketingScope(row, user) && row.campaignId === campaignId
  )
}

/** Legacy helper — still scopes enrollments to visible pipeline leads (non-report flows). */
export function filterMarketingEnrollmentsForUser(store, user, rows) {
  const visibleLeadIds = getPipelineLeadIds(store, user)
  const campaignIds = marketingCampaignIdsForUser(store, user)
  return (rows || []).filter(
    (row) =>
      rowInMarketingScope(row, user) &&
      visibleLeadIds.has(row.leadId) &&
      (!row.campaignId || campaignIds.has(row.campaignId))
  )
}

export function getUserOrg(store, user) {
  if (!user.organizationId) return null
  return getOrganization(store, user.organizationId)
}
