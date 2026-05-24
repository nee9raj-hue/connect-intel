import { normalizePhoneDigits } from './phoneUtils.js'

const DEFAULT_API_VERSION = 'v21.0'

export function getWhatsAppCloudApiVersion() {
  return String(process.env.WHATSAPP_CLOUD_API_VERSION || DEFAULT_API_VERSION).trim() || DEFAULT_API_VERSION
}

function platformWhatsAppConfig() {
  const accessToken = String(process.env.WHATSAPP_CLOUD_ACCESS_TOKEN || '').trim()
  const phoneNumberId = String(process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID || '').trim()
  if (!accessToken || !phoneNumberId) return null
  return {
    accessToken,
    phoneNumberId,
    displayPhone: String(process.env.WHATSAPP_CLOUD_DISPLAY_PHONE || '').trim() || null,
    source: 'platform',
  }
}

function normalizeStoredConfig(raw) {
  if (!raw || typeof raw !== 'object') return null
  const accessToken = String(raw.accessToken || '').trim()
  const phoneNumberId = String(raw.phoneNumberId || '').trim()
  if (!accessToken || !phoneNumberId) return null
  return {
    accessToken,
    phoneNumberId,
    displayPhone: raw.displayPhone ? String(raw.displayPhone).trim() : null,
    businessAccountId: raw.businessAccountId ? String(raw.businessAccountId).trim() : null,
    defaultTemplateName: raw.defaultTemplateName ? String(raw.defaultTemplateName).trim() : null,
    defaultTemplateLanguage: raw.defaultTemplateLanguage
      ? String(raw.defaultTemplateLanguage).trim()
      : 'en',
    source: raw.source || 'org',
  }
}

function platformStoreConfig(store) {
  return normalizeStoredConfig(store?.platform?.[0]?.whatsappCloud)
}

/** Resolve send credentials: org → user → platform store → env. */
export function resolveWhatsAppCloudConfig(user, store) {
  if (user?.organizationId && store?.organizations) {
    const org = store.organizations.find((o) => o.id === user.organizationId)
    const fromOrg = normalizeStoredConfig(org?.whatsappCloud)
    if (fromOrg) return { ...fromOrg, source: 'org' }
  }
  const fromUser = normalizeStoredConfig(user?.whatsappCloud)
  if (fromUser) return { ...fromUser, source: 'user' }
  const fromPlatform = platformStoreConfig(store)
  if (fromPlatform) return { ...fromPlatform, source: 'platform' }
  return platformWhatsAppConfig()
}

export function getPlatformWhatsAppCloudStatus(store) {
  const config = platformStoreConfig(store)
  if (!config) {
    return {
      configured: false,
      canAutoSend: false,
      source: null,
      phoneNumberId: null,
      displayPhone: null,
    }
  }
  return {
    configured: true,
    canAutoSend: true,
    source: 'platform',
    phoneNumberId: maskPhoneNumberId(config.phoneNumberId),
    displayPhone: config.displayPhone || null,
    defaultTemplateName: config.defaultTemplateName || null,
    defaultTemplateLanguage: config.defaultTemplateLanguage || 'en',
  }
}

export function isWhatsAppCloudConfigured(user, store) {
  return Boolean(resolveWhatsAppCloudConfig(user, store))
}

export function maskPhoneNumberId(id) {
  const s = String(id || '')
  if (s.length <= 4) return s ? '••••' : ''
  return `••••${s.slice(-4)}`
}

export function getWhatsAppCloudStatus(user, store) {
  const config = resolveWhatsAppCloudConfig(user, store)
  if (!config) {
    return {
      configured: false,
      canAutoSend: false,
      source: null,
      phoneNumberId: null,
      displayPhone: null,
    }
  }
  return {
    configured: true,
    canAutoSend: true,
    source: config.source,
    phoneNumberId: maskPhoneNumberId(config.phoneNumberId),
    displayPhone: config.displayPhone || null,
    defaultTemplateName: config.defaultTemplateName || null,
    defaultTemplateLanguage: config.defaultTemplateLanguage || 'en',
  }
}

function graphMessagesUrl(phoneNumberId, apiVersion) {
  return `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`
}

function parseGraphError(body, status) {
  const err = body?.error
  if (!err) return `WhatsApp API error (${status})`
  const msg = err.error_user_msg || err.message || 'Send failed'
  const code = err.code
  if (code === 131047 || /re-engagement|template/i.test(msg)) {
    return `${msg} Use a Meta-approved template for cold outreach, or message within 24h of the contact replying.`
  }
  if (code === 130429 || /rate limit/i.test(msg)) {
    return `${msg} Rate limited — try again shortly.`
  }
  return msg
}

/**
 * Send a WhatsApp message via Meta Cloud API.
 * @returns {{ ok: boolean, messageId?: string, error?: string, usedTemplate?: boolean }}
 */
export async function sendWhatsAppCloudMessage(config, options = {}) {
  const cfg = config
  if (!cfg?.accessToken || !cfg?.phoneNumberId) {
    return { ok: false, error: 'WhatsApp Business API is not configured' }
  }

  const to = normalizePhoneDigits(options.to)
  if (!to) return { ok: false, error: 'Invalid recipient phone number' }

  const body = String(options.body || '').trim()
  const templateName =
    String(options.templateName || cfg.defaultTemplateName || '').trim() || null
  const templateLanguage =
    String(options.templateLanguage || cfg.defaultTemplateLanguage || 'en').trim() || 'en'

  const apiVersion = getWhatsAppCloudApiVersion()
  const url = graphMessagesUrl(cfg.phoneNumberId, apiVersion)

  let payload
  let usedTemplate = false

  if (templateName) {
    usedTemplate = true
    const components = []
    const params = (options.templateBodyParams || [])
      .filter(Boolean)
      .map((text) => ({ type: 'text', text: String(text).slice(0, 1024) }))
    if (!params.length && body) {
      params.push({ type: 'text', text: body.slice(0, 1024) })
    }
    if (params.length) {
      components.push({ type: 'body', parameters: params })
    }
    payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: templateLanguage },
        ...(components.length ? { components } : {}),
      },
    }
  } else {
    if (!body) return { ok: false, error: 'Message body is required' }
    payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: body.slice(0, 4096) },
    }
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, error: parseGraphError(data, res.status), usedTemplate }
    }
    const messageId = data?.messages?.[0]?.id || null
    return { ok: true, messageId, usedTemplate }
  } catch (e) {
    return { ok: false, error: e.message || 'Network error contacting WhatsApp' }
  }
}
