import { createClient } from '@supabase/supabase-js'
import { logger } from '../utils/logger.js'

function configured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)
}

function headers() {
  const key = process.env.SUPABASE_ANON_KEY
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }
}

export const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    })
  : null

let currentClientKey = ''
let supabaseClientInstance = null

export function getSupabaseClient() {
  const url = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY

  if (!url || !anonKey || url.includes('your_supabase')) {
    return null
  }

  const key = `${url}::${anonKey}`
  if (supabaseClientInstance && currentClientKey === key) {
    return supabaseClientInstance
  }

  currentClientKey = key
  supabaseClientInstance = createClient(url, anonKey, {
    auth: { persistSession: false },
  })
  return supabaseClientInstance
}

export async function saveThreats(threats) {
  const safeThreats = threats.filter((item) =>
    typeof item.domain === 'string'
    && item.domain.length <= 253
    && Number.isInteger(item.risk_score)
    && item.risk_score >= 0
    && item.risk_score <= 100,
  )
  if (!safeThreats.length) return

  if (!configured()) return
  const baseUrl = process.env.SUPABASE_URL.replace(/\/+$/, '')
  await Promise.allSettled(safeThreats.map(async (item) => {
    const response = await fetch(`${baseUrl}/rest/v1/threat_scans`, {
      method: 'POST',
      headers: { ...headers(), Prefer: 'return=minimal' },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        domain: item.domain.toLowerCase(),
        risk_score: item.risk_score,
        risk_level: item.risk_level,
      }),
    })
    if (!response.ok) throw new Error(`Supabase insert failed with status ${response.status}.`)
  }))
}

function aggregateThreatRows(rows) {
  const grouped = new Map()
  for (const row of rows) {
    if (typeof row.domain !== 'string') continue
    const current = grouped.get(row.domain) ?? {
      domain: row.domain,
      incidents: 0,
      incident_count: 0,
      risk_score: 0,
      latest_risk_score: 0,
      risk_level: 'safe',
      last_seen: row.created_at || row.last_seen_at || null,
      last_seen_at: row.created_at || row.last_seen_at || null,
    }
    current.incidents += 1
    current.incident_count += 1
    current.risk_score = Math.max(current.risk_score, Number(row.risk_score || row.latest_risk_score) || 0)
    current.latest_risk_score = current.risk_score
    current.risk_level = current.risk_score >= 75 ? 'danger' : current.risk_score >= 40 ? 'suspicious' : 'safe'
    const ts = row.created_at || row.last_seen_at
    if (ts && (!current.last_seen || ts > current.last_seen)) {
      current.last_seen = ts
      current.last_seen_at = ts
    }
    grouped.set(row.domain, current)
  }
  return [...grouped.values()].sort((a, b) => b.incidents - a.incidents || b.risk_score - a.risk_score).slice(0, 20)
}

export async function getTrendingThreats(recentScans = []) {
  if (configured()) {
    const client = getSupabaseClient()
    if (client) {
      try {
        const { data: lakeData, error: lakeErr } = await client
          .from('threat_lake')
          .select('domain, incident_count, latest_risk_score, last_seen_at, threat_types')
          .order('incident_count', { ascending: false, nullsLast: true })
          .limit(10)

        if (!lakeErr && lakeData?.length) {
          return lakeData.map((row) => ({
            domain: row.domain,
            incidents: row.incident_count,
            incident_count: row.incident_count,
            risk_score: row.latest_risk_score ?? 50,
            latest_risk_score: row.latest_risk_score ?? 50,
            risk_level: (row.latest_risk_score || 0) >= 70 ? 'danger' : (row.latest_risk_score || 0) >= 35 ? 'suspicious' : 'safe',
            last_seen: row.last_seen_at,
            last_seen_at: row.last_seen_at,
            threat_types: row.threat_types || [],
          }))
        }
      } catch {
        // Fallback to threat_scans table
      }
    }

    try {
      const baseUrl = process.env.SUPABASE_URL.replace(/\/+$/, '')
      const query = new URLSearchParams({
        select: 'domain,risk_score,created_at',
        order: 'created_at.desc',
        limit: '1000',
      })
      const response = await fetch(`${baseUrl}/rest/v1/threat_scans?${query}`, {
        headers: headers(),
        signal: AbortSignal.timeout(10_000),
      })
      if (response.ok) {
        const rows = await response.json()
        if (rows.length) return aggregateThreatRows(rows)
      }
    } catch {
      // Fallback to in-memory scans
    }
  }

  const rows = []
  for (const scan of recentScans) {
    for (const domain of scan.domains ?? []) {
      rows.push({ domain, risk_score: scan.risk_score, created_at: scan.created_at })
    }
  }
  return aggregateThreatRows(rows)
}

