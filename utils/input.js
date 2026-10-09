const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"'`]+|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?:\/[^\s<>"'`]*)?/gi
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

export function extractUrls(text) {
  if (typeof text !== 'string') return []
  const found = text.match(URL_PATTERN) ?? []
  return [...new Set(found.map((value) => value.replace(/[),.;!?]+$/, '')))].filter(Boolean)
}

export function normalizeUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null
  let candidate = value.trim()
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(candidate)) candidate = `https://${candidate}`

  try {
    const parsed = new URL(candidate)
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) return null
    return parsed.toString()
  } catch {
    return null
  }
}

export function parseImage(rawImage, mimeType) {
  if (rawImage == null || rawImage === '') return null
  if (typeof rawImage !== 'string') throw new Error('Image must be provided as a base64 string.')
  const match = rawImage.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i)
  const data = match ? match[2].replace(/\s/g, '') : rawImage.replace(/\s/g, '')
  const type = (match?.[1] || mimeType || 'image/png').toLowerCase()

  if (!ALLOWED_IMAGE_TYPES.has(type)) {
    throw new Error('Image type must be PNG, JPEG, WebP, or GIF.')
  }
  if (!data || !/^[a-z0-9+/]*={0,2}$/i.test(data) || data.length % 4 === 1) {
    throw new Error('Image must be valid base64 data.')
  }
  const buffer = Buffer.from(data, 'base64')
  if (!buffer.length || buffer.toString('base64').replace(/=+$/, '') !== data.replace(/=+$/, '')) {
    throw new Error('Image must be valid base64 data.')
  }

  return { data, mimeType: type, byteLength: buffer.byteLength }
}
