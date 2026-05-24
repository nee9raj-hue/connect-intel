import {
  FONT_OPTIONS,
  FONT_SIZE_OPTIONS,
  IMAGE_PRESETS,
  POPULAR_ICONS,
  SOCIAL_NETWORKS,
  iconifyUrl,
  resolveFontStack,
  socialIconUrl,
} from './marketingEmailTokens.js'
import {
  expandIconTokens,
  isRichHtml,
  renderRichHtmlForEmail,
  richFieldToEmailHtml,
  sanitizeRichHtml,
} from './marketingRichText.js'
import { mergeFormBlocksForLead, resolveFormBlockUrl } from '../../../lib/marketingFormSchema.js'

export { FONT_OPTIONS, FONT_SIZE_OPTIONS, IMAGE_PRESETS, POPULAR_ICONS, SOCIAL_NETWORKS, iconifyUrl, socialIconUrl }

export const DESIGN_VERSION = 2

export const BLOCK_TYPES = [
  'header',
  'hero',
  'text',
  'image',
  'icon',
  'social',
  'button',
  'form',
  'divider',
  'spacer',
  'footer',
]

export const DEFAULT_THEME = {
  primaryColor: '#111827',
  backgroundColor: '#f3f4f6',
  contentBackground: '#ffffff',
  contentWidth: 600,
  fontFamily: 'Arial, Helvetica, sans-serif',
}

export const MERGE_FIELDS = [
  { token: '{{firstName}}', label: 'First name' },
  { token: '{{companyName}}', label: 'Company' },
  { token: '{{name}}', label: 'Full name' },
  { token: '{{title}}', label: 'Job title' },
]

export const STARTER_TEMPLATES = [
  {
    id: 'welcome',
    name: 'Welcome',
    subject: 'Welcome to {{companyName}}',
    design: { ...DEFAULT_THEME },
    blocks: [
      { id: 'h1', type: 'header', text: 'Connect Intel', align: 'center' },
      {
        id: 'hero1',
        type: 'hero',
        heading: 'Hi {{firstName}}, welcome aboard',
        subtext: 'We are glad to have {{companyName}} with us.',
      },
      {
        id: 't1',
        type: 'text',
        content:
          'Thanks for connecting. Here is what you can expect from us:\n\n• Quick responses from our team\n• Useful updates about your account\n• No spam — unsubscribe anytime',
      },
      { id: 'b1', type: 'button', label: 'Visit dashboard', url: 'https://connectintel.net', align: 'center' },
      { id: 'f1', type: 'footer', text: 'You are receiving this because you opted in.' },
    ],
  },
  {
    id: 'newsletter',
    name: 'Newsletter',
    subject: 'Updates for {{firstName}}',
    design: { ...DEFAULT_THEME, primaryColor: '#2563eb' },
    blocks: [
      { id: 'h1', type: 'header', text: 'Monthly update', align: 'left' },
      {
        id: 'hero1',
        type: 'hero',
        heading: 'What is new this month',
        subtext: 'A quick roundup for {{companyName}}.',
      },
      {
        id: 't1',
        type: 'text',
        content:
          'Hi {{firstName}},\n\nHere are the highlights from our team this month. Let us know if you would like a deeper dive on any topic.',
      },
      { id: 'd1', type: 'divider' },
      {
        id: 't2',
        type: 'text',
        content: 'Tip: Reply to this email anytime — it goes straight to your contact at our company.',
      },
      { id: 'f1', type: 'footer' },
    ],
  },
  {
    id: 'announcement',
    name: 'Announcement',
    subject: 'Important update for {{companyName}}',
    design: { ...DEFAULT_THEME, primaryColor: '#059669' },
    blocks: [
      { id: 'h1', type: 'header', text: 'Announcement', align: 'center' },
      {
        id: 'hero1',
        type: 'hero',
        heading: 'We have news for you',
        subtext: 'Hi {{firstName}} — quick update below.',
      },
      {
        id: 't1',
        type: 'text',
        content:
          'We wanted to share an important update with you and {{companyName}}.\n\n[Add your announcement here]',
      },
      { id: 'b1', type: 'button', label: 'Learn more', url: 'https://connectintel.net', align: 'center' },
      { id: 's1', type: 'spacer', height: 16 },
      { id: 'f1', type: 'footer' },
    ],
  },
]

