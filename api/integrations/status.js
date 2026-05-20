import { isApolloConfigured, verifyApolloApiKey } from '../../lib/server/apollo.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../../lib/server/http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const apolloConfigured = isApolloConfigured()
  let apollo = false
  let apolloError = null

  if (apolloConfigured) {
    const check = await verifyApolloApiKey()
    apollo = check.ok
    apolloError = check.ok ? null : check.error
  }

  return sendJson(res, 200, {
    providers: {
      apollo,
      apolloConfigured,
      apolloError,
      claude: Boolean(process.env.ANTHROPIC_API_KEY),
    },
  })
}
