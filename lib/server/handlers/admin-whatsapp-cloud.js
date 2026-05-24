import { requireUser } from '../auth.js'
import { readStore } from '../store.js'
import {
  disconnectPlatformWhatsAppCloud,
  savePlatformWhatsAppCloud,
} from '../orgWhatsAppCloud.js'
import { getPlatformWhatsAppCloudStatus } from '../whatsappCloud.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireUser(req, res)
  if (!user) return

  if (user.role !== 'admin') {
    return sendJson(res, 403, { error: 'Platform operator access required' })
  }

  if (req.method === 'GET') {
    const store = await readStore()
    return sendJson(res, 200, getPlatformWhatsAppCloudStatus(store))
  }

  if (req.method !== 'POST') return methodNotAllowed(res, ['GET', 'POST'])

  const body = getBody(req)
  const { action } = body

  if (action === 'disconnect') {
    await disconnectPlatformWhatsAppCloud()
    const store = await readStore()
    return sendJson(res, 200, getPlatformWhatsAppCloudStatus(store))
  }

  if (action !== 'connect') {
    return sendJson(res, 400, { error: 'Unknown action. Use connect or disconnect.' })
  }

  const fields = {
    phoneNumberId: body.phoneNumberId,
    accessToken: body.accessToken,
    displayPhone: body.displayPhone,
    defaultTemplateName: body.defaultTemplateName,
    defaultTemplateLanguage: body.defaultTemplateLanguage,
  }

  try {
    await savePlatformWhatsAppCloud(fields)
    const store = await readStore()
    return sendJson(res, 200, { ok: true, ...getPlatformWhatsAppCloudStatus(store) })
  } catch (e) {
    return sendJson(res, 400, { error: e.message || 'Could not save WhatsApp settings' })
  }
}
