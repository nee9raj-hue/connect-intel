/**
 * Amazon SES adapter — requires AWS_SES_REGION and AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
 * (or default credential chain on AWS).
 */
export async function sendViaSes({ user, org, lead, subject, body, html, htmlAppend }) {
  const region = process.env.AWS_SES_REGION
  if (!region) return { sent: false, error: 'SES not configured' }

  const to = String(lead?.email || '').trim().toLowerCase()
  if (!to.includes('@')) return { sent: false, error: 'Invalid recipient' }

  const fromEmail = org?.marketingSettings?.sesFromEmail || user?.email
  if (!fromEmail?.includes('@')) return { sent: false, error: 'SES from address missing' }

  try {
    const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses')
    const client = new SESClient({ region })
    const htmlBody = html || `<pre>${body}</pre>${htmlAppend || ''}`
    const cmd = new SendEmailCommand({
      Source: fromEmail,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: htmlBody, Charset: 'UTF-8' },
          Text: { Data: body, Charset: 'UTF-8' },
        },
      },
    })
    const res = await client.send(cmd)
    return {
      sent: true,
      id: res.MessageId,
      provider: 'ses',
      mailbox: fromEmail,
    }
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND') {
      return {
        sent: false,
        error: 'Install @aws-sdk/client-ses or use Resend/Gmail provider',
      }
    }
    return { sent: false, error: err.message || 'SES send failed' }
  }
}
