import { requireUser } from '../auth.js'
import { readStore, updateStore } from '../store.js'
import { findPipelineEntry } from '../pipelineAccess.js'
import { appendActivity, normalizeExtendedCrm } from '../crmWorkflow.js'
import { resolveWhatsAppCloudConfig, sendWhatsAppCloudMessage } from '../whatsappCloud.js'
import { normalizePhoneDigits } from '../phoneUtils.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'

const MAX_BULK = 50
const SEND_DELAY_MS = 250

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const store = await readStore()
  const user = store.users.find((u) => u.id === sessionUser.id) || sessionUser
  const config = resolveWhatsAppCloudConfig(user, store)
  if (!config) {
    return sendJson(res, 400, {
      error: 'WhatsApp Business API is not connected. Please contact your admin or check the Workspace settings.',
      needsWhatsAppConnect: true,
    })
  }

  const { leadIds, message, templateName, templateLanguage } = getBody(req)
  const ids = Array.isArray(leadIds) ? leadIds.slice(0, MAX_BULK) : []
  const body = String(message || '').trim()
  if (!ids.length) return sendJson(res, 400, { error: 'leadIds array is required' })
  if (!body && !templateName && !config.defaultTemplateName) {
    return sendJson(res, 400, { error: 'message is required (or set a default Meta template)' })
  }

  const results = []
  let sent = 0
  let failed = 0
  const activityLogs = []

  for (let i = 0; i < ids.length; i += 1) {
    const leadId = ids[i]
    const entry = findPipelineEntry(store, user, leadId)
    if (!entry) {
      results.push({ leadId, ok: false, error: 'Lead not found' })
      failed += 1
      continue
    }
    const lead = entry.lead || entry
    const phone = normalizePhoneDigits(lead.phone)
    if (!phone) {
      results.push({ leadId, ok: false, error: 'No valid phone' })
      failed += 1
      continue
    }

    const sendResult = await sendWhatsAppCloudMessage(config, {
      to: phone,
      body,
      templateName: templateName || config.defaultTemplateName,
      templateLanguage: templateLanguage || config.defaultTemplateLanguage,
      templateBodyParams: body ? [body.slice(0, 1024)] : [],
    })

    if (!sendResult.ok) {
      results.push({ leadId, ok: false, error: sendResult.error })
      failed += 1
    } else {
      sent += 1
      results.push({ leadId, ok: true, messageId: sendResult.messageId })
      const summary = body.slice(0, 120) || `Template: ${templateName || config.defaultTemplateName}`
      activityLogs.push({ leadId, summary, messageId: sendResult.messageId })
    }

    if (i < ids.length - 1) await sleep(SEND_DELAY_MS)
  }

  if (activityLogs.length) {
    await updateStore((draft) => {
      for (const log of activityLogs) {
        const ent = findPipelineEntry(draft, user, log.leadId)
        if (!ent) continue
        ent.crm = appendActivity(normalizeExtendedCrm(ent.crm), {
          type: 'whatsapp',
          summary: `Bulk WhatsApp: ${log.summary}`,
          userId: user.id,
          userName: user.name || user.email,
          meta: { messageId: log.messageId, bulk: true },
        })
      }
      return draft
    })
  }

  return sendJson(res, 200, { sent, failed, results })
}
