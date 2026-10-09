import { randomUUID } from 'node:crypto'
import express from 'express'
import {
  analyzeWithGemini,
  answerChatWithGemini,
  answerWithGemini,
  generateScamBaitReply,
  getSynthesizedAnswer,
} from '../services/geminiService.js'
import {
  extractUrlsFromText,
  normalizeUrl,
  unwrapRedirects,
} from '../services/redirectService.js'
import {
  checkSafeBrowsing,
} from '../services/safeBrowsingService.js'
import {
  getSupabaseClient,
  getTrendingThreats,
  getUserPreferences,
  getUserScanHistory,
  logScanToDatabase,
  refreshUserSession,
  saveThreats,
  saveUserPreferences,
  saveUserScan,
  signInWithPassword,
  updateThreatLake,
  verifyAccessToken,
} from '../services/supabaseService.js'
import {
  applyEvidenceFloor,
  detectTyposquatting,
  filterValidHighlights,
} from '../services/threatIntelService.js'
import {
  checkVirusTotal,
} from '../services/virusTotalService.js'
import { parseImage } from '../utils/input.js'
import { logger } from '../utils/logger.js'
import { generateIncidentPDF } from '../utils/pdf.js'
import { decodeQRCode } from '../utils/qr.js'

const router = express.Router()
const recentScans = []
const MAX_HISTORY = 100
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

/**
 * Curated high-fidelity threat samples for SOC simulation.
 */
export const SAMPLES = {
  bank_kyc: {
    title: 'Urgent Bank KYC Freeze',
    type: 'text',
    category: 'Banking Phishing',
    content: `[ALERT] Dear HDFC Bank Customer,\nYour net banking and debit card access has been suspended today due to overdue KYC documentation.\nTo restore access within 24 hours and avoid a permanent penalty fee of Rs 1,500, authenticate your PAN and Aadhaar identity immediately at: https://bit.ly/hdfc-kyc-verify-2024\n\nDo not disclose your 6-digit OTP to anyone unless requested by our automated verification executive calling you now.\n- HDFC Anti-Fraud Department`,
  },
  delivery_scam: {
    title: 'Unpaid Delivery Customs Fee',
    type: 'text',
    category: 'Smishing / Advance-Fee',
    content: `DHL Express: Package #DH-8849201-US has been withheld at local customs due to unpaid import duty of $2.45 USD. Failure to remit payment within 12 hours will result in automatic return of goods to shipper. Clear package here: http://dhl-express-customs.top/pay/trace`,
  },
  ceo_giftcard: {
    title: 'Executive Wire / Gift Card Fraud',
    type: 'text',
    category: 'Business Email Compromise',
    content: `From: CEO <david.miller.office@corp-executive-mail.xyz>\nTo: finance-team@company.internal\nSubject: CONFIDENTIAL: Urgent Vendor Acquisition Request\n\nHi, I am currently boarding an international flight and have limited cellular connection. We need to settle a confidential vendor milestone immediately before end-of-day. Please procure 10x $200 Apple Gift Cards and email the activation codes directly to this address. Mark it under executive petty expense. Do not discuss this with other team members until announced.`,
  },
  legit_notice: {
    title: 'Legitimate Corporate IT Notification',
    type: 'text',
    category: 'Benign / Safe',
    content: `Internal IT Ops Notice: The single sign-on (SSO) gateway will undergo scheduled maintenance this Saturday between 02:00 UTC and 04:00 UTC. No password resets or account updates are required. Contact the internal helpdesk at helpdesk@company.com if you experience login anomalies following the maintenance window.`,
  },
}

export async function requireUser(req, res, next) {
  const authorization = req.get('authorization') || ''
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : authorization.trim()
  if (!accessToken) return res.status(401).json({ error: 'Sign in to use this feature.' })
  try {
    const user = await verifyAccessToken(accessToken)
    if (!user) return res.status(401).json({ error: 'Your session has expired. Please sign in again.' })
    req.userId = user.id
    req.accessToken = accessToken
    return next()
  } catch (error) {
    logger.error('Session verification failed', { error: error?.message })
    return res.status(503).json({ error: 'Authentication is temporarily unavailable.' })
  }
}

