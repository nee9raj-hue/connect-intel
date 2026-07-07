/** Compact markdown for CRM AI bubbles — bold, sections, bullets, links. */

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]"'])/g

function linkify(text, keyPrefix) {
  const parts = String(text || '').split(URL_RE)
  return parts.map((part, i) => {
    if (/^https?:\/\//i.test(part)) {
      return (
        <a
          key={`${keyPrefix}-link-${i}`}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="ci-ai-md__link"
        >
          {part.replace(/^https?:\/\/(www\.)?/, '').slice(0, 48)}
          {part.length > 56 ? '…' : ''}
        </a>
      )
    }
    return part
  })
}

function renderInline(text, keyPrefix = 'inline') {
  const boldParts = String(text || '').split(/(\*\*[^*]+\*\*)/g)
  return boldParts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={`${keyPrefix}-b-${i}`} className="ci-ai-md__strong">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return <span key={`${keyPrefix}-t-${i}`}>{linkify(part, `${keyPrefix}-${i}`)}</span>
  })
}

export function renderAssistantMarkdown(text) {
  const lines = String(text || '').split('\n')
  const nodes = []
  let listItems = []

  const flushList = () => {
    if (!listItems.length) return
    nodes.push(
      <ul key={`list-${nodes.length}`} className="ci-ai-md__list">
        {listItems.map((item, i) => (
          <li key={i}>{renderInline(item, `li-${nodes.length}-${i}`)}</li>
        ))}
      </ul>
    )
    listItems = []
  }

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd()
    const trimmed = line.trim()

    if (!trimmed) {
      flushList()
      return
    }

    const bullet = trimmed.match(/^[-•*]\s+(.+)/)
    const numbered = trimmed.match(/^\d+\.\s+(.+)/)

    if (bullet) {
      listItems.push(bullet[1])
      return
    }
    if (numbered) {
      listItems.push(numbered[1])
      return
    }

    flushList()

    const section = trimmed.match(/^\*\*([^*]+)\*\*:?\s*(.*)$/)
    if (section) {
      const [, title, rest] = section
      const tone = sectionTone(title)
      nodes.push(
        <div key={`sec-${idx}`} className={`ci-ai-md__section${tone ? ` ci-ai-md__section--${tone}` : ''}`}>
          <p className="ci-ai-md__heading">{title}</p>
          {rest ? <p className="ci-ai-md__para">{renderInline(rest, `sec-${idx}`)}</p> : null}
        </div>
      )
      return
    }

    nodes.push(
      <p key={`p-${idx}`} className="ci-ai-md__para">
        {renderInline(trimmed, `p-${idx}`)}
      </p>
    )
  })

  flushList()
  return nodes
}

function sectionTone(title) {
  const t = String(title || '').toLowerCase()
  if (t.includes('crm')) return 'crm'
  if (t.includes('web') || t.includes('internet') || t.includes('market')) return 'web'
  if (t.includes('news')) return 'news'
  if (t.includes('company') || t.includes('intelligence')) return 'intel'
  return ''
}

export function sourceBadgesFromMessage(msg) {
  if (msg.sources?.length) {
    return msg.sources.map((s) => ({
      label: s.label || s.type,
      tone: badgeTone(s.type || s.label),
    }))
  }
  const single = sourceBadgeLabel(msg.source)
  return single ? [single] : []
}

function badgeTone(type) {
  if (type === 'web' || type === 'Web research') return 'web'
  if (type === 'crm' || type === 'Your workspace' || type === 'CRM search') return 'crm'
  if (type === 'guide' || type === 'Product guide') return 'guide'
  if (type === 'news') return 'news'
  return 'copilot'
}

export function confidenceLabel(level) {
  if (level === 'high') return { label: 'High confidence', tone: 'high' }
  if (level === 'medium') return { label: 'Medium confidence', tone: 'medium' }
  if (level === 'low') return { label: 'Low confidence', tone: 'low' }
  return null
}

export function sourceBadgeLabel(source) {
  if (source === 'web') return { label: 'Web research', tone: 'web' }
  if (source === 'grounded') return { label: 'Your workspace', tone: 'crm' }
  if (source === 'faq' || source === 'faq_confident') return { label: 'Product guide', tone: 'guide' }
  if (source === 'copilot') return { label: 'Connect Copilot', tone: 'copilot' }
  if (source === 'web_error') return { label: 'Web research', tone: 'muted' }
  return null
}
