import { checkVirusTotal } from './virusTotalService.js'
import { checkSafeBrowsing } from './safeBrowsingService.js'
import { logScanToDatabase, updateThreatLake } from './supabaseService.js'

export { checkVirusTotal, checkSafeBrowsing }

/**
 * Detects lookalike / typosquatting domains (e.g. rnicrosoft.com, arnazon.com, goog1e.com, paypa1.com).
 *
 * @param {string} domainOrUrl
 * @returns {object|null}
 */
export function detectTyposquatting(domainOrUrl) {
  if (!domainOrUrl) return null
  let hostname = String(domainOrUrl).toLowerCase().trim()
  try {
    if (hostname.includes('://')) {
      hostname = new URL(hostname).hostname
    } else {
      hostname = hostname.split('/')[0].split('?')[0]
    }
  } catch {
    // proceed with string
  }

  const clean = hostname.replace(/^(?:https?:\/\/)?(?:www\.)+/, '')
  const domainPart = clean.split('.')[0]

  const knownBrands = [
    { brand: 'Microsoft', regex: /^(?:rnicrosoft|micros0ft|microsft|rnicosoft|micosoft|micro-soft|micro-login)/i },
    { brand: 'Google', regex: /^(?:goog1e|googel|g00gle|g0ogle|gooogle|google-verify|google-auth)/i },
    { brand: 'Apple', regex: /^(?:app1e|appl-id|apple-id-verify|apple-support-auth)/i },
    { brand: 'Amazon', regex: /^(?:arnazon|amaz0n|amzon|amazon-order-verify|amazon-pay-update)/i },
    { brand: 'PayPal', regex: /^(?:paypa1|paypa-l|paypal-verify|paypal-security|pay-pal)/i },
    { brand: 'Netflix', regex: /^(?:netf1ix|netfllx|netflix-billing|netflix-verify)/i },
    { brand: 'Facebook', regex: /^(?:faceb00k|faceb0k|facebook-security-check)/i },
    { brand: 'Instagram', regex: /^(?:instagrarn|1nstagram|instagram-copyright)/i },
    { brand: 'HDFC Bank', regex: /^(?:hdfcbankunoffic|hdfc-kyc|hdfc-verify|hdfc-login)/i },
    { brand: 'SBI Bank', regex: /^(?:sbi-kyc|sbicard-verify|onlinesbi-portal)/i },
  ]

  for (const item of knownBrands) {
    if (item.regex.test(domainPart)) {
      return {
        isTyposquat: true,
        brand: item.brand,
        domainPart,
        hostname,
      }
    }
  }

  // General 'rn' -> 'm' substitution check (e.g. rnicrosoft, arnazon, instagrarn)
  const normalizedM = domainPart.replace(/rn/g, 'm')
  const majorBrands = ['microsoft', 'amazon', 'instagram', 'walmart', 'mastercard', 'americanexpress']
  for (const b of majorBrands) {
    if (normalizedM === b && domainPart !== b) {
      return {
        isTyposquat: true,
        brand: b.charAt(0).toUpperCase() + b.slice(1),
        domainPart,
        hostname,
      }
    }
  }

  return null
}

/**
 * Enforces technical evidence floors so known malicious URLs, Safe Browsing hits,
 * or typosquatted brand lookalike domains cannot be downplayed.
 *
 * @param {number} rawScore - AI model calculated score
 * @param {Array} urlReports - Telemetry reports
 * @returns {number} Hardened score
 */
export function applyEvidenceFloor(rawScore, urlReports = []) {
  let hardened = rawScore

  for (const report of urlReports) {
    const targetUrl = report.final || report.original || report.scanned_url || ''
    const typosquat = detectTyposquatting(targetUrl)

    if (typosquat) {
      hardened = Math.max(hardened, 95)
    }

    const vt = report.virustotal || {}
    const maliciousCount = vt.malicious ?? vt.malicious_votes ?? 0
    const suspiciousCount = vt.suspicious ?? vt.suspicious_votes ?? 0
    const sbMatches = report.safe_browsing_matches || (report.safe_browsing?.matched ? [{ threatType: 'MALWARE' }] : [])

    // Safe browsing match is an immediate high/critical indicator
    if (sbMatches.length > 0) {
      hardened = Math.max(hardened, 92)
    }

    // VirusTotal engine thresholds
    const harmlessCount = vt.harmless_votes ?? vt.harmless ?? 0
    if (maliciousCount >= 4) {
      hardened = Math.max(hardened, 95)
    } else if (maliciousCount >= 2) {
      hardened = Math.max(hardened, 85)
    } else if (maliciousCount === 1) {
      // If majority engines (50+) verify domain is harmless, avoid false alarm
      if (harmlessCount < 40) {
        hardened = Math.max(hardened, 50)
      }
    } else if (suspiciousCount >= 3) {
      hardened = Math.max(hardened, 50)
    }
  }

  return Math.min(100, Math.max(0, hardened))
}

