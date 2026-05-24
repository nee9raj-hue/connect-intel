import { getOrganization } from './organizations.js'
import { readStore, updateStore } from './store.js'
import {
  getWhatsAppCloudStatus,
  isWhatsAppCloudConfigured,
  maskPhoneNumberId,
  resolveWhatsAppCloudConfig,
} from './whatsappCloud.js'

export function getOrgWhatsAppCloudStatusForUser(user) {
  return readStore().then((store) => getWhatsAppCloudStatus(user, store))
}

export async function saveOrgWhatsAppCloud(organizationId, fields) {
  const pid = String(fields.phoneNumberId || '').trim()
  const token = String(fields.accessToken || '').trim()
  if (!pid || !token) {
    throw new Error('Phone number ID and access token are required from Meta Business Manager.')
  }

  const now = new Date().toISOString()
  await updateStore((draft) => {
    const org = getOrganization(draft, organizationId)
    if (!org) throw new Error('Organization not found')
    org.whatsappCloud = {
      phoneNumberId: pid,
      accessToken: token,
      displayPhone: fields.displayPhone ? String(fields.displayPhone).trim().slice(0, 40) : null,
      defaultTemplateName: fields.defaultTemplateName
        ? String(fields.defaultTemplateName).trim().slice(0, 120)
        : null,
      defaultTemplateLanguage: fields.defaultTemplateLanguage
        ? String(fields.defaultTemplateLanguage).trim().slice(0, 12)
        : 'en',
      configuredAt: now,
      updatedAt: now,
    }
    return draft
  })

  return { ok: true, phoneNumberId: maskPhoneNumberId(pid) }
}

export async function disconnectOrgWhatsAppCloud(organizationId) {
  await updateStore((draft) => {
    const org = getOrganization(draft, organizationId)
    if (!org) throw new Error('Organization not found')
    delete org.whatsappCloud
    return draft
  })
  return { ok: true }
}

export async function saveIndividualWhatsAppCloud(userId, fields) {
  const pid = String(fields.phoneNumberId || '').trim()
  const token = String(fields.accessToken || '').trim()
  if (!pid || !token) {
    throw new Error('Phone number ID and access token are required.')
  }
  const now = new Date().toISOString()
  await updateStore((draft) => {
    const u = draft.users.find((x) => x.id === userId)
    if (!u) throw new Error('User not found')
    u.whatsappCloud = {
      phoneNumberId: pid,
      accessToken: token,
      displayPhone: fields.displayPhone ? String(fields.displayPhone).trim().slice(0, 40) : null,
      defaultTemplateName: fields.defaultTemplateName
        ? String(fields.defaultTemplateName).trim().slice(0, 120)
        : null,
      defaultTemplateLanguage: fields.defaultTemplateLanguage
        ? String(fields.defaultTemplateLanguage).trim().slice(0, 12)
        : 'en',
      configuredAt: now,
      updatedAt: now,
    }
    return draft
  })
  return { ok: true, phoneNumberId: maskPhoneNumberId(pid) }
}

export async function disconnectUserWhatsAppCloud(userId) {
  await updateStore((draft) => {
    const u = draft.users.find((x) => x.id === userId)
    if (!u) throw new Error('User not found')
    delete u.whatsappCloud
    return draft
  })
  return { ok: true }
}

export async function savePlatformWhatsAppCloud(fields) {
  const pid = String(fields.phoneNumberId || '').trim()
  const token = String(fields.accessToken || '').trim()
  if (!pid || !token) {
    throw new Error('Phone number ID and access token are required from Meta Business Manager.')
  }

  const now = new Date().toISOString()
  await updateStore((draft) => {
    draft.platform = draft.platform?.length ? draft.platform : [{}]
    const row = draft.platform[0] || {}
    draft.platform[0] = {
      ...row,
      whatsappCloud: {
        phoneNumberId: pid,
        accessToken: token,
        displayPhone: fields.displayPhone ? String(fields.displayPhone).trim().slice(0, 40) : null,
        defaultTemplateName: fields.defaultTemplateName
          ? String(fields.defaultTemplateName).trim().slice(0, 120)
          : null,
        defaultTemplateLanguage: fields.defaultTemplateLanguage
          ? String(fields.defaultTemplateLanguage).trim().slice(0, 12)
          : 'en',
        configuredAt: now,
        updatedAt: now,
      },
    }
    return draft
  })

  return { ok: true, phoneNumberId: maskPhoneNumberId(pid) }
}

export async function disconnectPlatformWhatsAppCloud() {
  await updateStore((draft) => {
    if (draft.platform?.[0]) {
      delete draft.platform[0].whatsappCloud
    }
    return draft
  })
  return { ok: true }
}

export { isWhatsAppCloudConfigured, resolveWhatsAppCloudConfig, getWhatsAppCloudStatus }