async function optionalUser(req, _res, next) {
  const authorization = req.get('authorization') || ''
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : authorization.trim()
  if (accessToken) {
    try {
      const user = await verifyAccessToken(accessToken)
      if (user) {
        req.userId = user.id
        req.accessToken = accessToken
      }
    } catch {
      // Continue anonymous
    }
  }
  return next()
}

function getSubmittedContent(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return ''
  const fields = [body.input, body.text, body.content, body.message, body.url]
  const content = fields.find((value) => typeof value === 'string' && value.trim())
  return typeof content === 'string' ? content.trim().slice(0, 25_000) : ''
}

function riskLevel(score) {
  if (score >= 75) return 'danger'
  if (score >= 40) return 'suspicious'
  return 'safe'
}

function heuristicAnalysis(content, urls, hasImage) {
  const flags = []
  const patterns = [
    {
      pattern: /\b(urgent|immediately|act now|within \d+ hours?|account.{0,20}suspend(?:ed)?|verify now)\b/i,
      type: 'False urgency',
      explanation: 'Pressure to act quickly can prevent careful verification.',
      color: 'yellow',
    },
    {
      pattern: /\b(password|one[- ]time (?:password|passcode)|otp|login credentials|bank details)\b/i,
      type: 'Credential request',
      explanation: 'Requests for passwords, one-time codes, or financial details are sensitive.',
      color: 'red',
    },
    {
      pattern: /\b(send|transfer|pay|wire)\b.{0,45}\b(money|cash|gift cards?|crypto|payment)\b/i,
      type: 'Unusual payment request',
      explanation: 'Unexpected payment instructions should be confirmed through a trusted channel.',
      color: 'yellow',
    },
  ]

  for (const item of patterns) {
    const match = content.match(item.pattern)
    if (match) flags.push({ text_snippet: match[0], text: match[0], ...item })
  }

  for (const url of urls) {
    const typosquat = detectTyposquatting(url)
    if (typosquat) {
      flags.push({
        text_snippet: url,
        text: url,
        type: 'Brand Impersonation / Typosquatting',
        explanation: `This domain deceptively imitates ${typosquat.brand} using lookalike characters.`,
        color: 'red',
      })
    }

    try {
      const parsedHost = (url.includes('://') ? new URL(url).hostname : url.split('/')[0]).toLowerCase()
      if (parsedHost.startsWith('xn--') || parsedHost.includes('.xn--')) {
        flags.push({
          text_snippet: url,
          text: url,
          type: 'Internationalized domain',
          explanation: 'This domain uses encoded characters that can be difficult to distinguish from familiar names.',
          color: 'red',
        })
      } else if (
        /\.(xyz|top|click|work|zip|tk|ml|ga|cf|gq)$/i.test(parsedHost) ||
        /(?:verify|secure|account|login|unoffic|fake|free|gift|claim|update).{0,16}(?:bank|pay|support|service|portal|kyc)/i.test(parsedHost) ||
        /(?:bank|pay|hdfc|sbi|icici|chase|wellsfargo|paypal|apple|google).{0,16}(?:unoffic|login|verify|secure|update|kyc|portal|support)/i.test(parsedHost)
      ) {
        flags.push({
          text_snippet: url,
          text: url,
          type: 'Suspicious domain pattern',
          explanation: 'The domain name imitates a trusted institution or uses keywords associated with deceptive landing pages.',
          color: 'red',
        })
      }
    } catch {
      // Ignore URL parsing errors
    }
  }

  const score = hasImage && !content
    ? 50
    : flags.length
      ? Math.min(90, Math.max(45, flags.reduce((total, flag) => total + (flag.color === 'red' ? 34 : 20), 4)))
      : 4

  return {
    risk_score: hasImage && !content ? 50 : score,
    verdict: score >= 75 ? 'High risk - possible scam' : score >= 40 ? 'Suspicious - verify independently' : 'No strong scam signals detected',
    threat_type: score >= 75 ? 'Credential Phishing / Scam' : score >= 40 ? 'Suspicious Solicitation' : 'Benign / Safe',
    summary: hasImage && !content
      ? 'AI image analysis was unavailable, so this image could not be assessed. Verify carefully before interacting.'
      : score >= 40
        ? 'Some content matches common scam warning signs. Verify the sender and destination independently before taking action.'
        : 'Automated check did not find strong scam warning signs; verify critical requests through official channels.',
    flags,
    inline_highlights: flags.map((f) => ({ text: f.text_snippet, category: f.color, reason: f.explanation })),
    red_flags: flags.map((f) => f.explanation),
    recommended_action: {
      type: score >= 40 ? 'Do not click or share sensitive information' : 'Verify important requests independently',
      abuse_email: 'reportphishing@apwg.org',
      draft_report: 'Report suspicious links or messages to the impersonated organization through its official website.',
    },
    analysis_source: 'heuristic_fallback',
  }
}

