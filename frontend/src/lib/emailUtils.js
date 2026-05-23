export function leadHasSendableEmail(lead) {
  const email = String(lead?.email || '').trim()
  return email.includes('@') && !email.includes('•')
}

export function leadDisplayName(lead) {
  return [lead?.firstName, lead?.lastName].filter(Boolean).join(' ') || lead?.company || 'Lead'
}
