import { POPULAR_ICONS, iconifyUrl } from './marketingEmailTokens'

const ALLOWED_TAGS = new Set(['P', 'BR', 'SPAN', 'STRONG', 'B', 'EM', 'I', 'IMG', 'DIV'])

export function isRichHtml(value) {
  return /<[a-z][\s\S]*>/i.test(String(value || ''))
}

export function plainTextToEditorHtml(text) {
  const chunks = String(text || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (!chunks.length) return '<p><br></p>'
  return chunks
    .map((p) => {
      const lines = p.split('\n').map((line) => escapeHtml(line)).join('<br>')
      return `<p>${lines || '<br>'}</p>`
    })
    .join('')
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function getPopularIconMeta(id) {
  return POPULAR_ICONS.find((i) => i.id === id) || POPULAR_ICONS[0]
}

export function iconImgHtml(iconId, size = 20, color = '#374151') {
  const meta = getPopularIconMeta(iconId)
  const px = Math.max(14, Math.min(40, Number(size) || 20))
  const src = iconifyUrl(meta.iconify, { size: px, color: color || '#374151' })
  return `<img src="${src}" alt="${escapeHtml(meta.label)}" width="${px}" height="${px}" data-ci-icon="${escapeHtml(iconId)}" data-ci-icon-size="${px}" data-ci-icon-color="${escapeHtml(color || '#374151')}" style="vertical-align:middle;display:inline-block;border:0;margin:0 2px;" />`
}

const ICON_TOKEN_RE = /\[\[icon:([a-z0-9_-]+)(?::(\d+))?(?::(#[0-9a-fA-F]{3,8}))?\]\]/gi

export function expandIconTokens(html) {
  return String(html || '').replace(ICON_TOKEN_RE, (_, id, size, color) =>
    iconImgHtml(id, size ? Number(size) : 20, color || '#374151')
  )
}

export function sanitizeRichHtml(html) {
  if (!html || typeof document === 'undefined') {
    return String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
  }

  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body.firstElementChild
  if (!root) return ''

  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent
    if (node.nodeType !== Node.ELEMENT_NODE) return ''

    const tag = node.tagName.toUpperCase()
    if (!ALLOWED_TAGS.has(tag)) {
      return Array.from(node.childNodes).map(walk).join('')
    }

    if (tag === 'IMG') {
      const iconId = node.getAttribute('data-ci-icon')
      if (!iconId || !POPULAR_ICONS.some((i) => i.id === iconId)) return ''
      const size = node.getAttribute('data-ci-icon-size') || '20'
      const color = node.getAttribute('data-ci-icon-color') || '#374151'
      return iconImgHtml(iconId, Number(size), color)
    }

    if (tag === 'BR') return '<br />'

    const allowedStyle = []
    const style = node.getAttribute('style') || ''
    const fontSize = style.match(/font-size:\s*(\d+)px/i)
    const color = style.match(/(?:^|;)\s*color:\s*([^;]+)/i)
    const fontWeight = style.match(/font-weight:\s*(bold|[67]00)/i)
    if (fontSize) allowedStyle.push(`font-size:${fontSize[1]}px`)
    if (color) allowedStyle.push(`color:${color[1].trim()}`)
    if (fontWeight) allowedStyle.push('font-weight:bold')

    const inner = Array.from(node.childNodes).map(walk).join('')
    const styleAttr = allowedStyle.length ? ` style="${allowedStyle.join(';')}"` : ''

    if (tag === 'P' || tag === 'DIV') return `<p${styleAttr}>${inner || '<br />'}</p>`
    if (tag === 'SPAN') return `<span${styleAttr}>${inner}</span>`
    if (tag === 'STRONG' || tag === 'B') return `<strong>${inner}</strong>`
    if (tag === 'EM' || tag === 'I') return `<em>${inner}</em>`
    return inner
  }

  return Array.from(root.childNodes).map(walk).join('') || '<p><br /></p>'
}

export function renderRichHtmlForEmail(html, baseStyleCss) {
  const expanded = expandIconTokens(html)
  if (typeof document === 'undefined') {
    return `<div style="margin:0 0 16px;${baseStyleCss}">${expanded}</div>`
  }

  const doc = new DOMParser().parseFromString(`<div>${expanded}</div>`, 'text/html')
  const root = doc.body.firstElementChild
  if (!root) return ''

  const paragraphs = []
  const children = root.tagName === 'DIV' ? Array.from(root.children) : [root]

  for (const child of children.length ? children : [root]) {
    const tag = child.tagName?.toUpperCase()
    if (tag === 'P' || tag === 'DIV') {
      const style = child.getAttribute('style') || ''
      const merged = [baseStyleCss, style].filter(Boolean).join(';')
      paragraphs.push(`<p style="margin:0 0 16px;${merged}">${child.innerHTML}</p>`)
    } else {
      paragraphs.push(`<p style="margin:0 0 16px;${baseStyleCss}">${child.outerHTML || child.textContent}</p>`)
    }
  }

  return paragraphs.join('') || `<p style="margin:0 0 16px;${baseStyleCss}">${root.innerHTML}</p>`
}

export function richFieldToEmailHtml(value, baseStyleCss) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (isRichHtml(raw)) return renderRichHtmlForEmail(sanitizeRichHtml(raw), baseStyleCss)
  const chunks = raw
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (!chunks.length) return ''
  return chunks
    .map((p) => {
      const withIcons = expandIconTokens(escapeHtml(p).replace(/\n/g, '<br />'))
      return `<p style="margin:0 0 16px;${baseStyleCss}">${withIcons}</p>`
    })
    .join('')
}

export function applyInlineStyleToSelection(editorEl, styles) {
  if (!editorEl) return false
  const sel = window.getSelection()
  if (!sel?.rangeCount || sel.isCollapsed) return false
  const range = sel.getRangeAt(0)
  if (!editorEl.contains(range.commonAncestorContainer)) return false

  const span = document.createElement('span')
  if (styles.fontSize) span.style.fontSize = `${styles.fontSize}px`
  if (styles.color) span.style.color = styles.color
  if (styles.fontWeight === 'bold') span.style.fontWeight = '700'

  try {
    range.surroundContents(span)
  } catch {
    const fragment = range.extractContents()
    span.appendChild(fragment)
    range.insertNode(span)
  }

  sel.removeAllRanges()
  const after = document.createRange()
  after.selectNodeContents(span)
  after.collapse(false)
  sel.addRange(after)
  return true
}

export function insertIconAtCursor(editorEl, iconId, size = 20, color = '#374151') {
  if (!editorEl) return false
  editorEl.focus()
  const sel = window.getSelection()
  if (!sel?.rangeCount) return false

  const meta = getPopularIconMeta(iconId)
  const px = Math.max(14, Math.min(40, Number(size) || 20))
  const img = document.createElement('img')
  img.src = iconifyUrl(meta.iconify, { size: px, color: color || '#374151' })
  img.width = px
  img.height = px
  img.alt = meta.label
  img.setAttribute('data-ci-icon', iconId)
  img.setAttribute('data-ci-icon-size', String(px))
  img.setAttribute('data-ci-icon-color', color || '#374151')
  img.style.verticalAlign = 'middle'
  img.style.display = 'inline-block'
  img.style.margin = '0 2px'
  img.draggable = false

  const range = sel.getRangeAt(0)
  if (!editorEl.contains(range.commonAncestorContainer)) {
    range.selectNodeContents(editorEl)
    range.collapse(false)
  }
  range.insertNode(img)
  range.setStartAfter(img)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
  return true
}
