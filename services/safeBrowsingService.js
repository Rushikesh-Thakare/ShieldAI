import axios from 'axios'

const SAFE_BROWSING_URL = 'https://safebrowsing.googleapis.com/v4/threatMatches:find'

/**
 * Checks a list of URLs against the Google Safe Browsing Lookup API v4.
 *
 * @param {string[]|string} urls
 * @returns {Promise<{ status: string, matched: boolean, matches: Array<{ url: string, threatType: string, platformType: string }>, message?: string }>}
 */
export async function querySafeBrowsing(urls) {
  const apiKey = process.env.SAFE_BROWSING_API
  if (!apiKey) {
    return {
      status: 'disabled',
      matched: false,
      matches: [],
      message: 'SAFE_BROWSING_API is not configured in environment',
    }
  }

  const validUrls = (Array.isArray(urls) ? urls : [urls])
    .filter(Boolean)
    .filter((u) => typeof u === 'string' && u.trim().length > 0)

  if (validUrls.length === 0) {
    return { status: 'skipped', matched: false, matches: [] }
  }

  try {
    const payload = {
      client: {
        clientId: 'sentinel-shield-platform',
        clientVersion: '3.0.0',
      },
      threatInfo: {
        threatTypes: [
          'MALWARE',
          'SOCIAL_ENGINEERING',
          'UNWANTED_SOFTWARE',
          'POTENTIALLY_HARMFUL_APPLICATION',
        ],
        platformTypes: ['ANY_PLATFORM'],
        threatEntryTypes: ['URL'],
        threatEntries: validUrls.map((url) => ({ url })),
      },
    }

    const { data } = await axios.post(
      `${SAFE_BROWSING_URL}?key=${encodeURIComponent(apiKey)}`,
      payload,
      { timeout: 8000 },
    )

    const matches = (data?.matches || []).map((m) => ({
      url: m.threat?.url,
      threatType: m.threatType,
      platformType: m.platformType,
    }))

    return {
      status: 'analyzed',
      matched: matches.length > 0,
      matches,
    }
  } catch (err) {
    return {
      status: 'error',
      matched: false,
      matches: [],
      message: err.response?.data?.error?.message || err.message,
    }
  }
}

/**
 * Checks URL(s) and formats normalized Safe Browsing report.
 *
 * @param {string|string[]} rawUrl
 * @returns {Promise<object>}
 */
export async function checkSafeBrowsing(rawUrl) {
  const urls = Array.isArray(rawUrl) ? rawUrl : [rawUrl]
  const result = await querySafeBrowsing(urls)
  const match = result.matches?.[0]
  if (match) {
    return {
      status: 'checked',
      matched: true,
      threat_type: match.threatType || 'MALWARE',
      platform_type: match.platformType || 'ANY_PLATFORM',
      matches: result.matches,
    }
  }
  return {
    status: result.status === 'analyzed' ? 'checked' : result.status,
    matched: false,
    matches: [],
  }
}
