import { requireUser } from '../auth.js'
import { readStore, updateStore, createId } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import {
  filterMarketingEnrollmentsForUser,
  filterMarketingRows,
  filterMarketingRowsForUser,
  marketingScopeKey,
  requireMarketingUser,
  rowInMarketingScope,
} from '../marketingAccess.js'
import {
  enrollCampaign,
  getMarketingCampaign,
  getMarketingList,
  getMarketingTemplate,
  marketingOverview,
  normalizeCampaignSteps,
  processDueEnrollments,
  resolveCampaignContent,
} from '../marketingCampaigns.js'
import { blocksToPlainText } from '../marketingEmailDesign.js'
import { buildCampaignReport, duplicateMarketingCampaign } from '../marketingCampaignReport.js'
import { logWhatsAppCampaignSend, refreshWhatsAppEnrollmentMessages } from '../marketingWhatsApp.js'
import { isWhatsAppCloudConfigured } from '../whatsappCloud.js'

function enrichCampaignSteps(steps) {
  return (steps || []).map((step) => ({
    ...step,
    body: step.body || (step.blocks?.length ? blocksToPlainText(step.blocks) : ''),
  }))
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const check = requireMarketingUser(sessionUser)
  if (!check.ok) return sendJson(res, 401, { error: check.error })

  const store = await readStore()
  const user = store.users.find((u) => u.id === sessionUser.id) || sessionUser

  if (req.method === 'GET') {
    if (req.query?.overview === '1') {
      await processDueEnrollments({ limit: 30 })
      return sendJson(res, 200, marketingOverview(await readStore(), user))
    }
    const campaignId = String(req.query?.campaignId || '').trim()
    if (campaignId) {
      const report = buildCampaignReport(store, user, campaignId)
      if (!report) return sendJson(res, 404, { error: 'Campaign not found' })
      return sendJson(res, 200, report)
    }
    const campaigns = filterMarketingRows(store.marketingCampaigns, user).sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
    )
    const enrollments = filterMarketingEnrollmentsForUser(store, user, store.marketingEnrollments)
    return sendJson(res, 200, { campaigns, enrollments })
  }

  if (req.method === 'POST') {
    const body = getBody(req)
    if (body.action === 'start') {
      return startCampaign(res, user, body.id)
    }
    if (body.action === 'log_whatsapp_sent') {
      const enrollmentId = body.enrollmentId || body.id
      if (!enrollmentId) return sendJson(res, 400, { error: 'enrollmentId is required' })
      try {
        const result = await logWhatsAppCampaignSend(user, enrollmentId)
        return sendJson(res, 200, result)
      } catch (e) {
        return sendJson(res, 400, { error: e.message || 'Could not log WhatsApp send' })
      }
    }
    if (body.action === 'duplicate') {
      const sourceId = body.id || body.campaignId
      if (!sourceId) return sendJson(res, 400, { error: 'Campaign id is required' })
      let created = null
      try {
        await updateStore((draft) => {
          created = duplicateMarketingCampaign(draft, user, sourceId)
          if (!created) throw new Error('Campaign not found')
          return draft
        })
      } catch (e) {
        return sendJson(res, 404, { error: e.message || 'Campaign not found' })
      }
      return sendJson(res, 201, { campaign: created })
    }

    const {
      name,
      listId,
      templateId,
      type,
      channel,
      subject,
      body: emailBody,
      steps,
      blocks,
      design,
      previewText,
    } = body
    const campaignChannel = channel === 'whatsapp' ? 'whatsapp' : 'email'
    if (!String(name || '').trim()) return sendJson(res, 400, { error: 'Campaign name is required' })
    if (!listId) return sendJson(res, 400, { error: 'listId is required' })

    const list = getMarketingList(store, user, listId)
    if (!list) return sendJson(res, 404, { error: 'List not found' })

    const template = getMarketingTemplate(store, user, templateId)
    const resolved = resolveCampaignContent(
      { subject, body: emailBody, steps, blocks, design, previewText },
      template
    )
    const firstStep = resolved.steps[0]
    if (!firstStep?.body && !firstStep?.blocks?.length) {
      return sendJson(res, 400, { error: 'Message content is required' })
    }
    if (campaignChannel === 'email' && !firstStep?.subject) {
      return sendJson(res, 400, { error: 'Email subject is required' })
    }

    const now = new Date().toISOString()
    const campaign = {
      id: createId('mcamp'),
      ...marketingScopeKey(user),
      name: String(name).trim().slice(0, 120),
      type: type === 'sequence' ? 'sequence' : 'one_shot',
      channel: campaignChannel,
      listId,
      templateId: template?.id || null,
      subject: resolved.subject,
      body: resolved.body,
      blocks: resolved.blocks || null,
      design: resolved.design || null,
      previewText: resolved.previewText || null,
      steps: enrichCampaignSteps(resolved.steps),
      status: 'draft',
      stats: { enrolled: 0, sent: 0, failed: 0, unsubscribed: 0 },
      createdByUserId: user.id,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
    }

    await updateStore((draft) => {
      draft.marketingCampaigns = draft.marketingCampaigns || []
      draft.marketingCampaigns.push(campaign)
      return draft
    })
    return sendJson(res, 201, { campaign })
  }

  if (req.method === 'PATCH') {
    const body = getBody(req)
    if (body.action === 'start') {
      return startCampaign(res, user, body.id)
    }
    if (body.action === 'pause') {
      return pauseCampaign(res, user, body.id)
    }

    const { id, name, listId, templateId, subject, body: emailBody, steps } = body
    const existing = getMarketingCampaign(store, user, id)
    if (!existing) return sendJson(res, 404, { error: 'Campaign not found' })
    if (existing.status !== 'draft') {
      return sendJson(res, 400, { error: 'Only draft campaigns can be edited' })
    }

    await updateStore((draft) => {
      const row = draft.marketingCampaigns.find((c) => c.id === id)
      if (!row) return draft
      if (name !== undefined) row.name = String(name).trim().slice(0, 120)
      if (listId !== undefined) row.listId = listId
      if (templateId !== undefined) row.templateId = templateId || null
      if (subject !== undefined) row.subject = String(subject).trim().slice(0, 500)
      if (emailBody !== undefined) row.body = String(emailBody).trim().slice(0, 12000)
      if (steps !== undefined) {
        row.steps = normalizeCampaignSteps(steps, row.subject, row.body)
        row.type = row.steps.length > 1 ? 'sequence' : 'one_shot'
      }
      row.updatedAt = new Date().toISOString()
      return draft
    })
    const updated = getMarketingCampaign(await readStore(), user, id)
    return sendJson(res, 200, { campaign: updated })
  }

  if (req.method === 'DELETE') {
    const id = getBody(req).id
    const existing = getMarketingCampaign(store, user, id)
    if (!existing) return sendJson(res, 404, { error: 'Campaign not found' })
    if (existing.status === 'active') {
      return sendJson(res, 400, { error: 'Pause the campaign before deleting' })
    }
    await updateStore((draft) => {
      draft.marketingCampaigns = (draft.marketingCampaigns || []).filter((c) => c.id !== id)
      draft.marketingEnrollments = (draft.marketingEnrollments || []).filter((e) => e.campaignId !== id)
      return draft
    })
    return sendJson(res, 200, { ok: true })
  }

  return methodNotAllowed(res, ['GET', 'POST', 'PATCH', 'DELETE'])
}