/**
 * Sanitizes and validates inline highlights against the actual source text.
 * Drops any hallucinated substring that doesn't exist verbatim in the text.
 *
 * @param {Array} rawHighlights
 * @param {string} sourceText
 * @returns {Array}
 */
export function filterValidHighlights(rawHighlights, sourceText) {
  if (!Array.isArray(rawHighlights) || !sourceText) return []

  const validCategories = new Set(['yellow', 'red', 'blue'])

  return rawHighlights
    .filter((h) => {
      const txt = h?.text || h?.text_snippet
      return (
        typeof txt === 'string' &&
        txt.trim().length > 0 &&
        sourceText.includes(txt)
      )
    })
    .map((h) => {
      const text = h.text || h.text_snippet
      const category = validCategories.has(h.category)
        ? h.category
        : (validCategories.has(h.color) ? h.color : 'yellow')
      return {
        text,
        text_snippet: text,
        category,
        color: category,
        reason: h.reason || h.explanation || 'Threat indicator detected.',
        explanation: h.reason || h.explanation || 'Threat indicator detected.',
        type: h.type || (category === 'red' ? 'Critical threat signal' : category === 'yellow' ? 'Urgency pressure' : 'Social engineering'),
      }
    })
}


/**
 * Executes a scan pipeline and persists findings.
 * Calls logScanToDatabase and updateThreatLake at the end of processScan().
 *
 * @param {object|string} scanInput - Raw text, object payload, or evaluated scan data
 * @param {string|null} userId - Optional user ID
 * @returns {Promise<object>} Completed scan data
 */
export async function processScan(scanInput, userId = null) {
  let scanData

  if (scanInput && typeof scanInput === 'object' && ('risk_score' in scanInput || 'verdict' in scanInput)) {
    scanData = { ...scanInput }
  } else {
    const text = typeof scanInput === 'string'
      ? scanInput
      : (scanInput?.content || scanInput?.input || scanInput?.text || '')
    const urlReports = scanInput?.urlReports || scanInput?.urls_inspected || []
    let typosquat = detectTyposquatting(text)
    if (!typosquat && urlReports.length > 0) {
      for (const rep of urlReports) {
        const u = typeof rep === 'string' ? rep : (rep.final || rep.final_url || rep.original || rep.scanned_url || rep.url)
        if (u) {
          typosquat = detectTyposquatting(u)
          if (typosquat) break
        }
      }
    }
    let score = typosquat ? 95 : 10
    score = applyEvidenceFloor(score, urlReports)
    const risk = score >= 75 ? 'danger' : score >= 40 ? 'suspicious' : 'safe'

    scanData = {
      id: scanInput?.id || `scan-${Date.now()}`,
      created_at: new Date().toISOString(),
      analyzed_text: text,
      risk_score: score,
      risk_level: risk,
      verdict: typosquat ? 'Brand Impersonation Detected' : (score >= 75 ? 'High risk - possible scam' : 'Content evaluated'),
      threat_type: typosquat ? 'Typosquatting / Brand Impersonation' : (scanInput?.threat_type || 'General Threat Analysis'),
      summary: typosquat ? `Domain mimics ${typosquat.brand}` : 'Threat evaluation completed.',
      urls_inspected: urlReports,
      telemetry: { input_vector: scanInput?.input_vector || 'text' },
      ...scanInput,
    }
  }

  const urlReports = scanData.urls_inspected || scanData.urls || []
  const threatType = scanData.threat_type || 'Unknown Threat'
  const riskScore = scanData.risk_score ?? 0

  // Call logScanToDatabase and updateThreatLake at the end of processScan()
  try {
    await logScanToDatabase(scanData, userId)
  } catch {
    // Gracefully handle persistence failure
  }

  try {
    if (urlReports.length > 0) {
      await updateThreatLake(urlReports, threatType, riskScore)
    }
  } catch {
    // Gracefully handle persistence failure
  }

  return scanData
}