function safeParseAIResult(value, fallback) {
  if (!value || typeof value !== 'object') return fallback
  const score = Number(value.risk_score)
  if (!Number.isFinite(score) || typeof value.verdict !== 'string') return fallback

  const flags = Array.isArray(value.flags)
    ? value.flags.slice(0, 15).filter((flag) => flag && (typeof flag.text_snippet === 'string' || typeof flag.text === 'string'))
      .map((flag) => ({
        text_snippet: String(flag.text_snippet || flag.text).slice(0, 500),
        text: String(flag.text || flag.text_snippet).slice(0, 500),
        type: typeof flag.type === 'string' ? flag.type.slice(0, 80) : 'Potential warning sign',
        color: ['red', 'yellow', 'blue'].includes(flag.color || flag.category) ? (flag.color || flag.category) : 'yellow',
        explanation: typeof flag.explanation === 'string' ? flag.explanation.slice(0, 500) : (flag.reason || ''),
      }))
    : fallback.flags

  const highlights = Array.isArray(value.inline_highlights) && value.inline_highlights.length
    ? value.inline_highlights
    : flags.map((f) => ({ text: f.text_snippet, category: f.color, reason: f.explanation }))

  const recommended = value.recommended_action && typeof value.recommended_action === 'object'
    ? value.recommended_action
    : fallback.recommended_action

  return {
    risk_score: Math.max(0, Math.min(100, Math.round(score))),
    verdict: value.verdict.slice(0, 160),
    threat_type: typeof value.threat_type === 'string' ? value.threat_type : fallback.threat_type,
    summary: typeof value.summary === 'string' ? value.summary.slice(0, 1_500) : fallback.summary,
    impersonated_brand: typeof value.impersonated_brand === 'string' ? value.impersonated_brand : null,
    red_flags: Array.isArray(value.red_flags) ? value.red_flags : fallback.red_flags,
    flags,
    inline_highlights: highlights,
    recommended_action: {
      type: typeof recommended.type === 'string' ? recommended.type.slice(0, 160) : fallback.recommended_action.type,
      abuse_email: typeof recommended.abuse_email === 'string' ? recommended.abuse_email.slice(0, 160) : fallback.recommended_action.abuse_email,
      draft_report: typeof recommended.draft_report === 'string' ? recommended.draft_report.slice(0, 1_000) : fallback.recommended_action.draft_report,
    },
    analysis_source: 'gemini',
    _evaluated_by_model: value._evaluated_by_model,
  }
}

