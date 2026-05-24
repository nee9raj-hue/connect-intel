export const MAX_EMAIL_ATTACHMENTS = 5
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
export const MAX_TOTAL_ATTACHMENT_BYTES = 12 * 1024 * 1024
export const MAX_SIGNATURE_LENGTH = 4000

export function appendEmailSignature(body, signature) {
  const main = String(body || '').trimEnd()
  const sig = String(signature || '').trim()
  if (!sig) return main
  if (main.includes(sig)) return main
  return `${main}\n\n--\n${sig}`
}

export function sanitizeAttachmentFilename(name) {
  return String(name || 'attachment')
    .replace(/[^\w.\-()+\s]/g, '_')
    .trim()
    .slice(0, 180) || 'attachment'
}

export function validateEmailAttachments(raw = []) {
  if (!Array.isArray(raw) || !raw.length) return []

  if (raw.length > MAX_EMAIL_ATTACHMENTS) {
    throw new Error(`Maximum ${MAX_EMAIL_ATTACHMENTS} attachments per email`)
  }

  const normalized = []
  let totalBytes = 0

  for (const item of raw) {
    const filename = sanitizeAttachmentFilename(item.filename || item.name)
    const mimeType = String(item.mimeType || item.type || 'application/octet-stream').slice(0, 120)
    const contentBase64 = String(item.contentBase64 || item.content || '').replace(/\s/g, '')
    if (!contentBase64) continue

    let buffer
    try {
      buffer = Buffer.from(contentBase64, 'base64')
    } catch {
      throw new Error(`Invalid attachment data for ${filename}`)
    }

    if (!buffer.length) continue
    if (buffer.length > MAX_ATTACHMENT_BYTES) {
      throw new Error(`${filename} exceeds ${MAX_ATTACHMENT_BYTES / (1024 * 1024)}MB limit`)
    }

    totalBytes += buffer.length
    if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
      throw new Error('Total attachment size exceeds 12MB limit')
    }

    normalized.push({
      filename,
      mimeType,
      contentBase64: buffer.toString('base64'),
      sizeBytes: buffer.length,
    })
  }

  return normalized
}

export function attachmentMetadataForRecord(attachments = []) {
  return attachments.map((file) => ({
    filename: file.filename,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
  }))
}
