/** Parse comma/semicolon-separated emails for To/Cc fields. */
export function parseEmailList(raw) {
  if (!raw) return []
  const seen = new Set()
  const out = []
  for (const part of String(raw).split(/[,;]+/)) {
    const email = part.trim().toLowerCase()
    if (!email.includes('@')) continue
    if (seen.has(email)) continue
    seen.add(email)
    out.push(email)
  }
  return out.slice(0, 20)
}
