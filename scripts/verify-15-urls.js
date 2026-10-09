const testUrls = [
  // 5 Real / Legitimate URLs
  { category: 'Real / Legitimate', url: 'https://www.google.com' },
  { category: 'Real / Legitimate', url: 'https://github.com' },
  { category: 'Real / Legitimate', url: 'https://www.microsoft.com' },
  { category: 'Real / Legitimate', url: 'https://en.wikipedia.org' },
  { category: 'Real / Legitimate', url: 'https://www.apple.com' },

  // 5 Suspicious URLs
  { category: 'Suspicious', url: 'http://dhl-express-customs.top/pay/trace' },
  { category: 'Suspicious', url: 'https://secure-account-verify.xyz' },
  { category: 'Suspicious', url: 'https://claim-giftcard-bonus.click' },
  { category: 'Suspicious', url: 'http://short.ly/a8k2' },
  { category: 'Suspicious', url: 'http://track-package-update.work' },

  // 5 Direct Threat URLs
  { category: 'Direct Threat', url: 'https://fakebank-login.com' },
  { category: 'Direct Threat', url: 'https://hdfcbankunofficil.in' },
  { category: 'Direct Threat', url: 'https://paypal-security-verification.xyz/login' },
  { category: 'Direct Threat', url: 'http://appleid-support-auth.com' },
  { category: 'Direct Threat', url: 'https://chase-urgent-verify.top/auth' },
]

async function runBenchmark() {
  console.log('='.repeat(80))
  console.log('Starting 15 URL Security Benchmark Analysis (ML Classifier Removed)...')
  console.log('='.repeat(80))

  const results = []

  for (let i = 0; i < testUrls.length; i++) {
    const item = testUrls[i]
    console.log(`\n[${i + 1}/15] [${item.category}] Scanning: ${item.url}`)
    const startTime = Date.now()

    try {
      const response = await fetch('http://localhost:3000/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: item.url }),
      })

      if (!response.ok) {
        const errText = await response.text()
        console.error(`  ❌ HTTP ${response.status}: ${errText}`)
        results.push({
          index: i + 1,
          category: item.category,
          url: item.url,
          status: `HTTP ${response.status}`,
          riskScore: 'ERR',
          verdict: 'Error',
          threatType: 'N/A',
          summary: errText,
          duration: `${Date.now() - startTime}ms`,
        })
        continue
      }

      const data = await response.json()
      const riskScore = data.risk_score
      const riskLevel = data.risk_level
      const verdict = data.verdict
      const threatType = data.threat_type || data.analysis?.threat_type || 'Unknown'
      const summary = data.summary || data.analysis?.summary || ''
      const brand = data.impersonated_brand || data.analysis?.impersonated_brand || 'None'
      const duration = `${Date.now() - startTime}ms`

      console.log(`  Verdict: ${verdict} | Risk Score: ${riskScore}/100 (${riskLevel})`)
      console.log(`  Threat Type: ${threatType} | Brand: ${brand}`)
      console.log(`  Summary: ${summary.slice(0, 100)}...`)
      console.log(`  Scan Time: ${duration}`)

      results.push({
        index: i + 1,
        category: item.category,
        url: item.url,
        riskScore,
        riskLevel,
        verdict,
        threatType,
        brand,
        summary,
        duration,
      })
    } catch (err) {
      console.error(`  ❌ Fetch error: ${err.message}`)
      results.push({
        index: i + 1,
        category: item.category,
        url: item.url,
        status: 'Network Error',
        riskScore: 'ERR',
        verdict: err.message,
        threatType: 'N/A',
        duration: `${Date.now() - startTime}ms`,
      })
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('SUMMARY BENCHMARK REPORT TABLE')
  console.log('='.repeat(80))
  console.table(
    results.map((r) => ({
      '#': r.index,
      Category: r.category,
      URL: r.url,
      'Risk Score': `${r.riskScore}/100`,
      Verdict: r.verdict,
      'Threat Type': r.threatType,
      'Time': r.duration,
    }))
  )
}

runBenchmark()
