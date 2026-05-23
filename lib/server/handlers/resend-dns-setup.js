import { getInviteEmailDiagnostics, verifyInviteDomainInResend } from '../email.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'

/** Public setup helper — returns DNS records needed for connectintel.net (no secrets). */
export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method === 'GET') {
    const diag = await getInviteEmailDiagnostics()
    return sendJson(res, 200, {
      ...diag,
      domain: diag.resendDomain || 'connectintel.net',
      records: diag.resendDnsRecords,
      squarespaceGuide: '/SQUARESPACE-RESEND-DNS.md',
    })
  }

  if (req.method === 'POST') {
    const result = await verifyInviteDomainInResend('invite@connectintel.net')
    const diag = await getInviteEmailDiagnostics()
    return sendJson(res, 200, {
      verify: result,
      ...diag,
    })
  }

  return methodNotAllowed(res, ['GET', 'POST'])
}
