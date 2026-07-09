/**
 * Logistics intelligence — Indian export compliance, customs, documentation (Perplexity).
 */
import { isPerplexityConfigured, logisticsAssistantWebResearch } from '../perplexity.js'

export async function runLogisticsIntelAgent({ message }) {
  const text = String(message || '').trim().slice(0, 1500)
  if (!text) return null

  if (!isPerplexityConfigured()) {
    return {
      reply:
        '**Logistics Q&A** needs live web research (Perplexity). Your admin can set `PERPLEXITY_API_KEY` — meanwhile, ask your CHA for country-specific document lists.',
      source: 'logistics_intel',
      sources: [{ type: 'copilot', label: 'Connect Copilot' }],
      confidence: 'low',
      suggestions: ['What is IEC for export?', 'FOB vs CIF for exporters'],
      actions: [],
    }
  }

  try {
    const web = await logisticsAssistantWebResearch(text)
    if (web.error || !web.text) {
      return {
        reply: `**Research failed:** ${web.error || 'No answer'}`,
        source: 'logistics_intel',
        sources: [{ type: 'copilot', label: 'Connect Copilot' }],
        confidence: 'low',
        suggestions: ['Try a shorter question', 'Paste RFQ text for auto-fill'],
        actions: [],
      }
    }

    return {
      reply: web.text,
      source: 'logistics_intel',
      sources: [{ type: 'web', label: 'Logistics research' }],
      confidence: 'medium',
      suggestions: [
        'Documents for FOB shipment from India',
        'IEC and AD Code registration steps',
        'Paste an RFQ to auto-fill deal',
      ],
      actions: [],
      planSteps: [{ id: 'research', label: 'Researching customs & docs', status: 'done' }],
    }
  } catch (err) {
    return {
      reply: `**Research failed:** ${String(err?.message || err).slice(0, 160)}`,
      source: 'logistics_intel',
      sources: [{ type: 'copilot', label: 'Connect Copilot' }],
      confidence: 'low',
      suggestions: ['Try a shorter question', 'Paste RFQ text for auto-fill'],
      actions: [],
    }
  }
}
