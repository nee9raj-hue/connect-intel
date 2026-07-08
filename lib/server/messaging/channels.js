/** Future channel adapters (WhatsApp, SMS, LinkedIn messaging). */
export const MESSAGING_CHANNEL_STATUS = {
  email: 'live',
  whatsapp: 'planned',
  sms: 'planned',
  linkedin: 'planned',
}

export function isMessagingChannelLive(channel) {
  return MESSAGING_CHANNEL_STATUS[channel] === 'live'
}
