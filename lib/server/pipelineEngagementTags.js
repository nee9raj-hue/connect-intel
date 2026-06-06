import { createId, updateStore } from './store.js'
import { getOrganization } from './organizations.js'
import { normalizeExtendedCrm } from './crmWorkflow.js'
import { listOrgLeadTagDefinitions, normalizeLeadTagDefinition, slugifyName } from './orgLeadTags.js'
import { patchPipelineEntriesCrm } from './pipelineShard.js'

export const ENGAGEMENT_TAG_DEFS = [
  { slug: 'email_opened', name: 'Email opened', color: '#2563eb' },
  { slug: 'email_clicked', name: 'Email clicked', color: '#059669' },
]

function findEngagementTag(tags, slug) {
  return tags.find((t) => t.engagementSlug === slug || slugifyName(t.name) === slug)
}

/** Ensure org has open/click tags; returns map slug → tag id. */
export function ensureOrgEngagementTagIds(store, organizationId) {
  const org = getOrganization(store, organizationId)
  if (!org) return {}
  org.leadTags = Array.isArray(org.leadTags) ? org.leadTags : []
  const existing = listOrgLeadTagDefinitions(store, organizationId)
  const bySlug = {}

  for (const def of ENGAGEMENT_TAG_DEFS) {
    let tag = findEngagementTag(existing, def.slug) || findEngagementTag(org.leadTags, def.slug)
    if (!tag) {
      tag = normalizeLeadTagDefinition(
        {
          id: createId(),
          name: def.name,
          color: def.color,
          engagementSlug: def.slug,
          createdAt: new Date().toISOString(),
        },
        org.leadTags.length
      )
      org.leadTags.push(tag)
    }
    bySlug[def.slug] = tag.id
  }
  return bySlug
}

const EVENT_TO_TAG_SLUG = {
  open: 'email_opened',
  click: 'email_clicked',
}

/** Apply opened/clicked tag on a pipeline lead after a marketing event. */
export async function applyPipelineEngagementTag(user, { organizationId, leadId, type }) {
  const slug = EVENT_TO_TAG_SLUG[type]
  if (!slug || !organizationId || !leadId || !user?.id) return

  let tagId
  await updateStore((draft) => {
    const tagIds = ensureOrgEngagementTagIds(draft, organizationId)
    tagId = tagIds[slug]
    return draft
  })
  if (!tagId) return

  await patchPipelineEntriesCrm(user, [
    {
      leadId,
      updateCrm: (crm) => {
        const normalized = normalizeExtendedCrm(crm)
        if ((normalized.tagIds || []).includes(tagId)) return normalized
        return { ...normalized, tagIds: [...(normalized.tagIds || []), tagId] }
      },
    },
  ])
}
