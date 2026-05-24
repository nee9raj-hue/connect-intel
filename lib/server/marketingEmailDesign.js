import { mergeTemplateText } from './marketingTemplates.js'
import { mergeFormBlocksForLead, resolveFormBlockUrl } from '../marketingFormSchema.js'
import {
  POPULAR_ICONS,
  SOCIAL_NETWORKS,
  iconifyUrl,
  resolveFontStack,
  socialIconUrl,
} from './marketingEmailTokens.js'

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

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function sanitizeUrl(url) {
  const raw = String(url || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw) || /^mailto:/i.test(raw)) return raw
  if (raw.startsWith('{{')) return raw
  return `https://${raw.replace(/^\/+/, '')}`
}

function mergeBlock(block, lead) {
  if (!block || typeof block !== 'object') return block
  const out = { ...block }
  for (const key of Object.keys(out)) {
    if (typeof out[key] === 'string') {
      out[key] = mergeTemplateText(out[key], lead)
    }
    if (key === 'links' && Array.isArray(out.links)) {
      out.links = out.links.map((link) => ({
        ...link,
        url: mergeTemplateText(link.url, lead),
      }))
    }
  }
  return out
}

export function mergeBlocksForLead(blocks, lead) {
  const appBase = process.env.APP_URL || 'https://connectintel.net'
  return mergeFormBlocksForLead(
    (blocks || []).map((block) => mergeBlock(block, lead)),
    lead,
    appBase
  )
}

