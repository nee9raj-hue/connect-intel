import { readStore, updateStore } from './store.js'
import { getOrganization, buildOrgUserResponse } from './organizations.js'
import { loadPipelineStoreContext } from './pipelineShard.js'
import { buildAudienceRecommendationsFull } from './marketingAudienceRecommendations.js'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000

export function getAudienceRecommendationsCache(store, organizationId) {
  if (!organizationId) return null
  const org = getOrganization(store, organizationId)
  const cache = org?.crmSettings?.audienceRecommendationsCache
  if (!cache?.items || !cache.builtAt) return null
  if (Date.now() - new Date(cache.builtAt).getTime() > CACHE_TTL_MS) return null
  return cache.items
}

export async function saveAudienceRecommendationsCache(organizationId, items) {
  if (!organizationId) return
  await updateStore((draft) => {
    const org = getOrganization(draft, organizationId)
    if (!org) return draft
    org.crmSettings = org.crmSettings || {}
    org.crmSettings.audienceRecommendationsCache = {
      items: items || [],
      builtAt: new Date().toISOString(),
    }
    return draft
  })
}

function orgRepresentativeUser(store, organizationId) {
  const users = (store.users || []).filter((u) => u.organizationId === organizationId)
  return users.find((u) => u.isOrgAdmin) || users[0] || null
}

/** Full-pipeline scan + cache write — intended for cron only. */
export async function refreshAudienceRecommendationsForOrg(organizationId) {
  if (!organizationId) return 0

  const store = await readStore({
    only: [
      'organizations',
      'users',
      'organizationMemberships',
      'marketingSegments',
      'marketingCampaigns',
    ],
  })

  const dbUser = orgRepresentativeUser(store, organizationId)
  if (!dbUser) return 0

  const { pipelineStore } = await loadPipelineStoreContext(dbUser)
  const fullStore = { ...store, savedLeads: pipelineStore.savedLeads }
  const user = buildOrgUserResponse(dbUser, fullStore)

  const items = buildAudienceRecommendationsFull(fullStore, user, {
    campaigns: (store.marketingCampaigns || []).filter(
      (c) => c.organizationId === organizationId || c.orgId === organizationId
    ),
    segments: (store.marketingSegments || []).filter((s) => s.organizationId === organizationId),
  })

  await saveAudienceRecommendationsCache(organizationId, items)
  return items.length
}