export async function runAnalysis(req, res) {
  const startTime = Date.now()
  const body = req.body || {}
  const content = getSubmittedContent(body)
  let image
  try {
    image = parseImage(body.image ?? body.imageBase64, body.mimeType)
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }

  if (!content && !image) {
    return res.status(400).json({ error: 'Provide text, a URL, or an image to analyze.' })
  }
  if (image && image.byteLength > MAX_IMAGE_BYTES) {
    return res.status(413).json({ error: 'Image is too large. Maximum image size is 8 MB.' })
  }

  let qrCode = null
  if (image) {
    try {
      qrCode = await decodeQRCode(image)
    } catch {
      return res.status(400).json({ error: 'The uploaded image could not be decoded. Try a valid PNG, JPEG, WebP, or GIF image.' })
    }
  }

  const analysisContent = [content, qrCode ? `Decoded QR code content: ${qrCode}` : ''].filter(Boolean).join('\n')
  const rawUrls = [...extractUrlsFromText(analysisContent), ...extractUrlsFromText(content)]
  if (qrCode && normalizeUrl(qrCode)) rawUrls.push(qrCode)
  const targetUrls = Array.from(new Set(rawUrls)).slice(0, 6)

  // Unravel redirects step-by-step
  const unwrapReports = await Promise.all(
    targetUrls.map((u) => unwrapRedirects(u, 10)),
  )

  const finalUrls = Array.from(new Set(unwrapReports.map((r) => r.final).filter(Boolean)))
  const allHopUrls = Array.from(new Set([
    ...finalUrls,
    ...unwrapReports.flatMap((r) => r.chain.map((c) => c.url)),
  ]))

  // Security Intelligence Telemetry (VirusTotal + Safe Browsing)
  const [vtResults, sbResult] = await Promise.all([
    Promise.all(unwrapReports.map((report) => checkVirusTotal(report.final))),
    checkSafeBrowsing(allHopUrls.length ? allHopUrls : ['https://empty.test']),
  ])

  // Combine URL reports with security intelligence
  const urlReports = unwrapReports.map((unwrap, idx) => {
    const vt = vtResults[idx]
    const chainUrlSet = new Set([unwrap.final, ...unwrap.chain.map((c) => c.url)])
    const relevantSbMatches = (sbResult.matches || []).filter((m) =>
      chainUrlSet.has(m.url),
    )

    return {
      ...unwrap,
      scanned_url: unwrap.original,
      final_url: unwrap.final,
      virustotal: vt,
      safe_browsing: {
        status: sbResult.status,
        matched: relevantSbMatches.length > 0,
        matches: relevantSbMatches,
      },
      safe_browsing_matches: relevantSbMatches,
    }
  })

  const local = heuristicAnalysis(analysisContent, finalUrls, Boolean(image))
  let analysis = local
  let analysisWarning = null

  try {
    const aiResult = await analyzeWithGemini({
      content: analysisContent,
      image,
      urlReports,
      inputType: image ? (content ? 'image_and_text' : 'image') : (finalUrls.length ? 'url' : 'text'),
    })
    analysis = safeParseAIResult(aiResult, local)
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : null
    analysisWarning = status === 429
      ? 'rate_limited'
      : status === 401 || status === 403
        ? 'authentication_failed'
        : status === 404
          ? 'model_unavailable'
          : status === 400
            ? 'request_rejected'
            : 'provider_unavailable'
    logger.warn(`Gemini analysis unavailable (${analysisWarning}).`)
    analysis = local
  }

  // Enforce technical evidence floor
  analysis.risk_score = applyEvidenceFloor(analysis.risk_score, urlReports)

  // Recalculate verdict and risk level
  analysis.risk_score = Math.max(0, Math.min(100, Math.round(analysis.risk_score)))
  if (analysis.risk_score >= 75) {
    analysis.verdict = 'High risk - possible scam'
    analysis.risk_level = 'danger'
  } else if (analysis.risk_score >= 40) {
    analysis.verdict = 'Suspicious - verify independently'
    analysis.risk_level = 'suspicious'
  } else {
    analysis.verdict = 'No strong scam signals detected'
    analysis.risk_level = 'safe'
  }

  // Filter valid highlights
  analysis.inline_highlights = filterValidHighlights(analysis.inline_highlights, analysisContent)
  analysis.flags = filterValidHighlights(analysis.flags, analysisContent)

  const id = randomUUID()
  const createdAt = new Date().toISOString()
  const domains = finalUrls.map((u) => {
    try { return new URL(u).hostname } catch { return u }
  })

  const executionTimeMs = Date.now() - startTime

  const result = {
    id,
    created_at: createdAt,
    input_type: image ? (content ? 'text_and_image' : 'image') : (finalUrls.length ? 'url_or_message' : 'message'),
    risk_score: analysis.risk_score,
    risk_level: riskLevel(analysis.risk_score),
    verdict: analysis.verdict,
    threat_type: analysis.threat_type || 'Potential Scam / Phishing',
    summary: analysis.summary,
    impersonated_brand: analysis.impersonated_brand,
    red_flags: analysis.red_flags,
    flags: analysis.flags,
    inline_highlights: analysis.inline_highlights,
    qr_code: qrCode ? { decoded: true, content: qrCode } : (image ? { decoded: false } : null),
    recommended_action: analysis.recommended_action,
    urls_inspected: urlReports,
    virustotal_data: urlReports[0]?.virustotal ?? { status: 'no_url_provided' },
    safe_browsing: urlReports[0]?.safe_browsing ?? { status: 'no_url_provided', matched: false },
    analysis_source: analysis.analysis_source,
    dataset_classification: null,
    analysis: {
      risk_score: analysis.risk_score,
      risk_level: analysis.risk_score >= 70 ? 'critical' : analysis.risk_score >= 35 ? 'elevated' : 'low',
      threat_type: analysis.threat_type,
      summary: analysis.summary,
      recommended_action: analysis.recommended_action?.type || 'Exercise caution.',
      impersonated_brand: analysis.impersonated_brand,
      red_flags: analysis.red_flags,
      inline_highlights: analysis.inline_highlights,
    },
    telemetry: {
      input_vector: image ? 'image_base64' : (finalUrls.length ? 'url' : 'text'),
      analyzed_payload_length: analysisContent.length,
      decoded_qr: qrCode,
      urls_inspected: urlReports,
      safe_browsing_status: sbResult.status,
      ai_engine: analysis._evaluated_by_model || 'gemini',
      execution_time_ms: executionTimeMs,
    },
    analyzed_text: analysisContent,
    ...(analysisWarning ? { analysis_warning: analysisWarning } : {}),
  }

  recentScans.unshift({
    id,
    created_at: createdAt,
    domains,
    risk_score: result.risk_score,
    risk_level: result.risk_level,
    verdict: result.verdict,
    summary: result.summary,
  })
  recentScans.length = Math.min(recentScans.length, MAX_HISTORY)

  // Persist to database (Threat Lake & scans)
  try {
    if (domains.length) {
      await saveThreats(domains.map((domain) => ({
        domain,
        risk_score: result.risk_score,
        risk_level: result.risk_level,
      })))
      await updateThreatLake(urlReports, result.risk_score, result.threat_type)
      result.storage_status = 'saved'
    } else {
      result.storage_status = 'not_required'
    }
  } catch (error) {
    logger.warn('Threat persistence failed', { error: error?.message })
    result.storage_status = 'unavailable'
  }

  // Persist user scan
  if (req.userId && req.accessToken) {
    try {
      await saveUserScan(req.accessToken, req.userId, { ...result, domains })
      await logScanToDatabase(result, req.userId)
      result.storage_status = 'saved'
    } catch (error) {
      logger.warn('User scan persistence failed', { error: error?.message })
      result.storage_status = 'unavailable'
    }
  }

  return res.json(result)
}

