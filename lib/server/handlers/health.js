import { getSupabaseEnvStatus, isSupabaseEnabled, testSupabaseConnection } from '../supabaseClient.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const supabaseEnv = getSupabaseEnvStatus()
  const supabaseTest = await testSupabaseConnection()

  return sendJson(res, 200, {
    ok: true,
    apiVersion: '2026-05-21-supabase-diag',
    git: 'e67f5c5+',
    supabase: {
      configured: isSupabaseEnabled(),
      connected: supabaseTest.ok,
      env: supabaseEnv,
      error: supabaseTest.ok ? null : supabaseTest.error,
    },
    node: process.version,
  })
}
