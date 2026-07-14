/**
 * S3-compatible object storage (AWS S3, Cloudflare R2, MinIO, Supabase S3).
 * Uses Signature V4 over fetch — no AWS SDK in the dependency tree.
 */

import crypto from 'node:crypto'

function cleanEnv(name) {
  const raw = process.env[name]
  if (!raw) return ''
  return String(raw).trim().replace(/^["']|["']$/g, '')
}

function envTruthy(name, fallback = false) {
  const v = cleanEnv(name).toLowerCase()
  if (!v) return fallback
  return v === '1' || v === 'true' || v === 'yes'
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex')
}

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest()
}

function signingKey(secret, dateStamp, region, service) {
  const kDate = hmac(`AWS4${secret}`, dateStamp)
  const kRegion = hmac(kDate, region)
  const kService = hmac(kRegion, service)
  return hmac(kService, 'aws4_request')
}

function safeKey(key) {
  return String(key || '')
    .replace(/\.\./g, '')
    .replace(/^\/+/, '')
}

function encodeS3Key(key) {
  return safeKey(key)
    .split('/')
    .map((part) =>
      encodeURIComponent(part).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    )
    .join('/')
}

export function resolveS3CompatibleConfig(provider = 's3') {
  const id = String(provider || 's3').toLowerCase()
  const bucket =
    cleanEnv('STORAGE_BUCKET') ||
    cleanEnv('S3_BUCKET') ||
    cleanEnv('AWS_S3_BUCKET') ||
    cleanEnv('R2_BUCKET') ||
    cleanEnv('MINIO_BUCKET')

  const accessKeyId =
    cleanEnv('STORAGE_ACCESS_KEY_ID') ||
    cleanEnv('AWS_ACCESS_KEY_ID') ||
    cleanEnv('R2_ACCESS_KEY_ID') ||
    cleanEnv('MINIO_ACCESS_KEY')

  const secretAccessKey =
    cleanEnv('STORAGE_SECRET_ACCESS_KEY') ||
    cleanEnv('AWS_SECRET_ACCESS_KEY') ||
    cleanEnv('R2_SECRET_ACCESS_KEY') ||
    cleanEnv('MINIO_SECRET_KEY')

  let region =
    cleanEnv('STORAGE_REGION') ||
    cleanEnv('AWS_REGION') ||
    cleanEnv('AWS_DEFAULT_REGION') ||
    cleanEnv('R2_REGION') ||
    ''

  let endpoint =
    cleanEnv('STORAGE_ENDPOINT') ||
    cleanEnv('S3_ENDPOINT') ||
    cleanEnv('AWS_ENDPOINT_URL_S3') ||
    cleanEnv('R2_ENDPOINT') ||
    cleanEnv('MINIO_ENDPOINT') ||
    ''

  if (id === 'r2' && !endpoint) {
    const accountId = cleanEnv('R2_ACCOUNT_ID') || cleanEnv('CLOUDFLARE_ACCOUNT_ID')
    if (accountId) endpoint = `https://${accountId}.r2.cloudflarestorage.com`
  }

  if (id === 'supabase-storage' && !endpoint) {
    const supabaseUrl = cleanEnv('SUPABASE_URL').replace(/\/$/, '')
    if (supabaseUrl) endpoint = `${supabaseUrl}/storage/v1/s3`
  }

  if (id === 'r2' && !region) region = 'auto'
  if (!region) region = 'us-east-1'

  const forcePathStyle = envTruthy(
    'STORAGE_FORCE_PATH_STYLE',
    id === 'r2' || id === 'minio' || id === 'supabase-storage' || Boolean(endpoint)
  )

  const publicBaseUrl =
    cleanEnv('STORAGE_PUBLIC_BASE_URL') ||
    cleanEnv('R2_PUBLIC_BASE_URL') ||
    cleanEnv('S3_PUBLIC_BASE_URL') ||
    ''

  return {
    provider: id,
    bucket,
    accessKeyId,
    secretAccessKey,
    region,
    endpoint: endpoint.replace(/\/$/, ''),
    forcePathStyle,
    publicBaseUrl: publicBaseUrl.replace(/\/$/, ''),
  }
}

export function isS3CompatibleConfigured(config) {
  return Boolean(config?.bucket && config?.accessKeyId && config?.secretAccessKey)
}

function buildObjectUrl(config, key) {
  const pathKey = encodeS3Key(key)
  if (config.endpoint) {
    const host = new URL(config.endpoint).host
    if (config.forcePathStyle) {
      return {
        url: `${config.endpoint}/${config.bucket}/${pathKey}`,
        host,
        canonicalUri: `/${config.bucket}/${pathKey}`,
      }
    }
    return {
      url: `${config.endpoint.replace(`://${host}`, `://${config.bucket}.${host}`)}/${pathKey}`,
      host: `${config.bucket}.${host}`,
      canonicalUri: `/${pathKey}`,
    }
  }

  if (config.forcePathStyle) {
    const host = `s3.${config.region}.amazonaws.com`
    return {
      url: `https://${host}/${config.bucket}/${pathKey}`,
      host,
      canonicalUri: `/${config.bucket}/${pathKey}`,
    }
  }

  const host = `${config.bucket}.s3.${config.region}.amazonaws.com`
  return {
    url: `https://${host}/${pathKey}`,
    host,
    canonicalUri: `/${pathKey}`,
  }
}

function buildListUrl(config) {
  const canonicalQuery = 'list-type=2&max-keys=0'
  if (config.endpoint && config.forcePathStyle) {
    const u = new URL(config.endpoint)
    return {
      url: `${config.endpoint}/${config.bucket}?${canonicalQuery}`,
      host: u.host,
      canonicalUri: `/${config.bucket}`,
      canonicalQuery,
    }
  }
  if (config.endpoint) {
    const u = new URL(config.endpoint)
    const host = `${config.bucket}.${u.host}`
    return {
      url: `${config.endpoint.replace(`://${u.host}`, `://${host}`)}?${canonicalQuery}`,
      host,
      canonicalUri: '/',
      canonicalQuery,
    }
  }
  if (config.forcePathStyle) {
    const host = `s3.${config.region}.amazonaws.com`
    return {
      url: `https://${host}/${config.bucket}?${canonicalQuery}`,
      host,
      canonicalUri: `/${config.bucket}`,
      canonicalQuery,
    }
  }
  const host = `${config.bucket}.s3.${config.region}.amazonaws.com`
  return {
    url: `https://${host}?${canonicalQuery}`,
    host,
    canonicalUri: '/',
    canonicalQuery,
  }
}

function publicUrlFor(config, key) {
  const safe = safeKey(key)
  if (config.publicBaseUrl) return `${config.publicBaseUrl}/${safe}`
  return buildObjectUrl(config, safe).url
}

async function signedFetch(config, { method, key, body, contentType, extraHeaders = {} }) {
  if (!isS3CompatibleConfigured(config)) {
    throw new Error(
      `Storage (${config.provider}) is not configured. Set STORAGE_BUCKET, STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY (and STORAGE_ENDPOINT for R2/MinIO).`
    )
  }

  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  const payloadHash = sha256Hex(body || '')
  const { url, host, canonicalUri } = buildObjectUrl(config, key)

  const headers = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    ...extraHeaders,
  }
  if (contentType) headers['content-type'] = contentType

  const signedHeaderKeys = Object.keys(headers)
    .map((h) => h.toLowerCase())
    .sort()
  const canonicalHeaders = signedHeaderKeys.map((h) => `${h}:${String(headers[h]).trim()}\n`).join('')
  const signedHeaders = signedHeaderKeys.join(';')

  const canonicalRequest = [method, canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n')
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256Hex(canonicalRequest)].join('\n')
  const signature = crypto
    .createHmac('sha256', signingKey(config.secretAccessKey, dateStamp, config.region, 's3'))
    .update(stringToSign, 'utf8')
    .digest('hex')

  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  const requestHeaders = {
    Authorization: authorization,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    ...extraHeaders,
  }
  if (contentType) requestHeaders['Content-Type'] = contentType

  const res = await fetch(url, {
    method,
    headers: requestHeaders,
    body: body && method !== 'GET' && method !== 'HEAD' ? body : undefined,
  })

  return { res, url }
}