const PREVIEW_LEAD = {
  firstName: 'Alex',
  companyName: 'Acme Corp',
  name: 'Alex Rivera',
  title: 'Operations Lead',
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function mergeTemplateText(text, lead = PREVIEW_LEAD) {
  const firstName =
    lead.firstName ||
    String(lead.name || '')
      .trim()
      .split(/\s+/)[0] ||
    'there'
  const companyName = lead.company || lead.companyName || 'your company'
  const fullName = lead.name || firstName

  return String(text || '')
    .replace(/\{\{\s*firstName\s*\}\}/gi, firstName)
    .replace(/\{\{\s*companyName\s*\}\}/gi, companyName)
    .replace(/\{\{\s*company\s*\}\}/gi, companyName)
    .replace(/\{\{\s*name\s*\}\}/gi, fullName)
    .replace(/\{\{\s*title\s*\}\}/gi, lead.title || '')
}

function sanitizeUrl(url) {
  const raw = String(url || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw) || /^mailto:/i.test(raw)) return raw
  if (raw.startsWith('{{')) return raw
  return `https://${raw.replace(/^\/+/, '')}`
}

function clampSize(n, min, max, fallback) {
  const v = Number(n)
  if (!Number.isFinite(v)) return fallback
  return Math.max(min, Math.min(max, Math.round(v)))
}

function blockFont(block, theme) {
  return resolveFontStack(block.fontFamily, theme?.fontFamily || DEFAULT_THEME.fontFamily)
}

function textStyle(block, theme, defaults = {}) {
  const fontSize = clampSize(block.fontSize, 10, 48, defaults.fontSize || 15)
  const color = block.color || defaults.color || '#374151'
  const fontFamily = blockFont(block, theme)
  const weight = block.fontWeight === 'bold' ? '700' : defaults.fontWeight || '400'
  return `font-family:${fontFamily};font-size:${fontSize}px;line-height:1.6;color:${color};font-weight:${weight};`
}

function getPopularIcon(id) {
  return POPULAR_ICONS.find((i) => i.id === id) || POPULAR_ICONS[0]
}

function getSocialNetwork(id) {
  return SOCIAL_NETWORKS.find((n) => n.id === id)
}

function mergeBlock(block, lead) {
  const out = { ...block }
  for (const key of Object.keys(out)) {
    if (typeof out[key] === 'string') out[key] = mergeTemplateText(out[key], lead)
    if (key === 'links' && Array.isArray(out.links)) {
      out.links = out.links.map((link) => ({
        ...link,
        url: mergeTemplateText(link.url, lead),
      }))
    }
  }
  return out
}

export function mergeBlocksForLead(blocks, lead = PREVIEW_LEAD) {
  const appBase =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://connectintel.net'
  return mergeFormBlocksForLead(
    (blocks || []).map((block) => mergeBlock(block, lead)),
    lead,
    appBase
  )
}

function richInlineHtml(value, styleCss) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (isRichHtml(raw)) {
    return renderRichHtmlForEmail(sanitizeRichHtml(raw), styleCss)
      .replace(/<p[^>]*>/gi, '')
      .replace(/<\/p>/gi, '')
  }
  return expandIconTokens(escapeHtml(raw))
}

