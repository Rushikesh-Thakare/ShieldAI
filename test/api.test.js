import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { Jimp } from 'jimp'
import { decodeQRCode } from '../services/qrService.js'
import { parseImage } from '../utils/input.js'

process.env.GEMINI_API_KEY = ''
process.env.GROQ_API_KEY = ''
process.env.VIRUSTOTAL_API_KEY = ''
process.env.SAFE_BROWSING_API = ''
process.env.SUPABASE_URL = ''
process.env.SUPABASE_ANON_KEY = ''

const { default: app } = await import('../server.js')
let server
let baseUrl

before(async () => {
  server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

test('health reports configuration without exposing secrets', async () => {
  const response = await fetch(`${baseUrl}/api/health`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    status: 'ok',
    services: { gemini: false, groq: false, virustotal: false, safe_browsing: false, supabase: false },
  })
})

test('private account analysis requires a signed-in user', async () => {
  const response = await fetch(`${baseUrl}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: 'Urgent: verify now or your account will be suspended.' }),
  })
  assert.equal(response.status, 401)
  assert.match((await response.json()).error, /Sign in/)
})

test('extension endpoint requires a signed-in user', async () => {
  const response = await fetch(`${baseUrl}/api/extension/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://secure-account-verify.xyz' }),
  })
  assert.equal(response.status, 401)
  assert.match((await response.json()).error, /Sign in/)
})

test('authenticated extension URL checks evaluate live threat intelligence', async () => {
  const originalFetch = globalThis.fetch
  const originalSupabaseUrl = process.env.SUPABASE_URL
  const originalSupabaseKey = process.env.SUPABASE_ANON_KEY
  process.env.SUPABASE_URL = 'https://unit-test.supabase.co'
  process.env.SUPABASE_ANON_KEY = 'unit-test-key'
  globalThis.fetch = async (input) => {
    const url = String(input)
    if (url.endsWith('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'test-user-id' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (url.includes('/rest/v1/threat_scans') || url.includes('/rest/v1/scan_history')) {
      return new Response(null, { status: 201 })
    }
    throw new Error(`Unexpected upstream request: ${new URL(url).hostname}`)
  }

  try {
    const response = await originalFetch(`${baseUrl}/api/extension/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-access-token',
      },
      body: JSON.stringify({ url: 'https://secure-login-account-verify.example.xyz' }),
    })
    assert.equal(response.status, 200)
    const result = await response.json()
    assert.ok(typeof result.risk_score === 'number')
    assert.ok(result.verdict)
  } finally {
    globalThis.fetch = originalFetch
    if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL
    else process.env.SUPABASE_URL = originalSupabaseUrl
    if (originalSupabaseKey === undefined) delete process.env.SUPABASE_ANON_KEY
    else process.env.SUPABASE_ANON_KEY = originalSupabaseKey
  }
})

test('private account history and preferences require sign-in', async () => {
  const history = await fetch(`${baseUrl}/api/history`)
  const preferences = await fetch(`${baseUrl}/api/preferences`)
  assert.equal(history.status, 401)
  assert.equal(preferences.status, 401)
  assert.match((await history.json()).error, /Sign in/)
  assert.match((await preferences.json()).error, /Sign in/)
})

test('Ask Shield requires sign-in', async () => {
  const response = await fetch(`${baseUrl}/api/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'Is this message safe?', provider: 'groq' }),
  })
  assert.equal(response.status, 401)
  assert.match((await response.json()).error, /Sign in/)
})

test('image parser rejects unsupported formats', () => {
  assert.throws(() => parseImage('aGVsbG8=', 'text/plain'), /Image type must be/)
})

test('QR service decodes a valid image without a QR code', async () => {
  const image = await new Jimp({ width: 2, height: 2, color: 0xffffffff }).getBuffer('image/png')
  const parsed = parseImage(image.toString('base64'), 'image/png')
  assert.equal(await decodeQRCode(parsed), null)
})

test('unknown API paths return JSON 404', async () => {
  const response = await fetch(`${baseUrl}/api/unknown`)
  assert.equal(response.status, 404)
  assert.deepEqual(await response.json(), { error: 'API endpoint not found.' })
})

test('samples returns curated SOC simulation scenarios', async () => {
  const response = await fetch(`${baseUrl}/api/samples`)
  assert.equal(response.status, 200)
  const samples = await response.json()
  assert.ok(samples.bank_kyc)
  assert.ok(samples.delivery_scam)
  assert.ok(samples.ceo_giftcard)
  assert.ok(samples.legit_notice)
})