export function blocksToPlainText(blocks, lead = null) {
  const merged = lead ? mergeBlocksForLead(blocks, lead) : blocks || []
  const parts = []
  for (const block of merged) {
    switch (block.type) {
      case 'header':
        if (block.text) parts.push(block.text)
        break
      case 'hero':
        if (block.heading) parts.push(block.heading)
        if (block.subtext) parts.push(block.subtext)
        break
      case 'text':
        if (block.content) parts.push(block.content)
        break
      case 'button':
        if (block.label && block.url) parts.push(`${block.label}: ${block.url}`)
        break
      case 'form': {
        const url = block.url || resolveFormBlockUrl(block, { lead })
        if (block.title && url) parts.push(`${block.title}: ${url}`)
        break
      }
      case 'image':
        if (block.alt) parts.push(block.alt)
        else if (block.url) parts.push(block.url)
        break
      case 'icon':
        parts.push(getPopularIcon(block.iconId).label)
        break
      case 'social':
        parts.push((block.links || []).map((l) => l.network).join(', '))
        break
      case 'footer':
        if (block.text) parts.push(block.text)
        break
      default:
        break
    }
    parts.push('')
  }
  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim()
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



const ICON_TOKEN_RE = /\[\[icon:([a-z0-9_-]+)(?::(\d+))?(?::(#[0-9a-fA-F]{3,8}))?\]\]/gi

function hasHtml(value) {
  return /<[a-z][\s\S]*>/i.test(String(value || ''))
}

function sanitizeInlineHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
}

function iconImgHtml(iconId, size = 20, color = '#374151') {
  const meta = getPopularIcon(iconId)
  const px = clampSize(size, 14, 40, 20)
  const src = iconifyUrl(meta.iconify, { size: px, color: color || '#374151' })
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(meta.label)}" width="${px}" height="${px}" style="vertical-align:middle;display:inline-block;border:0;margin:0 2px;" />`
}

function expandIconTokens(value) {
  return String(value || '').replace(ICON_TOKEN_RE, (_, id, size, color) => iconImgHtml(id, size ? Number(size) : 20, color || '#374151'))
}

function richFieldToHtml(value, styleCss) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (hasHtml(raw)) {
    const safe = sanitizeInlineHtml(raw)
    const body = safe
      .replace(/<p\b([^>]*)>/gi, `<p$1 style="${styleCss}">`)
      .replace(/<div\b([^>]*)>/gi, `<p$1 style="${styleCss}">`)
      .replace(/<\/div>/gi, '</p>')
    return expandIconTokens(body)
  }
  const chunks = raw
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (!chunks.length) return ''
  return chunks
    .map((p) => `<p style="margin:0 0 16px;${styleCss}">${expandIconTokens(escapeHtml(p).replace(/\n/g, '<br />'))}</p>`)
    .join('')
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
        richFieldToHtml(block.text, `${style}letter-spacing:0.04em;text-transform:uppercase;`) ||
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
      const heading = richFieldToHtml(block.heading, `${hStyle}line-height:1.25;font-weight:700;`)
      const sub = block.subtext ? richFieldToHtml(block.subtext, `${sStyle}line-height:1.5;`) : ''
      return `<tr><td style="padding:8px 32px 16px;background:${bg};text-align:${align};">
        ${heading ? `<h1 style="margin:0 0 8px;${hStyle}line-height:1.25;">${heading.replace(/<\/?p[^>]*>/gi, '')}</h1>` : ''}
        ${sub}
      </td></tr>`
    }
    case 'text':
      return `<tr><td style="padding:0 32px 8px;background:${bg};">${richFieldToHtml(
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
        richFieldToHtml(block.text, style) ||
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
  const footerExtra = options.footerHtml || ''

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Email</title>
</head>
<body style="margin:0;padding:0;background:${theme.backgroundColor};font-family:${theme.fontFamily};">
${preview}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${theme.backgroundColor};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="${width}" cellspacing="0" cellpadding="0" style="max-width:${width}px;width:100%;background:${theme.contentBackground};border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
${rows}
${footerExtra}
</table>
</td></tr>
</table>
</body>
</html>`
}

export function marketingFooterHtml({ orgName, unsubscribeUrl: unsubUrl }) {
  const org = escapeHtml(orgName || 'Connect Intel')
  const link = escapeHtml(unsubUrl || '#')
  return `<tr><td style="padding:0 32px 24px;background:#ffffff;text-align:center;border-top:1px solid #f3f4f6;">
    <p style="margin:12px 0 0;font-size:11px;line-height:1.5;color:#9ca3af;">${org}<br />
    <a href="${link}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a></p>
  </td></tr>`
}

export function normalizeBlocks(blocks) {
  if (!Array.isArray(blocks)) return []
  return blocks
    .slice(0, 40)
    .filter((b) => b && BLOCK_TYPES.includes(b.type))
    .map((block, index) => ({
      id: String(block.id || `blk-${index}`).slice(0, 40),
      type: block.type,
      text: block.text !== undefined ? String(block.text).slice(0, 500) : undefined,
      heading: block.heading !== undefined ? String(block.heading).slice(0, 300) : undefined,
      subtext: block.subtext !== undefined ? String(block.subtext).slice(0, 500) : undefined,
      content: block.content !== undefined ? String(block.content).slice(0, 8000) : undefined,
      label: block.label !== undefined ? String(block.label).slice(0, 120) : undefined,
      url: block.url !== undefined ? String(block.url).slice(0, 2000) : undefined,
      link: block.link !== undefined ? String(block.link).slice(0, 2000) : undefined,
      alt: block.alt !== undefined ? String(block.alt).slice(0, 240) : undefined,
      align: ['left', 'center', 'right'].includes(block.align) ? block.align : undefined,
      height: block.height !== undefined ? Math.max(8, Math.min(80, Number(block.height) || 16)) : undefined,
      fontFamily: block.fontFamily ? String(block.fontFamily).slice(0, 80) : undefined,
      fontSize: block.fontSize !== undefined ? Math.max(10, Math.min(48, Number(block.fontSize) || 15)) : undefined,
      fontWeight: block.fontWeight === 'bold' ? 'bold' : undefined,
      color: block.color ? String(block.color).slice(0, 20) : undefined,
      headingSize: block.headingSize !== undefined ? Math.max(16, Math.min(48, Number(block.headingSize) || 28)) : undefined,
      headingColor: block.headingColor ? String(block.headingColor).slice(0, 20) : undefined,
      subtextSize: block.subtextSize !== undefined ? Math.max(12, Math.min(32, Number(block.subtextSize) || 16)) : undefined,
      subtextColor: block.subtextColor ? String(block.subtextColor).slice(0, 20) : undefined,
      buttonColor: block.buttonColor ? String(block.buttonColor).slice(0, 20) : undefined,
      buttonTextColor: block.buttonTextColor ? String(block.buttonTextColor).slice(0, 20) : undefined,
      width: block.width !== undefined ? Math.max(20, Math.min(100, Number(block.width) || 100)) : undefined,
      rounded: block.rounded ? true : undefined,
      iconId: block.iconId ? String(block.iconId).slice(0, 40) : undefined,
      iconSize: block.iconSize !== undefined ? Math.max(24, Math.min(96, Number(block.iconSize) || 48)) : undefined,
      iconColor: block.iconColor ? String(block.iconColor).slice(0, 20) : undefined,
      iconGap: block.iconGap !== undefined ? Math.max(4, Math.min(24, Number(block.iconGap) || 12)) : undefined,
      links: Array.isArray(block.links)
        ? block.links.slice(0, 12).map((l) => ({
            network: String(l.network || '').slice(0, 30),
            url: String(l.url || '').slice(0, 2000),
          }))
        : undefined,
      formSource: ['native', 'google'].includes(block.formSource) ? block.formSource : undefined,
      formId: block.formId ? String(block.formId).slice(0, 40) : undefined,
      formSlug: block.formSlug ? String(block.formSlug).slice(0, 80) : undefined,
      googleUrl: block.googleUrl ? String(block.googleUrl).slice(0, 2000) : undefined,
      title: block.title !== undefined ? String(block.title).slice(0, 200) : undefined,
      description: block.description !== undefined ? String(block.description).slice(0, 500) : undefined,
      buttonLabel: block.buttonLabel !== undefined ? String(block.buttonLabel).slice(0, 80) : undefined,
    }))
    .filter((block) => {
      if (block.type === 'divider' || block.type === 'spacer') return true
      if (block.type === 'footer') return true
      if (block.type === 'icon') return Boolean(block.iconId)
      if (block.type === 'social') return Boolean(block.links?.length)
      if (block.type === 'form') {
        return Boolean(
          block.title &&
            (block.googleUrl ||
              block.formSlug ||
              block.url ||
              (block.formSource === 'google' && block.googleUrl))
        )
      }
      return Boolean(
        block.text ||
          block.heading ||
          block.content ||
          block.label ||
          block.url ||
          block.subtext
      )
    })
}

export function compileTemplateContent({ blocks, design, body, previewText }) {
  const normalizedBlocks = normalizeBlocks(blocks)
  const normalizedDesign = { ...DEFAULT_THEME, ...(design || {}) }
  if (normalizedBlocks.length) {
    const plain = blocksToPlainText(normalizedBlocks)
    const html = renderEmailHtml(normalizedBlocks, normalizedDesign, { previewText })
    return {
      blocks: normalizedBlocks,
      design: normalizedDesign,
      body: plain || String(body || '').trim(),
      htmlBody: html,
      previewText: previewText ? String(previewText).slice(0, 240) : null,
      designVersion: DESIGN_VERSION,
    }
  }
  const textBody = String(body || '').trim()
  return {
    blocks: [],
    design: normalizedDesign,
    body: textBody,
    htmlBody: null,
    previewText: previewText ? String(previewText).slice(0, 240) : null,
    designVersion: textBody ? 0 : DESIGN_VERSION,
  }
}

export function resolveMessageContent({ subject, body, blocks, design, htmlBody, previewText }, template, lead) {
  const mergedSubject = mergeTemplateText(
    subject?.trim() || template?.subject || '',
    lead
  )
  const useBlocks = normalizeBlocks(blocks?.length ? blocks : template?.blocks)
  const useDesign = { ...DEFAULT_THEME, ...(template?.design || {}), ...(design || {}) }
  const preview = previewText || template?.previewText || null

  if (useBlocks.length) {
    const plain = blocksToPlainText(useBlocks, lead)
    const html = renderEmailHtml(useBlocks, useDesign, { lead, previewText: preview })
    return {
      subject: mergedSubject,
      body: plain,
      htmlBody: html,
      blocks: useBlocks,
      design: useDesign,
    }
  }

  const textBody = mergeTemplateText(body?.trim() || template?.body || '', lead)
  const storedHtml = htmlBody || template?.htmlBody
  let html = null
  if (storedHtml) {
    html = mergeTemplateText(storedHtml, lead)
  } else if (textBody) {
    html = `<html><body style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#374151;"><div>${escapeHtml(textBody).replace(/\n/g, '<br />')}</div></body></html>`
  }

  return {
    subject: mergedSubject,
    body: textBody,
    htmlBody: html,
    blocks: [],
    design: useDesign,
  }
}
