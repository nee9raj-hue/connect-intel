import crypto from 'node:crypto'
import { createId, updateStore } from './store.js'
import { recordMarketingRollup } from './marketingAnalyticsRollups.js'

export const UTM_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']

function siteSecret() {
  return (
    process.env.MARKETING_TRACK_SECRET ||
    process.env.MARKETING_UNSUB_SECRET ||
    process.env.SESSION_SECRET ||
    'connect-intel-site-track'
  )
}

export function parseUtmParams(input = {}) {
  const out = {}
  for (const key of UTM_FIELDS) {
    const raw = input[key]
    if (raw == null || raw === '') continue
    out[key] = String(raw).trim().slice(0, 120)
  }
  return out
}

export function createSiteKey(organizationId) {
  if (!organizationId) return null
  const body = JSON.stringify({ org: organizationId })
  const sig = crypto.createHmac('sha256', siteSecret()).update(body).digest('base64url')
  return Buffer.from(`${body}.${sig}`).toString('base64url')
}

export function parseSiteKey(token) {
  if (!token) return null
  try {
    const decoded = Buffer.from(String(token), 'base64url').toString('utf8')
    const sep = decoded.lastIndexOf('.')
    if (sep <= 0) return null
    const body = decoded.slice(0, sep)
    const sig = decoded.slice(sep + 1)
    const expected = crypto.createHmac('sha256', siteSecret()).update(body).digest('base64url')
    if (sig !== expected) return null
    const payload = JSON.parse(body)
    return payload?.org ? { organizationId: payload.org } : null
  } catch {
    return null
  }
}

export function appBaseUrl() {
  return process.env.APP_URL || 'https://connectintel.net'
}

export function buildSitePixelSnippet(organizationId) {
  const key = createSiteKey(organizationId)
  if (!key) return null
  const src = `${appBaseUrl()}/api/marketing/pixel?k=${encodeURIComponent(key)}`
  return `<script async src="${src}"></script>`
}

export function buildSitePixelJs(siteKey) {
  const base = appBaseUrl()
  const key = JSON.stringify(siteKey)
  const baseJson = JSON.stringify(base)
  return `(function(){
var k=${key},b=${baseJson},s='ci_vid',u='ci_utm';
function gid(){try{var v=localStorage.getItem(s);if(v)return v;v='v_'+Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem(s,v);return v}catch(e){return 'v_anon'}}
function putUtm(){try{var p=new URLSearchParams(location.search),o={};['utm_source','utm_medium','utm_campaign','utm_term','utm_content'].forEach(function(f){var v=p.get(f);if(v)o[f]=v});if(Object.keys(o).length)localStorage.setItem(u,JSON.stringify(o))}catch(e){}}
function getUtm(){try{var r=localStorage.getItem(u);return r?JSON.parse(r):{}}catch(e){return {}}}
function hit(){var utm=getUtm(),q=new URLSearchParams({k:k,url:location.href,vid:gid()});Object.keys(utm).forEach(function(f){q.set(f,utm[f])});if(document.referrer)q.set('ref',document.referrer);(new Image()).src=b+'/api/marketing/site-hit?'+q.toString()}
putUtm();hit();
})();`
}

export async function recordSitePageView({
  organizationId,
  createdByUserId = null,
  visitorId,
  url,
  referrer,
  utm = {},
}) {
  const now = new Date().toISOString()
  const utmClean = parseUtmParams(utm)

  await updateStore((draft) => {
    draft.marketingEvents = draft.marketingEvents || []
    draft.marketingEvents.push({
      id: createId('mevt'),
      organizationId,
      createdByUserId,
      type: 'site_pageview',
      url: url ? String(url).slice(0, 500) : null,
      referrer: referrer ? String(referrer).slice(0, 500) : null,
      visitorId: visitorId ? String(visitorId).slice(0, 80) : null,
      utm: Object.keys(utmClean).length ? utmClean : null,
      createdAt: now,
    })
    draft.marketingEvents = draft.marketingEvents.slice(-5000)
    return draft
  })

  await recordMarketingRollup({
    organizationId,
    createdByUserId,
    date: now,
    metric: 'site_pageviews',
    dimensions: { source: utmClean.utm_source || 'direct' },
    delta: 1,
  })
}

export function parseVisitorIdFromFormBody(body = {}) {
  const raw = body._ci_vid || body.visitorId
  if (!raw) return null
  const visitorId = String(raw).trim().slice(0, 80)
  return visitorId || null
}

export function linkVisitorToLeadEvents(store, { organizationId, visitorId, leadId }) {
  if (!organizationId || !visitorId || !leadId) return 0
  let linked = 0
  for (const event of store.marketingEvents || []) {
    if (event.organizationId !== organizationId) continue
    if (event.visitorId !== visitorId) continue
    if (event.leadId && event.leadId !== leadId) continue
    if (!event.leadId) {
      event.leadId = leadId
      linked += 1
    }
  }
  return linked
}

export function applyVisitorAttribution(
  crm,
  { visitorId, marketingEvents, organizationId, at = new Date().toISOString() } = {}
) {
  if (!visitorId) return crm

  const next = { ...(crm || {}) }
  next.visitorId = String(visitorId).slice(0, 80)

  const visits = (marketingEvents || []).filter(
    (event) =>
      event.organizationId === organizationId &&
      event.visitorId === visitorId &&
      event.type === 'site_pageview'
  )
  if (!visits.length) return next

  const sorted = [...visits].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
  const attr = { ...(next.marketingAttribution || {}) }
  const touchFrom = (event) => ({
    ...(event.utm || {}),
    url: event.url || null,
    at: event.createdAt || at,
  })
  if (!attr.firstTouch) attr.firstTouch = touchFrom(sorted[0])
  attr.lastTouch = touchFrom(sorted[sorted.length - 1])
  attr.visitorLinkedAt = at
  next.marketingAttribution = attr
  return next
}

export function applyUtmAttribution(crm, utm, { at = new Date().toISOString() } = {}) {
  const clean = parseUtmParams(utm)
  if (!Object.keys(clean).length) return crm

  const next = { ...(crm || {}) }
  const attr = { ...(next.marketingAttribution || {}) }
  const touch = { ...clean, at }
  if (!attr.firstTouch) attr.firstTouch = touch
  attr.lastTouch = touch
  next.marketingAttribution = attr
  return next
}

export function parseUtmFromFormBody(body = {}) {
  const raw = body._ci_utm
  if (raw) {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      return parseUtmParams(parsed)
    } catch {
      /* fall through */
    }
  }
  return parseUtmParams(body)
}

export function siteTrackingFormScript() {
  const base = appBaseUrl()
  return `<script>
(function(){
var u='ci_utm',v='ci_vid',f=document.querySelector('form');
function getUtm(){try{var r=localStorage.getItem(u);return r?JSON.parse(r):{}}catch(e){return {}}}
function getVid(){try{var r=localStorage.getItem(v);if(r)return r;r='v_'+Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem(v,r);return r}catch(e){return ''}}
function attach(){
  if(!f)return;
  if(!f.querySelector('input[name="_ci_utm"]')){
    var h=document.createElement('input');h.type='hidden';h.name='_ci_utm';
    h.value=JSON.stringify(getUtm());f.appendChild(h);
  }
  if(!f.querySelector('input[name="_ci_vid"]')){
    var vid=document.createElement('input');vid.type='hidden';vid.name='_ci_vid';
    vid.value=getVid();f.appendChild(vid);
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attach);else attach();
})();
</script>`
}
