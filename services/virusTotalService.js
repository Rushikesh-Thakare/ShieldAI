import axios from 'axios'
import { logger } from '../utils/logger.js'

const VT_BASE_URL = 'https://www.virustotal.com/api/v3'
export const CACHE_TTL_MS = 60 * 60 * 1000 // 1-hour expiration

/**
 * In-memory Map cache implementation for VirusTotal rate limit compliance.
 * Maximum size: 500 entries to prevent memory bloat.
 * TTL: 1 hour (60 * 60 * 1000 ms) — results rarely change within that window.
 */
export class LRUCache extends Map {
  constructor(maxSize = 500, ttlMs = CACHE_TTL_MS) {
    super()
    this.maxSize = maxSize
    this.ttlMs = ttlMs
  }

  get(key) {
    const entry = super.get(key)
    if (!entry) return null

    if (Date.now() - entry.timestamp > this.ttlMs) {
      super.delete(key)
      return null
    }

    super.delete(key)
    super.set(key, entry)
    return entry.data
  }

  set(key, data) {
    if (this.size >= this.maxSize) {
      const firstKey = this.keys().next().value
      if (firstKey !== undefined) {
        super.delete(firstKey)
      }
    }

    super.set(key, {
      data,
      timestamp: Date.now(),
    })
    return this
  }

  has(key) {
    const entry = super.get(key)
    if (!entry) return false
    if (Date.now() - entry.timestamp > this.ttlMs) {
      super.delete(key)
      return false
    }
    return true
  }

  clear() {
    super.clear()
  }
}

export const vtCache = new LRUCache(500, CACHE_TTL_MS)
export const urlCache = vtCache

/**
 * Computes VirusTotal URL identifier according to VT v3 specifications:
 * Base64 URL-safe encoding without '=' padding.
 * @param {string} url
 * @returns {string}
 */
export function getVTUrlIdentifier(url) {
  return Buffer.from(url)
    .toString('base64url')
}

/**
 * Queries the VirusTotal v3 API for the given URL.
 * Automatically handles 404 by submitting for real-time analysis.
 *
 * @param {string} url
 */
export async function queryVirusTotal(url) {
  const id = getVTUrlIdentifier(url)

  const cached = vtCache.get(url) || vtCache.get(id)
  if (cached) {
    logger.debug(`VT Cache HIT for ${url.slice(0, 60)}...`)
    return cached
  }

  const apiKey = process.env.VIRUSTOTAL_API_KEY
  if (!apiKey) {
    return {
      status: 'disabled',
      malicious: 0,
      malicious_votes: 0,
      suspicious: 0,
      suspicious_votes: 0,
      harmless: 0,
      harmless_votes: 0,
      undetected: 0,
      total_engines: 0,
      votes: { harmless: 0, malicious: 0 },
      reputation: 0,
      categories: {},
      message: 'VIRUSTOTAL_API_KEY is not configured in environment',
    }
  }

  const headers = { 'x-apikey': apiKey, accept: 'application/json' }

  try {
    const { data } = await axios.get(`${VT_BASE_URL}/urls/${id}`, {
      headers,
      timeout: 10000,
    })

    const attributes = data?.data?.attributes || {}
    const stats = attributes.last_analysis_stats || {}
    const malicious = Number(stats.malicious) || 0
    const suspicious = Number(stats.suspicious) || 0
    const harmless = Number(stats.harmless) || 0
    const undetected = Number(stats.undetected) || 0
    const total_engines = malicious + suspicious + harmless + undetected

    const result = {
      status: 'analyzed',
      malicious,
      malicious_votes: malicious,
      suspicious,
      suspicious_votes: suspicious,
      harmless,
      harmless_votes: harmless,
      undetected,
      total_engines,
      votes: attributes.total_votes || { harmless: 0, malicious: 0 },
      reputation: attributes.reputation ?? 0,
      categories: attributes.categories || {},
      permalink: `https://www.virustotal.com/gui/url/${id}`,
      last_analysis_date: attributes.last_analysis_date
        ? new Date(attributes.last_analysis_date * 1000).toISOString()
        : null,
    }

    vtCache.set(url, result)
    vtCache.set(id, result)
    logger.debug(`VT Cache MISS -> cached ${url.slice(0, 60)}... (${vtCache.size} entries)`)

    return result
  } catch (err) {
    if (err.response?.status === 404) {
      try {
        await axios.post(
          `${VT_BASE_URL}/urls`,
          new URLSearchParams({ url }).toString(),
          {
            headers: {
              ...headers,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout: 8000,
          },
        )
      } catch {
        // Submission failure is non-fatal
      }

      return {
        status: 'queued',
        malicious: 0,
        malicious_votes: 0,
        suspicious: 0,
        suspicious_votes: 0,
        harmless: 0,
        harmless_votes: 0,
        undetected: 0,
        total_engines: 0,
        votes: { harmless: 0, malicious: 0 },
        reputation: 0,
        categories: {},
        permalink: `https://www.virustotal.com/gui/url/${id}`,
        message: 'First-time sighting: URL submitted to VirusTotal queue for engine analysis.',
      }
    }

    return {
      status: 'error',
      malicious: 0,
      malicious_votes: 0,
      suspicious: 0,
      suspicious_votes: 0,
      harmless: 0,
      harmless_votes: 0,
      undetected: 0,
      total_engines: 0,
      votes: { harmless: 0, malicious: 0 },
      reputation: 0,
      categories: {},
      message: err.response?.data?.error?.message || err.message,
    }
  }
}

/**
 * Normalizes VirusTotal analysis response.
 *
 * @param {string} rawUrl
 * @returns {Promise<object>}
 */
export async function checkVirusTotal(rawUrl) {
  const result = await queryVirusTotal(rawUrl)
  return {
    status: result.status === 'analyzed' ? 'checked' : result.status,
    malicious_votes: result.malicious_votes ?? result.malicious ?? 0,
    suspicious_votes: result.suspicious_votes ?? result.suspicious ?? 0,
    harmless_votes: result.harmless_votes ?? result.harmless ?? 0,
    total_engines: result.total_engines ?? 0,
    reputation: result.reputation ?? 0,
    malicious: result.malicious ?? 0,
    suspicious: result.suspicious ?? 0,
    harmless: result.harmless ?? 0,
    permalink: result.permalink,
  }
}
