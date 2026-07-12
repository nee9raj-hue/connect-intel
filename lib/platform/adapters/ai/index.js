import { generateText as geminiGenerate, isGeminiConfigured, parseSearchQueryWithGemini } from '../../../server/gemini.js'

/**
 * AI Gateway — Copilot and enrichment call this port only.
 * Never import vendor SDKs from business modules.
 */
export function createAiGatewayAdapter() {
  return {
    provider: 'gateway',
    async generateText(prompt, options = {}) {
      if (!isGeminiConfigured()) return null
      return geminiGenerate(prompt, options)
    },
    async run(task, input = {}) {
      switch (task) {
        case 'parse_search_query':
          return { result: await parseSearchQueryWithGemini(input.query, input.existingFilters) }
        case 'generate_text': {
          const text = await geminiGenerate(input.prompt, input.options)
          return { text }
        }
        case 'web_research': {
          const { crmAssistantWebResearch } = await import('../../../server/perplexity.js')
          const results = await crmAssistantWebResearch(input.query, input.options)
          return { results, provider: 'perplexity' }
        }
        default:
          return { error: `Unknown AI task: ${task}` }
      }
    },
  }
}

export function createAiAdapter(provider) {
  switch (provider) {
    case 'gateway':
    case 'gemini':
    case 'openai':
    case 'anthropic':
    case 'perplexity':
    default:
      return createAiGatewayAdapter()
  }
}