function userHeaders(accessToken) {
  return {
    apikey: process.env.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
}

export async function verifyAccessToken(accessToken) {
  if (!configured()) throw new Error('Supabase authentication is not configured.')
  const baseUrl = process.env.SUPABASE_URL.replace(/\/+$/, '')
  const response = await fetch(`${baseUrl}/auth/v1/user`, {
    headers: userHeaders(accessToken),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) return null
  const user = await response.json()
  return typeof user.id === 'string' ? user : null
}

export async function signInWithPassword(email, password) {
  if (!configured()) throw new Error('Supabase authentication is not configured.')
  const baseUrl = process.env.SUPABASE_URL.replace(/\/+$/, '')
  const response = await fetch(`${baseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({ email, password }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(typeof payload.msg === 'string' ? payload.msg : 'Email or password was not accepted.')
    error.status = response.status
    throw error
  }
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_at: payload.expires_at,
    user: { id: payload.user?.id, email: payload.user?.email },
  }
}

export async function refreshUserSession(refreshToken) {
  if (!configured()) throw new Error('Supabase authentication is not configured.')
  const baseUrl = process.env.SUPABASE_URL.replace(/\/+$/, '')
  const response = await fetch(`${baseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error('Extension session expired. Sign in to reconnect.')
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_at: payload.expires_at,
    user: { id: payload.user?.id, email: payload.user?.email },
  }
}

export async function saveUserScan(accessToken, userId, scan) {
  if (!configured()) throw new Error('Supabase persistence is not configured.')
  const baseUrl = process.env.SUPABASE_URL.replace(/\/+$/, '')
  const response = await fetch(`${baseUrl}/rest/v1/scan_history`, {
    method: 'POST',
    headers: { ...userHeaders(accessToken), Prefer: 'return=minimal' },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({
      user_id: userId,
      input_type: scan.input_type,
      risk_score: scan.risk_score,
      risk_level: scan.risk_level,
      verdict: scan.verdict,
      summary: scan.summary,
      domains: scan.domains,
      flags: scan.flags,
    }),
  })
  if (!response.ok) throw new Error(`Supabase scan save failed with status ${response.status}.`)
}

export async function getUserScanHistory(accessToken) {
  if (!configured()) throw new Error('Supabase persistence is not configured.')
  const baseUrl = process.env.SUPABASE_URL.replace(/\/+$/, '')
  const query = new URLSearchParams({
    select: 'id,created_at,input_type,risk_score,risk_level,verdict,summary,domains,flags',
    order: 'created_at.desc',
    limit: '100',
  })
  const response = await fetch(`${baseUrl}/rest/v1/scan_history?${query}`, {
    headers: userHeaders(accessToken),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`Supabase history query failed with status ${response.status}.`)
  return response.json()
}

export async function getUserPreferences(accessToken) {
  if (!configured()) throw new Error('Supabase persistence is not configured.')
  const baseUrl = process.env.SUPABASE_URL.replace(/\/+$/, '')
  const response = await fetch(`${baseUrl}/rest/v1/user_preferences?select=preferences&limit=1`, {
    headers: userHeaders(accessToken),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`Supabase preference query failed with status ${response.status}.`)
  const rows = await response.json()
  return rows[0]?.preferences
}

export async function saveUserPreferences(accessToken, userId, preferences) {
  if (!configured()) throw new Error('Supabase persistence is not configured.')
  const baseUrl = process.env.SUPABASE_URL.replace(/\/+$/, '')
  const response = await fetch(`${baseUrl}/rest/v1/user_preferences`, {
    method: 'POST',
    headers: {
      ...userHeaders(accessToken),
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({ user_id: userId, preferences }),
  })
  if (!response.ok) throw new Error(`Supabase preference save failed with status ${response.status}.`)
}

/**
 * Logs a completed scan result to the `scans` table.
 *
 * @param {object} scanData - Scan result or analysis payload
 * @param {string|null} userId - Optional authenticated user ID
 * @returns {Promise<{success: boolean, id?: string, data?: object, error?: string}>}
 */
export async function logScanToDatabase(scanData, userId = null) {
  const client = getSupabaseClient()
  if (!client) return { success: false, error: 'Supabase credentials not configured' }

  try {
    const analysis = scanData?.analysis || scanData || {}
    const telemetry = scanData?.telemetry || {}

    const record = {
      user_id: userId || scanData?.user_id || null,
      input_vector: telemetry.input_vector || scanData?.input_vector || scanData?.input_type || 'text',
      risk_score: typeof scanData?.risk_score === 'number'
        ? scanData.risk_score
        : (typeof analysis.risk_score === 'number' ? analysis.risk_score : 0),
      risk_level: scanData?.risk_level || analysis.risk_level || (scanData?.risk_score >= 75 ? 'danger' : scanData?.risk_score >= 40 ? 'suspicious' : 'safe'),
      verdict: scanData?.verdict || analysis.verdict || 'Scan completed',
      threat_type: scanData?.threat_type || analysis.threat_type || 'Unknown Threat',
      summary: scanData?.summary || analysis.summary || '',
      impersonated_brand: scanData?.impersonated_brand || analysis.impersonated_brand || null,
      red_flags: Array.isArray(scanData?.red_flags) ? scanData.red_flags : (Array.isArray(analysis.red_flags) ? analysis.red_flags : []),
      flags: Array.isArray(scanData?.flags) ? scanData.flags : [],
      inline_highlights: Array.isArray(scanData?.inline_highlights) ? scanData.inline_highlights : (Array.isArray(analysis.inline_highlights) ? analysis.inline_highlights : []),
      telemetry,
      analyzed_text: String(scanData?.analyzed_text || scanData?.content || scanData?.input || '').slice(0, 10000),
    }

    const { data, error } = await client
      .from('scans')
      .insert(record)
      .select('id')
      .maybeSingle()

    if (error) {
      logger.warn('Failed to log scan to database', { error: error.message })
      return { success: false, error: error.message }
    }

    return { success: true, id: data?.id, data }
  } catch (err) {
    logger.warn('logScanToDatabase exception', { error: err.message })
    return { success: false, error: err.message }
  }
}

/**
 * Upserts inspected URLs into the `threat_lake` table, extracting destination hostnames,
 * incrementing incident_count, and updating highest_risk_score.
 *
 * @param {Array} urlReports - Inspected URL report objects or raw URLs
 * @param {string|null} threatType - Classified threat category (e.g. "Credential Phishing")
 * @param {number|null} riskScore - Numeric risk score (0 to 100)
 * @returns {Promise<{success: boolean, upserted: number, error?: string}>}
 */
export async function updateThreatLake(urlReports = [], threatType = null, riskScore = null) {
  // Support both (urlReports, threatType, riskScore) and (urlReports, riskScore, threatType)
  let actualThreatType = threatType
  let actualRiskScore = riskScore
  if (typeof threatType === 'number' && (typeof riskScore === 'string' || riskScore === null)) {
    actualRiskScore = threatType
    actualThreatType = riskScore
  }

  const client = getSupabaseClient()
  if (!client) return { success: false, upserted: 0, error: 'Supabase credentials not configured' }

  const rawList = Array.isArray(urlReports) ? urlReports : [urlReports]
  const destinationHostnames = new Map()

  for (const item of rawList) {
    if (!item) continue
    const targetUrl = typeof item === 'string'
      ? item
      : (item.final || item.final_url || item.original || item.scanned_url || item.url)

    if (targetUrl && typeof targetUrl === 'string' && targetUrl.trim().length > 0) {
      let hostname = ''
      try {
        hostname = new URL(targetUrl.includes('://') ? targetUrl : `https://${targetUrl}`).hostname
      } catch {
        hostname = String(targetUrl).split('/')[0].split('?')[0]
      }
      hostname = hostname.toLowerCase().trim()
      if (hostname && !destinationHostnames.has(hostname)) {
        destinationHostnames.set(hostname, targetUrl)
      }
    }
  }

  if (destinationHostnames.size === 0) return { success: true, upserted: 0 }

  let upsertedCount = 0
  const scoreNum = actualRiskScore !== null && actualRiskScore !== undefined ? Number(actualRiskScore) : 0

  try {
    for (const [hostname, sampleUrl] of destinationHostnames) {
      const { data: existing, error: selectErr } = await client
        .from('threat_lake')
        .select('*')
        .or(`domain.eq.${hostname},url.eq.${sampleUrl}`)
        .maybeSingle()

      if (selectErr && selectErr.code !== 'PGRST116') {
        logger.warn('threat_lake select warning', { error: selectErr.message })
      }

      if (existing) {
        const newIncidentCount = (Number(existing.incident_count) || 0) + 1
        const currentHighest = Number(existing.highest_risk_score ?? existing.risk_score ?? 0)
        const updatedHighest = Math.max(currentHighest, scoreNum)

        const existingTypes = Array.isArray(existing.threat_types) ? [...existing.threat_types] : []
        if (actualThreatType && !existingTypes.includes(actualThreatType)) {
          existingTypes.push(actualThreatType)
        }

        const { error: updateErr } = await client
          .from('threat_lake')
          .update({
            incident_count: newIncidentCount,
            highest_risk_score: updatedHighest,
            latest_risk_score: scoreNum,
            threat_types: existingTypes,
            last_seen_at: new Date().toISOString(),
          })
          .eq('id', existing.id)

        if (!updateErr) upsertedCount++
      } else {
        const { error: insertErr } = await client
          .from('threat_lake')
          .insert({
            domain: hostname,
            url: sampleUrl,
            incident_count: 1,
            highest_risk_score: scoreNum,
            latest_risk_score: scoreNum,
            threat_types: actualThreatType ? [actualThreatType] : [],
            first_seen_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
          })

        if (!insertErr) upsertedCount++
      }
    }

    return { success: true, upserted: upsertedCount }
  } catch (err) {
    logger.warn('updateThreatLake exception', { error: err.message })
    return { success: false, upserted: upsertedCount, error: err.message }
  }
}