// ---------------------------------------------------------------------------
// ROUTE DEFINITIONS
// ---------------------------------------------------------------------------

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    services: {
      gemini: Boolean(process.env.GEMINI_API_KEY),
      groq: Boolean(process.env.GROQ_API_KEY),
      virustotal: Boolean(process.env.VIRUSTOTAL_API_KEY),
      safe_browsing: Boolean(process.env.SAFE_BROWSING_API),
      supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
    },
  })
})

router.get('/config', (_req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  })
})

router.get('/samples', (_req, res) => {
  res.json(SAMPLES)
})

router.post('/analyze', requireUser, runAnalysis)
router.post('/scan', optionalUser, runAnalysis)

router.post('/stall-reply', async (req, res) => {
  try {
    const { content, threat_type, impersonated_brand, strategy } = req.body || {}
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Parameter "content" is required to generate a stall reply.' })
    }

    const reply = await generateScamBaitReply({
      content,
      threat_type,
      impersonated_brand,
      strategy,
    })

    return res.json({ reply })
  } catch (err) {
    logger.error('/api/stall-reply error', { error: err.message })
    return res.status(500).json({ error: `Failed to synthesize stall response: ${err.message}` })
  }
})

router.post('/export/pdf', async (req, res) => {
  try {
    const scanData = req.body
    if (!scanData || typeof scanData !== 'object') {
      return res.status(400).json({ error: 'Invalid payload: scan data object is required.' })
    }

    const pdfBuffer = await generateIncidentPDF(scanData)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="sentinel-incident-${Date.now()}.pdf"`)
    res.setHeader('Content-Length', pdfBuffer.length)

    return res.send(pdfBuffer)
  } catch (err) {
    logger.error('/api/export/pdf error', { error: err.message })
    return res.status(500).json({ error: `Failed to generate PDF report: ${err.message}` })
  }
})

router.post('/export/report', requireUser, (req, res) => {
  const result = req.body?.result
  if (!result || typeof result !== 'object' || !Number.isFinite(Number(result.risk_score))) {
    return res.status(400).json({ error: 'Provide a completed scan result to export.' })
  }
  const report = {
    generated_at: new Date().toISOString(),
    risk_score: Math.max(0, Math.min(100, Number(result.risk_score))),
    risk_level: typeof result.risk_level === 'string' ? result.risk_level : 'unknown',
    verdict: typeof result.verdict === 'string' ? result.verdict : '',
    summary: typeof result.summary === 'string' ? result.summary : '',
    flags: Array.isArray(result.flags) ? result.flags : [],
    urls_inspected: Array.isArray(result.urls_inspected) ? result.urls_inspected : [],
    recommended_action: result.recommended_action ?? null,
  }
  res.setHeader('Content-Disposition', 'attachment; filename="shield-incident-report.json"')
  return res.json(report)
})

router.get('/export/history', requireUser, async (req, res) => {
  try {
    const format = req.query.format === 'csv' ? 'csv' : 'json'
    const scans = await getUserScanHistory(req.accessToken)

    if (format === 'csv') {
      const headers = ['id', 'created_at', 'input_type', 'risk_score', 'risk_level', 'verdict', 'summary']
      const csvRows = [headers.join(',')]

      for (const scan of scans) {
        const row = [
          scan.id || '',
          scan.created_at || '',
          scan.input_type || '',
          scan.risk_score || 0,
          scan.risk_level || '',
          `"${String(scan.verdict || '').replace(/"/g, '""')}"`,
          `"${String(scan.summary || '').replace(/"/g, '""')}"`,
        ]
        csvRows.push(row.join(','))
      }

      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename="sentinel-scan-history-${Date.now()}.csv"`)
      return res.send(csvRows.join('\n'))
    }

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="sentinel-scan-history-${Date.now()}.json"`)
    return res.json(scans)
  } catch (err) {
    logger.error('/api/export/history error', { error: err.message })
    return res.status(500).json({ error: 'Failed to export history: ' + err.message })
  }
})

