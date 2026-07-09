/**
 * Parse pasted RFQ / shipment text into structured freight fields (Gemini).
 */
import { isGeminiConfigured } from '../gemini.js'
import { isFreightDealOrg } from '../../freightDeal.js'
import { getOrganization } from '../organizations.js'
import {
  formatRfqSummary,
  looksLikeRfqPaste,
  mapLogiCopilotJsonToFreightRfq,
} from './rfqSignals.js'

export { looksLikeRfqPaste }

async function parseRfqPasteWithGemini(rawMessage) {
  if (!isGeminiConfigured()) return null

  const { parseRfqPasteWithGemini: parse } = await import('../gemini.js')
  return parse(rawMessage)
}

export async function runRfqParseAgent({ message, user, store, uiContext = {} }) {
  const text = String(message || '').trim()
  const org = user?.organizationId ? getOrganization(store, user.organizationId) : null
  const freightOrg = isFreightDealOrg(org || user, user)

  if (!looksLikeRfqPaste(text)) {
    return null
  }

  if (!freightOrg) {
    return {
      reply:
        '**Shipment text detected** — RFQ auto-fill is enabled for freight workspaces. Your org uses standard deals; copy the details into a deal manually or ask your admin to enable freight RFQ.',
      source: 'copilot',
      sources: [{ type: 'copilot', label: 'Connect Copilot' }],
      confidence: 'medium',
      suggestions: ['Research this company', 'Who needs follow-up today?'],
      actions: [{ type: 'navigate', panel: 'pipeline', label: 'Open Pipeline' }],
    }
  }

  let parsed = null
  try {
    parsed = await parseRfqPasteWithGemini(text)
  } catch (err) {
    return {
      reply: `**RFQ parse failed:** ${String(err?.message || err).slice(0, 160)}\n\nTry pasting commodity, weight, origin, destination, and incoterm on separate lines.`,
      source: 'rfq_parse',
      sources: [{ type: 'copilot', label: 'RFQ parse' }],
      confidence: 'low',
      suggestions: ['Paste RFQ again with weight and cities', 'What documents for export to USA?'],
      actions: [],
    }
  }

  if (!parsed) {
    return {
      reply:
        '**RFQ parsing unavailable** — Gemini is not configured. Paste commodity, gross weight (kg), origin/destination, and incoterm manually on the deal RFQ form.',
      source: 'rfq_parse',
      sources: [{ type: 'copilot', label: 'RFQ parse' }],
      confidence: 'low',
      suggestions: ['Open a lead and add deal RFQ', 'How do I add a freight deal?'],
      actions: [{ type: 'navigate', panel: 'pipeline', label: 'Open Pipeline' }],
    }
  }

  const freight = mapLogiCopilotJsonToFreightRfq(parsed, text)
  if (!freight) {
    return {
      reply:
        '**No shipment parameters found** in that text. Include at least commodity, gross weight, origin city, or destination — and incoterm if mentioned.',
      source: 'rfq_parse',
      sources: [{ type: 'copilot', label: 'RFQ parse' }],
      confidence: 'medium',
      suggestions: ['Try pasting the full WhatsApp RFQ', 'What documents for FOB export?'],
      actions: [],
    }
  }

  const summary = formatRfqSummary(freight)
  const leadId = uiContext.leadId || null
  const actions = []

  if (leadId) {
    actions.push({
      type: 'apply_rfq',
      leadId,
      label: 'Apply to deal RFQ',
      payload: { freight },
    })
  } else {
    actions.push({
      type: 'navigate',
      panel: 'pipeline',
      label: 'Open a lead to apply',
    })
  }

  return {
    reply: `**Parsed RFQ** from your message:\n\n${summary}\n\n${
      leadId
        ? 'Click **Apply to deal RFQ** to prefill the deal form on this lead.'
        : 'Open a lead first, then paste the RFQ again — or apply from the Deals tab after opening a lead.'
    }`,
    rfqPrefill: freight,
    source: 'rfq_parse',
    sources: [{ type: 'ai', label: 'RFQ extraction' }],
    confidence: 'high',
    suggestions: [
      'What documents for this commodity export?',
      'Add another RFQ field manually',
      leadId ? 'Apply to deal RFQ' : 'Open Pipeline',
    ],
    actions,
    planSteps: [
      { id: 'parse', label: 'Parsing shipment text', status: 'done' },
      { id: 'map', label: 'Mapping to deal RFQ fields', status: 'done' },
    ],
  }
}
