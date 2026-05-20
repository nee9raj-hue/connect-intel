import { isApolloConfigured } from '../../lib/server/apollo.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../../lib/server/http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  return sendJson(res, 200, {
    providers: {
      apollo: isApolloConfigured(),
      claude: Boolean(process.env.ANTHROPIC_API_KEY),
    },
  })
}
