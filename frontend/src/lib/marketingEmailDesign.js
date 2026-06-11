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
import {
  applyFormBlockUrl,
  isGoogleFormBlock,
  mergeFormBlocksForLead,
  resolveFormBlockUrl,
} from '../../../lib/marketingFormSchema.js'
import { buildExtendedStarterTemplates } from './marketingStarterTemplates.js'

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

const HANDCRAFTED_STARTER_TEMPLATES = [
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
  {
    id: 'product-launch',
    name: 'Product launch',
    subject: 'Introducing something new for {{companyName}}',
    design: { ...DEFAULT_THEME, primaryColor: '#7c3aed' },
    blocks: [
      { id: 'h1', type: 'header', text: 'Product update', align: 'center' },
      {
        id: 'hero1',
        type: 'hero',
        heading: 'Built for teams like {{companyName}}',
        subtext: 'Hi {{firstName}} — we are excited to share what is new.',
      },
      {
        id: 't1',
        type: 'text',
        content:
          'We have been working on features that help exporters and B2B teams close faster.\n\n• Faster follow-ups\n• Clear pipeline view\n• Works with your existing workflow',
      },
      { id: 'b1', type: 'button', label: 'See what is new', url: 'https://connectintel.net', align: 'center' },
      { id: 'f1', type: 'footer' },
    ],
  },
  {
    id: 'event-invite',
    name: 'Event invite',
    subject: 'You are invited, {{firstName}}',
    design: { ...DEFAULT_THEME, primaryColor: '#dc2626' },
    blocks: [
      { id: 'h1', type: 'header', text: 'Invitation', align: 'center' },
      {
        id: 'hero1',
        type: 'hero',
        heading: 'Join us live',
        subtext: 'A session tailored for {{companyName}} and peers in your industry.',
      },
      {
        id: 't1',
        type: 'text',
        content:
          'Hi {{firstName}},\n\nWe would love to have you. Reply to this message or use the button below to confirm your spot.',
      },
      { id: 'b1', type: 'button', label: 'Reserve my seat', url: 'https://connectintel.net', align: 'center' },
      { id: 's1', type: 'spacer', height: 12 },
      { id: 'f1', type: 'footer' },
    ],
  },
  {
    id: 're-engagement',
    name: 'Re-engagement',
    subject: 'Still interested, {{firstName}}?',
    design: { ...DEFAULT_THEME, primaryColor: '#ea580c' },
    blocks: [
      { id: 'h1', type: 'header', text: 'Quick note', align: 'left' },
      {
        id: 't1',
        type: 'text',
        content:
          'Hi {{firstName}},\n\nWe have not heard back from {{companyName}} in a while. If timing changed, no problem — just let us know.',
      },
      {
        id: 't2',
        type: 'text',
        content: 'If you are still exploring options, I am happy to send a short summary or jump on a 10-minute call.',
      },
      { id: 'b1', type: 'button', label: 'Yes, still interested', url: 'https://connectintel.net', align: 'center' },
      { id: 'f1', type: 'footer' },
    ],
  },
  {
    id: 'case-study',
    name: 'Case study',
    subject: 'How teams like {{companyName}} grow exports',
    design: { ...DEFAULT_THEME, primaryColor: '#0891b2' },
    blocks: [
      { id: 'h1', type: 'header', text: 'Customer story', align: 'center' },
      {
        id: 'hero1',
        type: 'hero',
        heading: 'Results that speak for themselves',
        subtext: 'Hi {{firstName}} — thought this might resonate with {{companyName}}.',
      },
      {
        id: 't1',
        type: 'text',
        content:
          'One of our customers increased qualified conversations by focusing on the right leads and consistent follow-up.\n\nI can share the full breakdown if useful.',
      },
      { id: 'b1', type: 'button', label: 'Read the story', url: 'https://connectintel.net', align: 'center' },
      { id: 'f1', type: 'footer' },
    ],
  },
  {
    id: 'webinar',
    name: 'Webinar',
    subject: 'Live webinar for {{firstName}}',
    design: { ...DEFAULT_THEME, primaryColor: '#4f46e5' },
    blocks: [
      { id: 'h1', type: 'header', text: 'Webinar', align: 'center' },
      {
        id: 'hero1',
        type: 'hero',
        heading: 'Export growth playbook',
        subtext: 'Practical tactics for {{companyName}} — 45 minutes, Q&A included.',
      },
      { id: 't1', type: 'text', content: 'Hi {{firstName}},\n\nSave your seat for our upcoming session. Recording shared with registrants.' },
      { id: 'b1', type: 'button', label: 'Register free', url: 'https://connectintel.net', align: 'center' },
      { id: 'f1', type: 'footer' },
    ],
  },
  {
    id: 'thank-you',
    name: 'Thank you',
    subject: 'Thank you, {{firstName}}',
    design: { ...DEFAULT_THEME, primaryColor: '#059669' },
    blocks: [
      { id: 'h1', type: 'header', text: 'Thank you', align: 'center' },
      {
        id: 'hero1',
        type: 'hero',
        heading: 'We appreciate you',
        subtext: 'Hi {{firstName}} — thanks from our team to everyone at {{companyName}}.',
      },
      {
        id: 't1',
        type: 'text',
        content: 'Your time and trust mean a lot. If there is anything we can improve, reply anytime.',
      },
      { id: 'f1', type: 'footer' },
    ],
  },
  {
    id: 'pricing',
    name: 'Pricing / offer',
    subject: 'Special offer for {{companyName}}',
    design: { ...DEFAULT_THEME, primaryColor: '#b45309' },
    blocks: [
      { id: 'h1', type: 'header', text: 'Limited offer', align: 'center' },
      {
        id: 'hero1',
        type: 'hero',
        heading: 'Pricing tailored for you',
        subtext: 'Hi {{firstName}} — here is what we can do for {{companyName}} this quarter.',
      },
      {
        id: 't1',
        type: 'text',
        content:
          '• Flexible plans for growing teams\n• No long lock-in\n• Onboarding support included\n\nReply for a custom quote.',
      },
      { id: 'b1', type: 'button', label: 'View plans', url: 'https://connectintel.net', align: 'center' },
      { id: 'f1', type: 'footer' },
    ],
  },
  {
    id: 'testimonial',
    name: 'Testimonial',
    subject: 'What peers say — for {{firstName}}',
    design: { ...DEFAULT_THEME, primaryColor: '#6366f1' },
    blocks: [
      { id: 'h1', type: 'header', text: 'Testimonial', align: 'center' },
      {
        id: 't1',
        type: 'text',
        content:
          '"We cut follow-up time in half and never lost track of a lead again."\n\n— Operations lead, manufacturing exporter',
      },
      {
        id: 't2',
        type: 'text',
        content: 'Hi {{firstName}}, thought you might find this relevant for {{companyName}}.',
      },
      { id: 'b1', type: 'button', label: 'Talk to us', url: 'https://connectintel.net', align: 'center' },
      { id: 'f1', type: 'footer' },
    ],
  },
  {
    id: 'holiday',
    name: 'Seasonal greeting',
    subject: 'Warm wishes from our team',
    design: { ...DEFAULT_THEME, primaryColor: '#be123c', backgroundColor: '#fef2f2' },
    blocks: [
      { id: 'h1', type: 'header', text: 'Season\'s greetings', align: 'center' },
      {
        id: 'hero1',
        type: 'hero',
        heading: 'Happy holidays, {{firstName}}',
        subtext: 'Wishing you and everyone at {{companyName}} a great season ahead.',
      },
      { id: 't1', type: 'text', content: 'Thank you for being part of our community this year.' },
      { id: 'f1', type: 'footer' },
    ],
  },
  {
    id: 'follow-up-short',
    name: 'Short follow-up',
    subject: 'Following up — {{firstName}}',
    design: { ...DEFAULT_THEME },
    blocks: [
      {
        id: 't1',
        type: 'text',
        content: 'Hi {{firstName}},\n\nJust bumping this to the top of your inbox. Happy to help {{companyName}} whenever timing works.',
      },
      { id: 'b1', type: 'button', label: 'Reply here', url: 'mailto:', align: 'left' },
      { id: 'f1', type: 'footer' },
    ],
  },
]

