/** Same secret as session JWT so OAuth state survives across serverless invocations. */
export function getOAuthStateSecret() {
  const secret =
    process.env.SESSION_SECRET ||
    process.env.APOLLO_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    'connect-intel-dev-only-secret'
  return String(secret)
}
