import crypto from 'node:crypto'

function trackSecret() {
  return (
    process.env.MARKETING_TRACK_SECRET ||
    process.env.MARKETING_UNSUB_SECRET ||
    process.env.SESSION_JWT_SECRET ||
    'connect-intel-marketing-track'
  )
}

export function createTrackingToken(payload) {
  const body = JSON.stringify(payload)
  const sig = crypto.createHmac('sha256', trackSecret()).update(body).digest('base64url')
  return Buffer.from(`${body}:${sig}`).toString('base64url')
}

export function parseTrackingToken(token) {
  if (!token) return null
  try {
    const decoded = Buffer.from(String(token), 'base64url').toString('utf8')
    const sep = decoded.lastIndexOf(':')
    if (sep <= 0) return null
    const body = decoded.slice(0, sep)
    const sig = decoded.slice(sep + 1)
    const expected = crypto.createHmac('sha256', trackSecret()).update(body).digest('base64url')
    if (sig !== expected) return null
    return JSON.parse(body)
  } catch {
    return null
  }
}

const URL_RE = /(https?:\/\/[^\s<>"')\]]+)/gi

export function wrapLinksForTracking(text, trackingToken) {
  if (!trackingToken || !text) return text
  const base = process.env.APP_URL || 'https://connectintel.net'
  return String(text).replace(URL_RE, (url) => {
    if (url.includes('/api/marketing/')) return url
    const clickUrl = `${base}/api/marketing/click?t=${encodeURIComponent(trackingToken)}&u=${encodeURIComponent(url)}`
    return clickUrl
  })
}

export function wrapLinksInHtml(html, trackingToken) {
  if (!trackingToken || !html) return html
  const base = process.env.APP_URL || 'https://connectintel.net'
  return String(html).replace(/href="(https?:\/\/[^"]+)"/gi, (match, url) => {
    if (url.includes('/api/marketing/')) return match
    const clickUrl = `${base}/api/marketing/click?t=${encodeURIComponent(trackingToken)}&u=${encodeURIComponent(url)}`
    return `href="${clickUrl}"`
  })
}

export function trackingPixelHtml(trackingToken) {
  if (!trackingToken) return ''
  const base = process.env.APP_URL || 'https://connectintel.net'
  const src = `${base}/api/marketing/open?t=${encodeURIComponent(trackingToken)}`
  return `<img src="${src}" width="1" height="1" alt="" style="display:none" />`
}

export function appendHtmlTrackingPixel(html, trackingToken) {
  if (!trackingToken) return html
  const pixel = trackingPixelHtml(trackingToken)
  if (String(html).includes('/api/marketing/open')) return html
  return `${html}${pixel}`
}
