import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { isBackgroundEmailEnabled, isMeilisearchEnabled, getInfraStatus } from '../infra/config.js'
import { isWorkerOnlyEmailRequired } from '../infra/emailWorkerPolicy.js'
import { getExtensionDistribution } from '../extensionDistribution.js'

export function getPublicGoogleClientId() {
  return String(process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '').trim()
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const googleClientId = getPublicGoogleClientId()

  const infra = getInfraStatus()
  const extension = getExtensionDistribution()

  return sendJson(res, 200, {
    googleClientId,
    googleAuthConfigured: Boolean(googleClientId),
    backgroundEmailSends: isBackgroundEmailEnabled(),
    emailWorkerOnly: isWorkerOnlyEmailRequired(),
    meilisearchEnabled: isMeilisearchEnabled(),
    infra,
    chromeExtension: {
      storeUrl: extension.chromeWebStoreUrl,
      version: extension.extensionVersion,
      installGuideUrl: extension.installGuideUrl,
    },
  })
}