router.get('/threat-lake/trending', async (_req, res) => {
  try {
    const client = getSupabaseClient()
    let threats = []

    if (client) {
      const { data, error } = await client
        .from('threat_lake')
        .select('*')
        .order('incident_count', { ascending: false })
        .limit(10)

      if (!error && Array.isArray(data) && data.length > 0) {
        threats = data
      }
    }

    if (!threats.length) {
      threats = await getTrendingThreats(recentScans)
    }

    const top10 = threats.slice(0, 10)
    return res.json({ threats: top10, rows: top10 })
  } catch (error) {
    logger.error('Threat lake trending query failed', { error: error?.message })
    return res.status(503).json({ error: 'Threat history is temporarily unavailable.' })
  }
})

router.get('/domain-reputation', async (req, res) => {
  const rawDomain = typeof req.query.domain === 'string' ? req.query.domain : ''
  if (rawDomain) {
    const url = normalizeUrl(rawDomain)
    if (!url) return res.status(400).json({ error: 'Provide a valid domain or URL.' })
    const [virustotal, safeBrowsing] = await Promise.all([
      checkVirusTotal(url),
      checkSafeBrowsing(url),
    ])
    return res.json({
      domain: new URL(url).hostname,
      virustotal,
      safe_browsing: safeBrowsing,
    })
  }

  try {
    const threats = await getTrendingThreats(recentScans)
    const totalTracked = threats.length
    const totalIncidents = threats.reduce((sum, t) => sum + (t.incidents || t.incident_count || 1), 0)
    const avgScore = totalTracked ? Math.round(threats.reduce((sum, t) => sum + (t.risk_score || 0), 0) / totalTracked) : 0

    return res.json({
      total_domains_tracked: totalTracked,
      total_incidents: totalIncidents,
      average_risk_score: avgScore,
      top_domains: threats.slice(0, 20),
    })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load domain reputation statistics: ' + err.message })
  }
})

