/**
 * SendGrid adapter — requires SENDGRID_API_KEY env var.
 */
export async function sendViaSendGrid({ user, org, lead, subject, body, html, htmlAppend }) {
  const apiKey = process.env.SENDGRID_API_KEY
  if (!apiKey) return { sent: false, error: 'SendGrid not configured' }

  const to = String(lead?.email || '').trim().toLowerCase()
  if (!to.includes('@')) return { sent: false, error: 'Invalid recipient' }

  const fromEmail = org?.marketingSettings?.sendgridFromEmail || user?.email
  const fromName = org?.name || user?.name || 'Connect Intel'
  if (!fromEmail?.includes('@')) return { sent: false, error: 'SendGrid from address missing' }

  const htmlBody = html || `<pre>${body}</pre>${htmlAppend || ''}`

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail, name: fromName },
      subject,
      content: [
        { type: 'text/plain', value: body },
        { type: 'text/html', value: htmlBody },
      ],
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return { sent: false, error: text.slice(0, 240) || `SendGrid ${res.status}` }
  }

  const messageId = res.headers.get('x-message-id') || `sg_${Date.now()}`
  return { sent: true, id: messageId, provider: 'sendgrid', mailbox: fromEmail }
}