async function startCampaign(res, user, campaignId) {
  const store = await readStore()
  const campaign = getMarketingCampaign(store, user, campaignId)
  if (!campaign) return sendJson(res, 404, { error: 'Campaign not found' })
  if (campaign.status === 'active') {
    return sendJson(res, 400, { error: 'Campaign is already running' })
  }
  if (campaign.status === 'completed') {
    return sendJson(res, 400, { error: 'Campaign already completed' })
  }

  const list = getMarketingList(store, user, campaign.listId)
  if (!list?.leadIds?.length) {
    return sendJson(res, 400, { error: 'List has no leads' })
  }

  const enrolled = await enrollCampaign(store, user, campaign, list)
  if (!enrolled) {
    return sendJson(res, 400, {
      error:
        campaign.channel === 'whatsapp'
          ? 'No eligible leads with a valid phone number on file'
          : 'No eligible leads (need email on file and not unsubscribed)',
    })
  }

  const freshStore = await readStore()
  const sendResult =
    campaign.channel === 'whatsapp' && isWhatsAppCloudConfigured(user, freshStore)
      ? await processDueEnrollments({ campaignId, limit: enrolled })
      : campaign.channel === 'whatsapp'
        ? await refreshWhatsAppEnrollmentMessages(freshStore, user, campaign, {
            limit: enrolled,
          })
        : await processDueEnrollments({ campaignId })
  const fresh = marketingOverview(await readStore(), user)
  const updated = fresh.campaigns.find((c) => c.id === campaignId)
  return sendJson(res, 200, {
    campaign: updated,
    enrolled,
    sendResult,
    overview: fresh,
  })
}

async function pauseCampaign(res, user, campaignId) {
  const store = await readStore()
  const campaign = getMarketingCampaign(store, user, campaignId)
  if (!campaign) return sendJson(res, 404, { error: 'Campaign not found' })

  await updateStore((draft) => {
    const row = draft.marketingCampaigns.find((c) => c.id === campaignId)
    if (row) {
      row.status = 'paused'
      row.updatedAt = new Date().toISOString()
    }
    for (const e of draft.marketingEnrollments || []) {
      if (e.campaignId === campaignId && e.status === 'active') {
        e.status = 'paused'
        e.updatedAt = new Date().toISOString()
      }
    }
    return draft
  })

  const updated = getMarketingCampaign(await readStore(), user, campaignId)
  return sendJson(res, 200, { campaign: updated })
}
