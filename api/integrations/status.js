import { isApolloConfigured, verifyApolloApiKey } from '../../lib/server/apollo.js'
import { paidApisEnabled } from '../../lib/server/config.js'
import { ensureBuiltInDatabase } from '../../lib/server/seed.js'
import { readStore } from '../../lib/server/store.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../../lib/server/http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  await ensureBuiltInDatabase()
  const store = await readStore()
  const freeMode = !paidApisEnabled()

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
      builtInRecords: store.contacts?.length ?? 0,
      apollo,
      apolloConfigured,
      apolloError,
      claude: Boolean(process.env.ANTHROPIC_API_KEY) && !freeMode,
    },
  })
}
