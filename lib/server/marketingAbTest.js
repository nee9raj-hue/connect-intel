import crypto from 'node:crypto'

/**
 * Assign A/B variant for a lead. Deterministic hash for consistency.
 */
export function assignAbVariant(campaign, leadId) {
  const ab = campaign?.abTest
  if (!ab?.enabled || !Array.isArray(ab.variants) || ab.variants.length < 2) {
    return null
  }
  const variants = ab.variants.filter((v) => v?.id)
  if (!variants.length) return null

  const weights = variants.map((v) => Math.max(1, Number(v.weight) || 1))
  const total = weights.reduce((a, b) => a + b, 0)
  const hash = crypto.createHash('sha256').update(`${campaign.id}:${leadId}`).digest()
  const bucket = hash.readUInt32BE(0) % total

  let acc = 0
  for (let i = 0; i < variants.length; i++) {
    acc += weights[i]
    if (bucket < acc) return variants[i].id
  }
  return variants[0].id
}

export function resolveAbVariantContent(campaign, template, variantId) {
  const ab = campaign?.abTest
  if (!ab?.enabled || !variantId) return null
  const variant = (ab.variants || []).find((v) => v.id === variantId)
  if (!variant) return null

  return {
    subject: variant.subject || campaign.subject || template?.subject || '',
    body: variant.body || campaign.body || template?.body || '',
    blocks: variant.blocks?.length ? variant.blocks : campaign.blocks || template?.blocks,
    design: variant.design || campaign.design || template?.design,
    previewText: variant.previewText || campaign.previewText || template?.previewText,
  }
}

export function mergeCampaignContentWithVariant(campaign, template, variantId) {
  const variantContent = resolveAbVariantContent(campaign, template, variantId)
  if (!variantContent) return { campaign, template }

  const mergedCampaign = {
    ...campaign,
    subject: variantContent.subject,
    body: variantContent.body,
    blocks: variantContent.blocks,
    design: variantContent.design,
    previewText: variantContent.previewText,
  }
  return { campaign: mergedCampaign, template }
}

export function summarizeAbVariants(campaign, enrollments = [], events = []) {
  const ab = campaign?.abTest
  if (!ab?.enabled) return null

  const byVariant = {}
  for (const v of ab.variants || []) {
    byVariant[v.id] = {
      id: v.id,
      label: v.label || v.id,
      enrolled: 0,
      sent: 0,
      opens: 0,
      clicks: 0,
      uniqueOpens: 0,
      uniqueClicks: 0,
    }
  }

  const openLeads = new Map()
  const clickLeads = new Map()

  for (const e of enrollments) {
    const vid = e.abVariantId || 'control'
    if (!byVariant[vid]) byVariant[vid] = { id: vid, label: vid, enrolled: 0, sent: 0, opens: 0, clicks: 0, uniqueOpens: 0, uniqueClicks: 0 }
    byVariant[vid].enrolled += 1
    byVariant[vid].sent += e.sentCount || 0
  }

  for (const ev of events) {
    const vid = ev.abVariantId || 'control'
    if (!byVariant[vid]) continue
    if (ev.type === 'open') {
      byVariant[vid].opens += 1
      if (ev.leadId && !openLeads.has(`${vid}:${ev.leadId}`)) {
        openLeads.set(`${vid}:${ev.leadId}`, true)
        byVariant[vid].uniqueOpens += 1
      }
    }
    if (ev.type === 'click') {
      byVariant[vid].clicks += 1
      if (ev.leadId && !clickLeads.has(`${vid}:${ev.leadId}`)) {
        clickLeads.set(`${vid}:${ev.leadId}`, true)
        byVariant[vid].uniqueClicks += 1
      }
    }
  }

  return Object.values(byVariant)
}
