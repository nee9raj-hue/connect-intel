import nodemailer from 'nodemailer'

function parseMailboxFromEnv() {
  const configured = String(process.env.GMAIL_SMTP_USER || process.env.EMAIL_FROM || '').trim()
  const match = configured.match(/<([^>]+)>/)
  if (match) return match[1].trim().toLowerCase()
  if (configured.includes('@')) return configured.toLowerCase()
  return null
}

export function isGmailSmtpConfigured() {
  return Boolean(String(process.env.GMAIL_SMTP_APP_PASSWORD || '').trim() && parseMailboxFromEnv())
}

export function getGmailSmtpUser() {
  return parseMailboxFromEnv()
}

export async function sendViaGmailSmtp({ from, to, subject, html, text, replyTo }) {
  const user = getGmailSmtpUser()
  const pass = String(process.env.GMAIL_SMTP_APP_PASSWORD || '').trim()

  if (!user || !pass) {
    return {
      sent: false,
      error: 'Gmail SMTP is not configured. Set GMAIL_SMTP_USER and GMAIL_SMTP_APP_PASSWORD on Vercel.',
    }
  }

  const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user, pass },
  })

  try {
    const info = await transport.sendMail({
      from,
      to,
      subject,
      html,
      text,
      replyTo: replyTo || undefined,
    })

    return {
      sent: true,
      id: info.messageId,
      provider: 'gmail',
      from,
      to,
    }
  } catch (error) {
    const message = error?.message || 'Gmail SMTP send failed'
    const hint = /invalid login|username and password/i.test(message)
      ? 'Use a Google App Password (not your normal password). Admin: Google Account → Security → 2-Step Verification → App passwords.'
      : null
    return { sent: false, error: message, hint, provider: 'gmail' }
  }
}

export function getGmailSetupHint() {
  const mailbox = parseMailboxFromEnv() || 'invite@connectintel.net'
  return {
    mailbox,
    steps: [
      `Sign in to Google as ${mailbox} (or a Workspace admin).`,
      'Enable 2-Step Verification on that account.',
      'Create an App Password: Google Account → Security → App passwords → Mail → Other (Connect Intel).',
      'In Vercel Production env, set GMAIL_SMTP_USER=' + mailbox,
      'Set GMAIL_SMTP_APP_PASSWORD=<16-character app password> (no spaces).',
      'Set INVITE_EMAIL_PROVIDER=auto or gmail, redeploy, then Team → Send test invite.',
    ],
    dnsNotRequired: true,
  }
}