export function createS3CompatibleStorageAdapter(provider = 's3', configOverrides = {}) {
  const config = { ...resolveS3CompatibleConfig(provider), ...configOverrides }
  const id = config.provider || provider

  return {
    provider: id,
    configured: isS3CompatibleConfigured(config),
    getConfig() {
      return {
        provider: id,
        bucket: config.bucket || null,
        region: config.region,
        endpoint: config.endpoint || null,
        forcePathStyle: config.forcePathStyle,
        publicBaseUrl: config.publicBaseUrl || null,
        configured: isS3CompatibleConfigured(config),
      }
    },
    async put(key, data, { contentType = 'application/octet-stream' } = {}) {
      const safe = safeKey(key)
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
      const { res } = await signedFetch(config, {
        method: 'PUT',
        key: safe,
        body: buf,
        contentType,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Storage put failed (${res.status}): ${text.slice(0, 300) || res.statusText}`)
      }
      return {
        url: publicUrlFor(config, safe),
        key: safe,
        contentType,
        bytes: buf.length,
      }
    },
    async get(key) {
      const safe = safeKey(key)
      const { res } = await signedFetch(config, { method: 'GET', key: safe, body: '' })
      if (res.status === 404) return null
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Storage get failed (${res.status}): ${text.slice(0, 300) || res.statusText}`)
      }
      return Buffer.from(await res.arrayBuffer())
    },
    async delete(key) {
      const safe = safeKey(key)
      const { res } = await signedFetch(config, { method: 'DELETE', key: safe, body: '' })
      if (res.status === 404 || res.ok) return
      const text = await res.text().catch(() => '')
      throw new Error(`Storage delete failed (${res.status}): ${text.slice(0, 300) || res.statusText}`)
    },
    async exists(key) {
      const safe = safeKey(key)
      const { res } = await signedFetch(config, { method: 'HEAD', key: safe, body: '' })
      if (res.status === 404) return false
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Storage head failed (${res.status}): ${text.slice(0, 300) || res.statusText}`)
      }
      return true
    },
    getPublicUrl(key) {
      return publicUrlFor(config, safeKey(key))
    },
    async ping() {
      if (!isS3CompatibleConfigured(config)) {
        return { ok: false, configured: false, error: 'not_configured' }
      }
      try {
        const { url, host, canonicalUri, canonicalQuery } = buildListUrl(config)
        const now = new Date()
        const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
        const dateStamp = amzDate.slice(0, 8)
        const payloadHash = sha256Hex('')
        const headers = {
          host,
          'x-amz-content-sha256': payloadHash,
          'x-amz-date': amzDate,
        }
        const signedHeaderKeys = Object.keys(headers).sort()
        const canonicalHeaders = signedHeaderKeys.map((h) => `${h}:${headers[h]}\n`).join('')
        const signedHeaders = signedHeaderKeys.join(';')
        const canonicalRequest = [
          'GET',
          canonicalUri,
          canonicalQuery,
          canonicalHeaders,
          signedHeaders,
          payloadHash,
        ].join('\n')
        const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`
        const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256Hex(canonicalRequest)].join(
          '\n'
        )
        const signature = crypto
          .createHmac('sha256', signingKey(config.secretAccessKey, dateStamp, config.region, 's3'))
          .update(stringToSign, 'utf8')
          .digest('hex')
        const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

        const res = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: authorization,
            'x-amz-content-sha256': payloadHash,
            'x-amz-date': amzDate,
          },
        })
        if (res.ok) return { ok: true, configured: true, provider: id }
        // List may be denied while put/get still work.
        if (res.status === 403) return { ok: true, configured: true, provider: id, note: 'list_forbidden' }
        const text = await res.text().catch(() => '')
        return { ok: false, configured: true, error: text.slice(0, 200) || res.statusText }
      } catch (error) {
        return { ok: false, configured: true, error: error?.message || String(error) }
      }
    },
  }
}