export const STARTER_TEMPLATES = [
  ...HANDCRAFTED_STARTER_TEMPLATES,
  ...buildExtendedStarterTemplates(),
]

export const PREVIEW_LEAD = {
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
  return mergeFormBlocksForLead(
    (blocks || []).map((block) => mergeBlock(block, lead)),
    lead,
    canvasAppBase()
  )
}

/** Plain text for WhatsApp (wa.me) from designed blocks. */
export function blocksToPlainText(blocks, lead = PREVIEW_LEAD) {
  const merged = mergeBlocksForLead(blocks, lead)
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
        else if (block.label) parts.push(block.label)
        break
      case 'form': {
        const url = block.url || block.resolvedFormUrl
        if (!url) break
        const label =
          block.formSource === 'google'
            ? block.buttonLabel || block.title
            : block.title
        if (label) parts.push(`${label}: ${url}`)
        break
      }
      case 'image':
        if (block.alt) parts.push(block.alt)
        else if (block.url) parts.push(block.url)
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

function canvasAppBase() {
  return typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'https://connectintel.net'
}

function resolveFormBlockUrlForRender(block, lead = null) {
  const prepared = applyFormBlockUrl(block, { lead, appBase: canvasAppBase() })
  return sanitizeUrl(prepared.url || resolveFormBlockUrl(prepared, { lead, appBase: canvasAppBase() }))
}

const CANVAS_BLOCK_LABELS = {
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

function wrapInteractiveCanvasRow(trHtml, blockIndex, block, renderOpts) {
  const trimmed = (trHtml || '').trim()
  if (!renderOpts.canvasInteractive || !/^<tr/i.test(trimmed)) return trHtml || ''
  const selected = renderOpts.selectedBlockIndex === blockIndex
  const blockLabel = CANVAS_BLOCK_LABELS[block?.type] || block?.type || 'Section'
  const selStyle = selected
    ? 'outline:2px solid #FF773D;outline-offset:-2px;background-color:rgba(255,119,61,0.1);'
    : ''
  const attrs = `data-ci-block-index="${blockIndex}" data-ci-block-label="${escapeHtml(blockLabel)}" data-ci-block-selectable="true" title="Click to edit ${escapeHtml(blockLabel)}"`
  const cls = `ci-canvas-block-row${selected ? ' is-selected' : ''}`
  return trimmed.replace(/^<tr/i, `<tr ${attrs} class="${cls}" style="cursor:pointer;${selStyle}"`)
}

function renderBlockHtml(block, theme, renderOpts = {}) {
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
      const lead = renderOpts.lead ?? null
      const url = resolveFormBlockUrlForRender(block, lead)
      const title = block.title || 'Share your feedback'
      const desc = block.description || ''
      const btn = block.buttonLabel || 'Open form'
      const bgColor = block.buttonColor || primary
      const btnStyle = textStyle(block, theme, {
        fontSize: clampSize(block.fontSize, 12, 20, 14),
        color: block.buttonTextColor || '#ffffff',
        fontWeight: '600',
      })
      const isGoogle = isGoogleFormBlock(block)
      const titleStyle = textStyle(block, theme, { fontSize: 17, color: '#111827', fontWeight: '700' })
      const descStyle = textStyle(block, theme, { fontSize: 14, color: '#6b7280' })
      const badge = isGoogle
        ? '<span style="display:inline-block;font-size:11px;font-weight:600;color:#6b7280;margin-bottom:8px;">Google Form</span>'
        : '<span style="display:inline-block;font-size:11px;font-weight:600;color:#6b7280;margin-bottom:8px;">Connect Intel form</span>'
      const borderStyle = url
        ? 'border:1px solid #e5e7eb;background:#fafafa;'
        : 'border:2px dashed #cbd5e1;background:#f8fafc;'
      const hint = url
        ? ''
        : `<p style="margin:12px 0 0;font-size:12px;line-height:1.45;color:#94a3b8;${descStyle}">Select a form in the block editor (or paste a Google Form link).</p>`
      const btnHtml = url
        ? `<a href="${escapeHtml(url)}" data-ci-canvas-link="1" style="display:inline-block;padding:11px 20px;background:${bgColor};text-decoration:none;border-radius:8px;${btnStyle}">${escapeHtml(btn)}</a>`
        : `<span style="display:inline-block;padding:11px 20px;background:${bgColor};opacity:0.85;border-radius:8px;${btnStyle}">${escapeHtml(btn)}</span>`
      return `<tr><td style="padding:16px 32px;background:${bg};text-align:${align};">
        <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;max-width:100%;${borderStyle}border-radius:12px;">
        <tr><td style="padding:20px 20px 16px;text-align:${align};">
        ${badge}
        <p style="margin:0 0 8px;${titleStyle}">${escapeHtml(title)}</p>
        ${desc ? `<p style="margin:0 0 16px;${descStyle}">${escapeHtml(desc)}</p>` : ''}
        ${btnHtml}
        ${hint}
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

function buildEmailPresentation(blocks, design = {}, options = {}) {
  const theme = { ...DEFAULT_THEME, ...design }
  const width = Math.max(320, Math.min(720, Number(theme.contentWidth) || 600))
  const lead = options.lead ?? null
  const mergedBlocks = lead ? mergeBlocksForLead(blocks, lead, canvasAppBase()) : blocks || []
  const renderOpts = {
    lead,
    canvasInteractive: Boolean(options.canvasInteractive),
    selectedBlockIndex: options.selectedBlockIndex ?? -1,
  }
  const rows = mergedBlocks
    .map((block, index) => {
      const html = renderBlockHtml(block, theme, renderOpts)
      return wrapInteractiveCanvasRow(html, index, block, renderOpts)
    })
    .join('')
  const preview = options.previewText
    ? `<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;">${escapeHtml(options.previewText)}</span>`
    : ''
  const footer = `<tr><td style="padding:0 32px 24px;background:#ffffff;text-align:center;border-top:1px solid #f3f4f6;"><p style="margin:12px 0 0;font-size:11px;line-height:1.5;color:#9ca3af;">Your company · Unsubscribe link added when sent</p></td></tr>`
  const tableOverflow = renderOpts.canvasInteractive ? 'overflow:visible;' : 'overflow:hidden;'
  const innerTable = `<table role="presentation" width="${width}" cellspacing="0" cellpadding="0" style="max-width:${width}px;width:100%;background:${theme.contentBackground};border-radius:12px;${tableOverflow}box-shadow:0 1px 3px rgba(0,0,0,0.06);">${rows}${footer}</table>`
  const outerTable = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${theme.backgroundColor};padding:24px 12px;"><tr><td align="center">${innerTable}</td></tr></table>`
  return { theme, width, preview, outerTable }
}

/** Inline HTML for the visual builder canvas (natural document height, page scroll). */
export function renderEmailCanvasHtml(blocks, design = {}, options = {}) {
  const lead = options.lead ?? PREVIEW_LEAD
  const { theme, preview, outerTable } = buildEmailPresentation(blocks, design, {
    ...options,
    lead,
    canvasInteractive: true,
    selectedBlockIndex: options.selectedBlockIndex ?? -1,
  })
  return `${preview}<div class="marketing-email-canvas-root" style="margin:0;padding:0;background:${theme.backgroundColor};font-family:${theme.fontFamily};">${outerTable}</div>`
}

/** Attach first saved form when adding a form block in the builder. */
export function attachDefaultMarketingForm(block, marketingForms = []) {
  if (block?.type !== 'form' || !marketingForms?.length) return block
  if (block.formId || block.formSlug || block.googleUrl) return block
  const f = marketingForms[0]
  return applyFormBlockUrl(
    {
      ...block,
      formSource: 'native',
      formId: f.id,
      formSlug: f.slug,
      title: block.title || f.title || f.name,
      description: block.description || f.description || '',
    },
    { appBase: canvasAppBase() }
  )
}

export function renderEmailHtml(blocks, design = {}, options = {}) {
  const { theme, preview, outerTable } = buildEmailPresentation(blocks, design, options)
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:${theme.backgroundColor};font-family:${theme.fontFamily};">${preview}${outerTable}</body></html>`
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
