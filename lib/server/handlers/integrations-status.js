import { getInviteEmailDiagnostics, isResendConfigured } from '../email.js'
import { isApolloConfigured, verifyApolloApiKey } from '../apollo.js'
import { paidApisEnabled } from '../config.js'
import { isGeminiConfigured } from '../gemini.js'
import { isPerplexityConfigured } from '../perplexity.js'
import { ensureBuiltInDatabase } from '../seed.js'
import { readStore } from '../store.js'
import {
  getSupabaseEnvStatus,
  isSupabaseEnabled,
  testSupabaseConnection,
} from '../supabaseClient.js'
import { getGmailOAuthDiagnostics } from '../gmailOAuth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const supabaseEnv = getSupabaseEnvStatus()
  const supabaseTest = await testSupabaseConnection()
  const storageEngine = supabaseTest.ok ? 'supabase' : 'sqlite'

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

  const inviteEmail = await getInviteEmailDiagnostics()
  const crmGmailOAuth = getGmailOAuthDiagnostics()

  return sendJson(res, 200, {
    apiVersion: '2026-05-21-supabase-diag',
    providers: {
      freeMode,
      storage: storageEngine,
      supabase: isSupabaseEnabled(),
      supabaseConnected: supabaseTest.ok,
      supabaseEnv,
      supabaseError: supabaseTest.ok ? null : supabaseTest.error,
      builtInRecords: store.contacts?.length ?? 0,
      companies: store.companies?.length ?? 0,
      gemini: isGeminiConfigured(),
      perplexity: isPerplexityConfigured(),
      apollo,
      apolloConfigured,
      apolloError,
      claude: Boolean(process.env.ANTHROPIC_API_KEY) && !freeMode,
      resend: isResendConfigured(),
      emailFrom: Boolean(process.env.EMAIL_FROM),
      inviteEmailReady: inviteEmail.inviteEmailReady,
      inviteEmailProvider: inviteEmail.activeProvider,
      gmailSmtpConfigured: inviteEmail.gmailConfigured,
      inviteEmailTestSender: false,
      inviteEmailHint: inviteEmail.hint,
      inviteFromAddress: inviteEmail.fromAddress,
      resendDomainStatus: inviteEmail.resendDomainStatus,
      resendDomainVerified: inviteEmail.resendDomainVerified,
      crmGmailOAuthConfigured: crmGmailOAuth.configured,
      crmGmailOAuthRedirectUri: crmGmailOAuth.redirectUri,
      crmGmailOAuthMissingEnv: crmGmailOAuth.missingEnv,
    },
  })
}
