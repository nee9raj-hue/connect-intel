import { getSupabaseEnvStatus, isSupabaseEnabled, testSupabaseConnection } from '../supabaseClient.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'

/** Public check — no login required. Use after changing Vercel env vars + redeploy. */
export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const env = getSupabaseEnvStatus()
  const test = await testSupabaseConnection()

  return sendJson(res, 200, {
    ok: test.ok,
    message: test.ok
      ? 'Supabase is reachable from production. You can sign in.'
      : 'Supabase is NOT reachable from production. Sign-in will fail until this is ok.',
    supabase: {
      configured: isSupabaseEnabled(),
      connected: test.ok,
      latencyMs: test.latencyMs ?? null,
      error: test.error ?? null,
      env: {
        urlSet: env.urlSet,
        keySet: env.keySet,
        keyEnvName: env.keyEnvName,
        urlHost: env.urlHost,
        keyLooksValid: env.keyLooksValid,
      },
    },
    checklist: [
      'Supabase → project must be Active (not Paused)',
      'Supabase → Settings → API → copy service_role secret (not anon)',
      'Vercel → SUPABASE_URL = https://YOUR_PROJECT.supabase.co (no /rest/v1/)',
      'Vercel → SUPABASE_SERVICE_ROLE_KEY = service role JWT',
      'Vercel → Deployments → Redeploy production (required after env change)',
      'Open /api/supabase-diag until connected: true, then sign in',
    ],
  })
}