test('export PDF generates binary PDF document from scan data', async () => {
  const sampleScan = {
    id: 'test-scan-uuid',
    risk_score: 88,
    risk_level: 'danger',
    verdict: 'High risk - possible scam',
    summary: 'Detected credential harvesting on fake bank portal.',
    flags: [{ text_snippet: 'verify now', type: 'False urgency', color: 'yellow', explanation: 'Urgent pressure' }],
    urls_inspected: [{ original: 'http://bit.ly/fake-bank', final: 'https://fake-bank-login.xyz', hops: 2 }],
  }
  const response = await fetch(`${baseUrl}/api/export/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sampleScan),
  })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'application/pdf')
  const buffer = await response.arrayBuffer()
  assert.ok(buffer.byteLength > 500)
})

test('domain reputation endpoint returns valid statistics or domain info', async () => {
  const response = await fetch(`${baseUrl}/api/domain-reputation`)
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.ok('total_domains_tracked' in data)
  assert.ok('average_risk_score' in data)
})

test('anonymous scan performs inspection without requiring auth token', async () => {
  const response = await fetch(`${baseUrl}/api/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: 'Urgent: update your net banking account now at http://fakebank-verify.xyz' }),
  })
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.ok(result.id)
  assert.ok(typeof result.risk_score === 'number')
  assert.ok(result.verdict)
  assert.ok(result.analysis)
  assert.ok(result.telemetry)
})

test('stall-reply validates payload and requires content', async () => {
  const response = await fetch(`${baseUrl}/api/stall-reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  assert.equal(response.status, 400)
  assert.match((await response.json()).error, /Parameter "content" is required/)
})

test('CORS is enabled for http://localhost:5173', async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: 'http://localhost:5173' },
  })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173')
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true')
})

test('Gemini MODEL_CANDIDATES strictly uses gemini-2.0-flash and gemini-1.5-flash', async () => {
  const { MODEL_CANDIDATES } = await import('../services/geminiService.js')
  assert.deepEqual(MODEL_CANDIDATES, ['gemini-2.0-flash', 'gemini-1.5-flash'])
})

test('VirusTotal cache is an in-memory Map with 1-hour expiration', async () => {
  const { vtCache, LRUCache, queryVirusTotal } = await import('../services/virusTotalService.js')
  assert.ok(vtCache instanceof Map, 'vtCache should be an instance of Map')

  const testUrl = 'https://example-test-cache-entry.com'
  const mockResult = { status: 'analyzed', malicious: 0, test_cached: true }

  vtCache.set(testUrl, mockResult)
  assert.equal(vtCache.has(testUrl), true)
  assert.deepEqual(vtCache.get(testUrl), mockResult)

  const queried = await queryVirusTotal(testUrl)
  assert.deepEqual(queried, mockResult)

  // Verify expiration logic
  const shortCache = new LRUCache(10, 50) // 50ms TTL
  shortCache.set('temp', { ok: true })
  assert.ok(shortCache.get('temp'))
  await new Promise((resolve) => setTimeout(resolve, 60))
  assert.equal(shortCache.get('temp'), null)
  assert.equal(shortCache.has('temp'), false)
})

test('threat-lake trending returns top trending threats', async () => {
  const response = await fetch(`${baseUrl}/api/threat-lake/trending`)
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.ok(Array.isArray(data.threats))
  assert.ok(data.threats.length <= 10)
})

test('chat endpoint accepts message, history, and threatContext', async () => {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Why was this banking URL flagged?',
      history: [{ role: 'user', content: 'Hello' }],
      threatContext: 'Domain fake-bank.xyz flagged for credential harvesting',
    }),
  })
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.ok(result.reply || result.explanation || result.answer)
})

test('threatIntelService processScan executes pipeline and invokes database hooks', async () => {
  const { processScan } = await import('../services/threatIntelService.js')
  const result = await processScan({
    content: 'Urgent: update credentials at http://rnicrosoft.com/login',
    urls_inspected: [{ original: 'http://rnicrosoft.com/login', final: 'http://rnicrosoft.com/login' }],
  }, 'test-user')

  assert.ok(result.risk_score >= 75)
  assert.equal(result.threat_type, 'Typosquatting / Brand Impersonation')
})

test('supabaseService exports logScanToDatabase and updateThreatLake', async () => {
  const { logScanToDatabase, updateThreatLake } = await import('../services/supabaseService.js')
  assert.equal(typeof logScanToDatabase, 'function')
  assert.equal(typeof updateThreatLake, 'function')

  const logRes = await logScanToDatabase({ risk_score: 90, verdict: 'Phishing' })
  assert.equal(typeof logRes, 'object')

  const lakeRes = await updateThreatLake([{ final: 'https://evil-phish.xyz/login' }], 'Phishing', 95)
  assert.equal(typeof lakeRes, 'object')
})


