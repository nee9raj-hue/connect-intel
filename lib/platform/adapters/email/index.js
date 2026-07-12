import {
  resolveMarketingEmailProvider,
  sendMarketingEmailViaProvider,
} from '../../../server/emailProviders/index.js'

/** Composite email port — Gmail, Resend, SES, SendGrid behind one interface. */
export function createCompositeEmailAdapter() {
  return {
    provider: 'composite',
    resolveProvider(user, org, campaign) {
      return resolveMarketingEmailProvider(user, org, campaign)
    },
    async send(payload) {
      const provider =
        payload.provider ||
        resolveMarketingEmailProvider(payload.user, payload.org, payload.campaign)
      return sendMarketingEmailViaProvider({ ...payload, provider })
    },
  }
}

export function createEmailAdapter(provider) {
  switch (provider) {
    case 'composite':
    case 'smtp':
    case 'resend':
    case 'gmail':
    case 'ses':
    default:
      return createCompositeEmailAdapter()
  }
}
