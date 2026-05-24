import { requireUser } from '../auth.js'
import { readStore } from '../store.js'
import {
  disconnectOrgWhatsAppCloud,
  disconnectUserWhatsAppCloud,
  getWhatsAppCloudStatus,
  saveIndividualWhatsAppCloud,
  saveOrgWhatsAppCloud,
} from '../orgWhatsAppCloud.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireUser(req, res)
  if (!user) return

  const store = await readStore()
  const isCompany = user.accountType === 'company' && user.organizationId
  const isAdmin = user.isOrgAdmin || user.orgRole === 'org_admin'

  if (req.method === 'GET') {
    return sendJson(res, 200, getWhatsAppCloudStatus(user, store))
  }

  if (req.method !== 'POST') return methodNotAllowed(res, ['GET', 'POST'])

  const body = getBody(req)
  const { action } = body

  if (action === 'disconnect') {
    if (isCompany) {
      if (!isAdmin) return sendJson(res, 403, { error: 'Only company admin can disconnect WhatsApp API' })
      await disconnectOrgWhatsAppCloud(user.organizationId)
    } else {
      await disconnectUserWhatsAppCloud(user.id)
    }
    return sendJson(res, 200, getWhatsAppCloudStatus(await readStore(), user))
  }

  if (action !== 'connect') {
    return sendJson(res, 400, { error: 'Unknown action. Use connect or disconnect.' })
  }

  if (isCompany && !isAdmin) {
    return sendJson(res, 403, { error: 'Only company admin can connect WhatsApp Business API' })
  }

  const fields = {
    phoneNumberId: body.phoneNumberId,
    accessToken: body.accessToken,
    displayPhone: body.displayPhone,
    defaultTemplateName: body.defaultTemplateName,
    defaultTemplateLanguage: body.defaultTemplateLanguage,
  }

  try {
    if (isCompany) {
      await saveOrgWhatsAppCloud(user.organizationId, fields)
    } else {
      await saveIndividualWhatsAppCloud(user.id, fields)
    }
    const fresh = await readStore()
    return sendJson(res, 200, {
      ok: true,
      ...getWhatsAppCloudStatus(user, fresh),
    })
  } catch (e) {
    return sendJson(res, 400, { error: e.message || 'Could not save WhatsApp settings' })
  }
}
