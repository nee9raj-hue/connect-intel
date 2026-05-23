export function applyCors(req, res) {
  const origin = req.headers.origin || '*'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

export function handleOptions(req, res) {
  applyCors(req, res)
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return true
  }
  return false
}

export function sendJson(res, status, payload) {
  res.status(status).json(payload)
}

export function methodNotAllowed(res, methods) {
  res.setHeader('Allow', methods.join(', '))
  sendJson(res, 405, { error: 'Method not allowed' })
}

export function getBody(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }
  return req.body
}