router.post('/chat', optionalUser, async (req, res) => {
  const message = (typeof req.body?.message === 'string'
    ? req.body.message
    : (typeof req.body?.question === 'string' ? req.body.question : '')).trim().slice(0, 4_000)
  const history = Array.isArray(req.body?.history) ? req.body.history : []
  const threatContext = (typeof req.body?.threatContext === 'string'
    ? req.body.threatContext
    : (typeof req.body?.context === 'string' ? req.body.context : '')).trim().slice(0, 8_000)

  if (!message) {
    return res.status(400).json({ error: 'A message or question is required.' })
  }

  try {
    let explanation = ''
    let source = 'gemini'

    if (process.env.GEMINI_API_KEY) {
      try {
        explanation = await answerChatWithGemini({ message, history, threatContext })
        source = 'gemini'
      } catch (geminiError) {
        logger.warn('Gemini chat failed, using fallback explanation', { error: geminiError?.message })
        explanation = getSynthesizedAnswer(message, threatContext)
        source = 'Shield Security Engine'
      }
    } else {
      explanation = getSynthesizedAnswer(message, threatContext)
      source = 'Shield Security Engine'
    }

    return res.json({
      reply: explanation,
      explanation,
      answer: explanation,
      text: explanation,
      source,
      provider: 'Shield AI',
    })
  } catch (error) {
    logger.error('Chat endpoint error', { error: error?.message })
    return res.status(500).json({ error: 'Could not generate cybersecurity explanation: ' + error.message })
  }
})

