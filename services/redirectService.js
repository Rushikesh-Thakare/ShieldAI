import axios from 'axios'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 SentinelSecurity/2.4'

/**
 * Normalizes user-submitted or extracted URL strings into valid URL instances.
 * @param {string} raw
 * @returns {string|null}
 */
export function normalizeUrl(raw) {
  let urlStr = String(raw || '').trim()
  if (!urlStr) return null

  // Add default protocol if omitted
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(urlStr)) {
    urlStr = 'http://' + urlStr
  }

  try {
    const parsed = new URL(urlStr)
    return parsed.toString()
  } catch {
    return null
  }
}

/**
 * Regex-based URL extractor supporting http(s), www., and common suspicious TLD patterns.
 * @param {string} text
 * @returns {string[]}
 */
export function extractUrlsFromText(text) {
  if (!text || typeof text !== 'string') return []

  const urlPattern =
    /\b((?:https?:\/\/|www\.)[^\s<>"'()]+|(?:[a-zA-Z0-9-]+\.)+(?:com|net|org|io|ly|co|in|xyz|top|info|biz|me|link|app|site|online|ru|cn|tk|ml|ga|cf|gq|to|gl|gd|cc|us|uk|club|vip|live|work|tech)(?:\/[^\s<>"'()]*)?)/gi

  const matches = new Set()
  let match
  while ((match = urlPattern.exec(text)) !== null) {
    const cleaned = match[1].replace(/[.,;:!?]+$/, '')
    matches.add(cleaned)
  }

  return Array.from(matches).slice(0, 8)
}

/**
 * Perform a single HTTP probe without automatic redirect following.
 * @param {string} url
 * @param {'HEAD'|'GET'} method
 */
async function probeHop(url, method = 'HEAD') {
  return axios.request({
    url,
    method,
    maxRedirects: 0,
    timeout: 7000,
    validateStatus: () => true,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    responseType: 'stream',
  })
}

/**
 * Follows redirects step-by-step up to maxHops (default 10) to trace shortened or obfuscated URLs.
 * Returns the complete hop chain, initial URL, and the true final destination.
 *
 * @param {string} initialUrl
 * @param {number} maxHops
 */
export async function unwrapRedirects(initialUrl, maxHops = 10) {
  const normalized = normalizeUrl(initialUrl)
  if (!normalized) {
    return {
      original: initialUrl,
      final: initialUrl,
      chain: [],
      hops: 0,
      redirected: false,
      error: 'Malformed or unparseable URL format',
    }
  }

  const chain = []
  let currentUrl = normalized
  let hasError = null

  for (let hop = 0; hop < maxHops; hop++) {
    let domain = ''
    try {
      domain = new URL(currentUrl).hostname
    } catch {
      domain = currentUrl
    }

    let response
    try {
      response = await probeHop(currentUrl, 'HEAD')
      if (response.status === 405 || response.status === 403 || response.status === 501) {
        response.data?.destroy?.()
        response = await probeHop(currentUrl, 'GET')
      }
    } catch {
      try {
        response = await probeHop(currentUrl, 'GET')
      } catch (err) {
        hasError = `Network lookup failed: ${err.code || err.message}`
        chain.push({ url: currentUrl, status: 0, domain })
        break
      }
    }

    response.data?.destroy?.()

    chain.push({
      url: currentUrl,
      status: response.status,
      domain,
    })

    const isRedirect = response.status >= 300 && response.status < 400
    const location = response.headers?.location

    if (isRedirect && location) {
      try {
        const nextUrl = new URL(location, currentUrl).toString()
        if (nextUrl === currentUrl) {
          break
        }
        currentUrl = nextUrl
        continue
      } catch {
        break
      }
    }

    break
  }

  return {
    original: initialUrl,
    final: currentUrl,
    chain,
    hops: chain.length,
    redirected: chain.length > 1 && currentUrl !== normalized,
    error: hasError,
  }
}