function textToHtmlParagraphs(text, styleCss) {
  const chunks = String(text || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (!chunks.length) return ''
  return chunks
    .map((p) => {
      const lines = p.split('\n').map((line) => escapeHtml(line)).join('<br />')
      return `<p style="margin:0 0 16px;${styleCss}">${lines}</p>`
    })
    .join('')
}

function renderBlockHtml(block, theme) {
  const primary = theme.primaryColor || DEFAULT_THEME.primaryColor
  const align = block.align || 'left'
  const bg = theme.contentBackground || DEFAULT_THEME.contentBackground

  switch (block.type) {
    case 'header': {
      const style = textStyle(block, theme, { fontSize: 13, color: block.color || primary, fontWeight: '700' })
      const inner =
        richFieldToEmailHtml(block.text, `${style}letter-spacing:0.04em;text-transform:uppercase;`) ||
        `<p style="margin:0;${style}letter-spacing:0.04em;text-transform:uppercase;">Your brand</p>`
      return `<tr><td style="padding:24px 32px 8px;text-align:${align};background:${bg};">${inner}</td></tr>`
    }
    case 'hero': {
      const hStyle = textStyle(block, theme, {
        fontSize: clampSize(block.headingSize, 16, 48, 28),
        color: block.headingColor || '#111827',
        fontWeight: '700',
      })
      const sStyle = textStyle(block, theme, {
        fontSize: clampSize(block.subtextSize, 12, 32, 16),
        color: block.subtextColor || '#6b7280',
      })
      const headingInner = richInlineHtml(block.heading, `${hStyle}line-height:1.25;font-weight:700;`)
      const subHtml = block.subtext ? richFieldToEmailHtml(block.subtext, `${sStyle}line-height:1.5;`) : ''
      return `<tr><td style="padding:8px 32px 16px;background:${bg};text-align:${align};">
        ${headingInner ? `<h1 style="margin:0 0 8px;${hStyle}line-height:1.25;">${headingInner}</h1>` : ''}
        ${subHtml}
      </td></tr>`
    }
    case 'text':
      return `<tr><td style="padding:0 32px 8px;background:${bg};">${richFieldToEmailHtml(
        block.content,
        textStyle(block, theme)
      )}</td></tr>`
    case 'image': {
      const src = sanitizeUrl(block.url)
      if (!src) return ''
      const width = clampSize(block.width, 20, 100, 100)
      const radius = block.rounded ? '8px' : '0'
      const img = `<img src="${escapeHtml(src)}" alt="${escapeHtml(block.alt || '')}" width="${width}%" style="max-width:${width}%;width:${width}%;height:auto;border:0;display:inline-block;border-radius:${radius};" />`
      const inner = block.link
        ? `<a href="${escapeHtml(sanitizeUrl(block.link))}" style="text-decoration:none;">${img}</a>`
        : img
      return `<tr><td style="padding:8px 32px;background:${bg};text-align:${align};">${inner}</td></tr>`
    }
    case 'icon': {
      const meta = getPopularIcon(block.iconId)
      const size = clampSize(block.iconSize, 24, 96, 48)
      const src = iconifyUrl(meta.iconify, { size, color: block.iconColor || '#374151' })
      const img = `<img src="${escapeHtml(src)}" alt="${escapeHtml(meta.label)}" width="${size}" height="${size}" style="display:inline-block;border:0;" />`
      const inner = block.link
        ? `<a href="${escapeHtml(sanitizeUrl(block.link))}" style="text-decoration:none;">${img}</a>`
        : img
      return `<tr><td style="padding:12px 32px;background:${bg};text-align:${align};">${inner}</td></tr>`
    }
    case 'social': {
      const links = (block.links || []).filter((l) => l?.network && l?.url)
      if (!links.length) return ''
      const size = clampSize(block.iconSize, 20, 48, 28)
      const gap = clampSize(block.iconGap, 4, 24, 12)
      const icons = links
        .map((link) => {
          const net = getSocialNetwork(link.network)
          if (!net) return ''
          const src = socialIconUrl(net.id, net.color)
          return `<a href="${escapeHtml(sanitizeUrl(link.url))}" style="text-decoration:none;display:inline-block;margin:0 ${gap / 2}px;"><img src="${escapeHtml(src)}" alt="${escapeHtml(net.label)}" width="${size}" height="${size}" style="display:block;border:0;border-radius:4px;" /></a>`
        })
        .join('')
      return `<tr><td style="padding:16px 32px;background:${bg};text-align:${align};">${icons}</td></tr>`
    }
    case 'button': {
      const url = sanitizeUrl(block.url)
      if (!url || !block.label) return ''
      const bgColor = block.buttonColor || primary
      const labelStyle = textStyle(block, theme, {
        fontSize: clampSize(block.fontSize, 12, 24, 15),
        color: block.buttonTextColor || '#ffffff',
        fontWeight: '600',
      })
      return `<tr><td style="padding:16px 32px;background:${bg};text-align:${align};">
        <a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 24px;background:${bgColor};text-decoration:none;border-radius:8px;${labelStyle}">${escapeHtml(block.label)}</a>
      </td></tr>`
    }
    case 'form': {
      const url = sanitizeUrl(block.url || resolveFormBlockUrl(block, { lead: null }))
      const title = block.title || 'Share your feedback'
      const desc = block.description || ''
      const btn = block.buttonLabel || 'Open form'
      if (!url) return ''
      const bgColor = block.buttonColor || primary
      const btnStyle = textStyle(block, theme, {
        fontSize: clampSize(block.fontSize, 12, 20, 14),
        color: block.buttonTextColor || '#ffffff',
        fontWeight: '600',
      })
      const titleStyle = textStyle(block, theme, { fontSize: 17, color: '#111827', fontWeight: '700' })
      const descStyle = textStyle(block, theme, { fontSize: 14, color: '#6b7280' })
      const badge =
        block.formSource === 'google'
          ? '<span style="display:inline-block;font-size:11px;font-weight:600;color:#6b7280;margin-bottom:8px;">Google Form</span>'
          : '<span style="display:inline-block;font-size:11px;font-weight:600;color:#6b7280;margin-bottom:8px;">Connect Intel form</span>'
      return `<tr><td style="padding:16px 32px;background:${bg};text-align:${align};">
        <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;max-width:100%;border:1px solid #e5e7eb;border-radius:12px;background:#fafafa;">
        <tr><td style="padding:20px 20px 16px;text-align:${align};">
        ${badge}
        <p style="margin:0 0 8px;${titleStyle}">${escapeHtml(title)}</p>
        ${desc ? `<p style="margin:0 0 16px;${descStyle}">${escapeHtml(desc)}</p>` : ''}
        <a href="${escapeHtml(url)}" style="display:inline-block;padding:11px 20px;background:${bgColor};text-decoration:none;border-radius:8px;${btnStyle}">${escapeHtml(btn)}</a>
        </td></tr></table>
      </td></tr>`
    }
    case 'divider':
      return `<tr><td style="padding:8px 32px;background:${bg};"><hr style="border:none;border-top:1px solid ${block.color || '#e5e7eb'};margin:0;" /></td></tr>`
    case 'spacer':
      return `<tr><td style="height:${clampSize(block.height, 8, 80, 16)}px;background:${bg};"></td></tr>`
    case 'footer': {
      const style = textStyle(block, theme, { fontSize: 12, color: block.color || '#9ca3af' })
      const inner =
        richFieldToEmailHtml(block.text, style) ||
        `<p style="margin:0;${style}">You are receiving this email from our team.</p>`
      return `<tr><td style="padding:16px 32px 24px;background:${bg};text-align:center;">${inner}</td></tr>`
    }
    default:
      return ''
  }
}

export function renderEmailHtml(blocks, design = {}, options = {}) {
  const theme = { ...DEFAULT_THEME, ...design }
  const width = Math.max(320, Math.min(720, Number(theme.contentWidth) || 600))
  const mergedBlocks = options.lead ? mergeBlocksForLead(blocks, options.lead) : blocks || []
  const rows = mergedBlocks.map((block) => renderBlockHtml(block, theme)).join('')
  const preview = options.previewText
    ? `<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;">${escapeHtml(options.previewText)}</span>`
    : ''

  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:${theme.backgroundColor};font-family:${theme.fontFamily};">${preview}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${theme.backgroundColor};padding:24px 12px;">
<tr><td align="center"><table role="presentation" width="${width}" cellspacing="0" cellpadding="0" style="max-width:${width}px;width:100%;background:${theme.contentBackground};border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">${rows}
<tr><td style="padding:0 32px 24px;background:#ffffff;text-align:center;border-top:1px solid #f3f4f6;"><p style="margin:12px 0 0;font-size:11px;line-height:1.5;color:#9ca3af;">Your company · Unsubscribe link added when sent</p></td></tr>
</table></td></tr></table></body></html>`
}

export function createBlock(type) {
  const id = `blk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  switch (type) {
    case 'header':
      return { id, type, text: 'Your brand', align: 'center', fontSize: 13, fontWeight: 'bold' }
    case 'hero':
      return { id, type, heading: 'Your headline', subtext: 'Supporting line for {{firstName}}', align: 'left', headingSize: 28, subtextSize: 16 }
    case 'text':
      return { id, type, content: 'Write your message here.\n\nUse {{firstName}} and {{companyName}} for personalization.', fontSize: 15 }
    case 'image':
      return { id, type, url: IMAGE_PRESETS[0].url, alt: 'Image', align: 'center', width: 100 }
    case 'icon':
      return { id, type, iconId: 'check', align: 'center', iconSize: 48, iconColor: '#374151' }
    case 'social':
      return { id, type, align: 'center', iconSize: 28, iconGap: 12, links: [{ network: 'linkedin', url: 'https://linkedin.com' }, { network: 'x', url: 'https://x.com' }] }
    case 'button':
      return { id, type, label: 'Call to action', url: 'https://connectintel.net', align: 'center', fontSize: 15 }
    case 'form':
      return {
        id,
        type,
        formSource: 'native',
        title: 'We would love your input',
        description: 'Answer a few quick questions — it only takes a minute.',
        buttonLabel: 'Open form',
        align: 'center',
      }
    case 'divider':
      return { id, type }
    case 'spacer':
      return { id, type, height: 24 }
    case 'footer':
      return { id, type, text: 'You are receiving this email from our team.', fontSize: 12 }
    default:
      return { id, type: 'text', content: '' }
  }
}

export function duplicateBlock(block) {
  const clone = JSON.parse(JSON.stringify(block))
  clone.id = createBlock(block.type).id
  return clone
}

export function reorderBlocks(blocks, fromIndex, toIndex) {
  if (fromIndex === toIndex) return blocks
  const next = [...blocks]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}

export const BLOCK_LABELS = {
  header: 'Header',
  hero: 'Hero',
  text: 'Text',
  image: 'Image',
  icon: 'Icon',
  social: 'Social icons',
  button: 'Button',
  form: 'Form / survey',
  divider: 'Divider',
  spacer: 'Spacer',
  footer: 'Footer',
}
