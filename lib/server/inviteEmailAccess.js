/** Used in OAuth state for platform operators (no customer org required). */
export const PLATFORM_OAUTH_ORG_ID = 'platform'

export function resolveOAuthOrganizationId(user, store) {
  if (user.organizationId) return user.organizationId
  if (user.role === 'admin') return PLATFORM_OAUTH_ORG_ID

  const orgs = store?.organizations || []
  const withToken = orgs.find((o) => o.inviteGmailOAuth?.refreshToken)
  if (withToken) return withToken.id

  const company = orgs.find((o) => o.accountType === 'company')
  if (company) return company.id

  return orgs[0]?.id || null
}

export function canManageInviteEmail(user) {
  return Boolean(user?.isOrgAdmin || user?.role === 'admin')
}