router.post('/ask', requireUser, async (req, res) => {
  const question = typeof req.body?.question === 'string' ? req.body.question.trim().slice(0, 2_000) : ''
  const context = typeof req.body?.context === 'string' ? req.body.context.trim().slice(0, 4_000) : ''
  if (!question) return res.status(400).json({ error: 'A question is required.' })

  let answer = ''
  let source = 'gemini'

  if (process.env.GEMINI_API_KEY) {
    try {
      answer = await answerWithGemini(question, context)
      source = 'gemini'
    } catch {
      answer = getSynthesizedAnswer(question, context)
      source = 'Shield Security Engine'
    }
  } else {
    answer = getSynthesizedAnswer(question, context)
    source = 'Shield Security Engine'
  }

  return res.json({
    answer,
    reply: answer,
    text: answer,
    source,
    provider: 'Shield AI',
  })
})

router.get('/history', async (req, res) => {
  const authHeader = req.headers.authorization || req.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim()

  if (!token) {
    return res.status(401).json({ error: 'Sign in to use this feature.' })
  }

  let user = null
  try {
    user = await verifyAccessToken(token)
  } catch (err) {
    logger.error('Session verification failed', { error: err?.message })
    return res.status(503).json({ error: 'Authentication is temporarily unavailable.' })
  }

  if (!user || !user.id) {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' })
  }

  try {
    const client = getSupabaseClient()
    let scans = []

    if (client) {
      const { data, error } = await client
        .from('scans')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (!error && Array.isArray(data)) {
        scans = data
      }
    }

    if (!scans.length) {
      try {
        const legacy = await getUserScanHistory(token)
        if (Array.isArray(legacy)) {
          scans = legacy.slice(0, 20)
        }
      } catch {
        // Fallback silently
      }
    }

    return res.json({ scans })
  } catch (error) {
    logger.error('Scan history query failed', { error: error?.message })
    return res.status(503).json({ error: 'Scan history is temporarily unavailable.' })
  }
})

router.get('/preferences', requireUser, async (req, res) => {
  try {
    const preferences = await getUserPreferences(req.accessToken)
    return res.json({ preferences: preferences ?? null })
  } catch (error) {
    logger.error('Preference query failed', { error: error?.message })
    return res.status(503).json({ error: 'Preferences are temporarily unavailable.' })
  }
})

router.put('/preferences', requireUser, async (req, res) => {
  const preferences = req.body?.preferences
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
    return res.status(400).json({ error: 'Preferences must be an object.' })
  }
  try {
    await saveUserPreferences(req.accessToken, req.userId, preferences)
    return res.json({ saved: true })
  } catch (error) {
    logger.error('Preference save failed', { error: error?.message })
    return res.status(503).json({ error: 'Preferences could not be saved.' })
  }
})

router.post('/extension/auth', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().slice(0, 320) : ''
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  if (!email || !password) return res.status(400).json({ error: 'Enter your email and password.' })
  try {
    const session = await signInWithPassword(email, password)
    return res.json(session)
  } catch (error) {
    if (error.status) return res.status(401).json({ error: error.message })
    logger.error('Extension sign-in failed', { error: error?.message })
    return res.status(503).json({ error: 'Sign-in is temporarily unavailable.' })
  }
})

router.post('/extension/refresh', async (req, res) => {
  const refreshToken = typeof req.body?.refresh_token === 'string' ? req.body.refresh_token : ''
  if (!refreshToken) return res.status(400).json({ error: 'A refresh token is required.' })
  try {
    return res.json(await refreshUserSession(refreshToken))
  } catch (error) {
    return res.status(401).json({ error: error.message })
  }
})

router.post('/extension/check', requireUser, (req, res) => {
  const url = typeof req.body?.url === 'string' ? req.body.url : ''
  const signals = req.body?.signals && typeof req.body.signals === 'object' ? req.body.signals : {}
  req.body = {
    input: [
      url,
      signals.passwordForm ? 'The page has a password field.' : '',
      signals.urgency ? 'The page contains urgent language.' : '',
    ].filter(Boolean).join('\n'),
  }
  return runAnalysis(req, res)
})

export default router
