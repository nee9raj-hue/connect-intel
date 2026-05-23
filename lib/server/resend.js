function resendHeaders() {
  const key = String(process.env.RESEND_API_KEY || '').trim()
  if (!key) return null
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }
}

export function mailboxDomain(email) {
  return String(email || '').split('@')[1]?.toLowerCase() || null
}

export async function fetchResendApi(path, options = {}) {
  const headers = resendHeaders()
  if (!headers) {
    return { ok: false, status: 0, error: 'RESEND_API_KEY is not configured' }
  }

  const response = await fetch(`https://api.resend.com${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      data?.message ||
      data?.error?.message ||
      (typeof data?.error === 'string' ? data.error : null) ||
      `Resend API error (${response.status})`
    return { ok: false, status: response.status, error: message, data }
  }

  return { ok: true, status: response.status, data }
}

export async function listResendDomains() {
  const result = await fetchResendApi('/domains')
  if (!result.ok) return result
  return { ok: true, domains: result.data?.data || [] }
}

/** Register a customer domain in Resend (multi-tenant SaaS — one platform API key). */
export async function createResendDomain(domainName) {
  const name = String(domainName || '').toLowerCase().trim()
  if (!name || !name.includes('.')) {
    return { ok: false, error: 'Invalid domain name' }
  }

  const existing = await getResendDomainDetails(name)
  if (existing.ok) {
    return {
      ok: true,
      created: false,
      domain: name,
      id: existing.id,
      status: existing.status,
      records: existing.records,
    }
  }

  const result = await fetchResendApi('/domains', {
    method: 'POST',
    body: JSON.stringify({ name, open_tracking: false, click_tracking: false }),
  })

  if (!result.ok) {
    if (/already exists/i.test(result.error || '')) {
      return getResendDomainDetails(name)
    }
    return { ok: false, error: result.error }
  }

  const records = (result.data?.records || []).map((r) => ({
    purpose: r.record,
    host: r.name,
    type: r.type,
    value: r.value,
    priority: r.priority ?? null,
    status: r.status,
    ttl: r.ttl,
  }))

  return {
    ok: true,
    created: true,
    domain: name,
    id: result.data?.id,
    status: result.data?.status || 'not_started',
    records,
  }
}

export async function sendResendEmail({ from, to, subject, html, text, replyTo }) {
  const payload = {
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text: text || undefined,
  }
  if (replyTo) payload.reply_to = replyTo

  const result = await fetchResendApi('/emails', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (!result.ok) {
    return { sent: false, error: result.error }
  }

  return {
    sent: true,
    id: result.data?.id,
    provider: 'resend',
    from,
    to: payload.to[0],
  }
}

export async function getResendEmailStatus(emailId) {
  if (!emailId) return { ok: false, error: 'No email id' }
  const result = await fetchResendApi(`/emails/${encodeURIComponent(emailId)}`)
  if (!result.ok) return result
  return { ok: true, email: result.data }
}

export async function getResendDomainDetails(domainName) {
  const domain = String(domainName || '').toLowerCase()
  const listed = await listResendDomains()
  if (!listed.ok) return { ok: false, error: listed.error }

  const match = listed.domains.find((d) => String(d.name || '').toLowerCase() === domain)
  if (!match?.id) {
    return { ok: false, status: 'not_in_resend', domain }
  }

  const detail = await fetchResendApi(`/domains/${encodeURIComponent(match.id)}`)
  if (!detail.ok) return { ok: false, error: detail.error, domain }

  const records = (detail.data?.records || []).map((r) => ({
    purpose: r.record,
    host: r.name,
    type: r.type,
    value: r.value,
    priority: r.priority ?? null,
    status: r.status,
    ttl: r.ttl,
  }))

  return {
    ok: true,
    domain,
    id: match.id,
    status: detail.data?.status || match.status,
    records,
  }
}

export async function triggerResendDomainVerify(domainName) {
  const info = await getResendDomainDetails(domainName)
  if (!info.ok || !info.id) return info
  const verify = await fetchResendApi(`/domains/${encodeURIComponent(info.id)}/verify`, {
    method: 'POST',
  })
  if (!verify.ok) return { ok: false, error: verify.error, domain: domainName }
  return { ok: true, domain: domainName, status: 'verification_triggered' }
}

export async function getResendDomainSendStatus(mailbox) {
  const domain = mailboxDomain(mailbox)
  if (!domain) {
    return {
      canSend: false,
      domain: null,
      status: 'invalid_mailbox',
      hint: 'EMAIL_FROM must be a valid email address.',
    }
  }

  const listed = await listResendDomains()
  if (!listed.ok) {
    return {
      canSend: false,
      domain,
      status: 'api_error',
      hint:
        listed.status === 401 || /invalid api key/i.test(listed.error || '')
          ? 'RESEND_API_KEY on Vercel is invalid. Create a new key at resend.com/api-keys and update Vercel, then redeploy.'
          : `Cannot reach Resend: ${listed.error}`,
    }
  }

  const match = listed.domains.find((d) => String(d.name || '').toLowerCase() === domain)
  if (!match) {
    return {
      canSend: false,
      domain,
      status: 'not_in_resend',
      hint:
        `Domain "${domain}" is not in your Resend account. Open resend.com/domains → Add domain → "${domain}", ` +
        'add the DKIM + SPF DNS records at your registrar, then click Verify DNS Records.',
      dnsRequired: true,
    }
  }

  const status = String(match.status || 'unknown').toLowerCase()
  if (status !== 'verified') {
    return {
      canSend: false,
      domain,
      status,
      domainId: match.id,
      hint:
        `Domain "${domain}" is "${status}" in Resend (not verified). ` +
        'Add SPF: v=spf1 include:_spf.google.com include:amazonses.com ~all and the 3 DKIM CNAMEs Resend shows, then verify.',
      dnsRequired: true,
    }
  }

  return {
    canSend: true,
    domain,
    status: 'verified',
    domainId: match.id,
  }
}
