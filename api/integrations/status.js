import { isApolloConfigured, verifyApolloApiKey } from '../../lib/server/apollo.js'
import { paidApisEnabled } from '../../lib/server/config.js'
import { isGeminiConfigured } from '../../lib/server/gemini.js'
import { isPerplexityConfigured } from '../../lib/server/perplexity.js'
import { ensureBuiltInDatabase } from '../../lib/server/seed.js'
import { getStoreMetadata, readStore } from '../../lib/server/store.js'
import { isSupabaseEnabled } from '../../lib/server/supabaseClient.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../../lib/server/http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  await ensureBuiltInDatabase()
  const store = await readStore()
  const freeMode = !paidApisEnabled()
  const storage = getStoreMetadata()

  let apollo = false
  let apolloError = null
  const apolloConfigured = isApolloConfigured()

  if (apolloConfigured && !freeMode) {
    const check = await verifyApolloApiKey()
    apollo = check.ok
    apolloError = check.ok ? null : check.error
  } else if (apolloConfigured && freeMode) {
    apolloError = 'Paid APIs disabled. Free database mode is active (default).'
  }

  return sendJson(res, 200, {
    providers: {
      freeMode,
      storage: storage.engine,
      supabase: isSupabaseEnabled(),
      builtInRecords: store.contacts?.length ?? 0,
      companies: store.companies?.length ?? 0,
      gemini: isGeminiConfigured(),
      perplexity: isPerplexityConfigured(),
      apollo,
      apolloConfigured,
      apolloError,
      claude: Boolean(process.env.ANTHROPIC_API_KEY) && !freeMode,
    },
  })
}
