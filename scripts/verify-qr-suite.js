import 'dotenv/config'
import QRCode from 'qrcode'
import { decodeQRCode } from '../services/qrService.js'
import { analyzeWithGemini } from '../services/geminiService.js'
import { unwrapRedirects } from '../services/redirectService.js'
import { applyEvidenceFloor, checkSafeBrowsing, checkVirusTotal, detectTyposquatting } from '../services/threatIntelService.js'

/**
 * QR Code Verification Suite
 * Tests decoding, URL unwrapping, and threat detection across multiple QR scenarios.
 */

const QR_TEST_CASES = [
  // --- 1. LEGITIMATE / SAFE QR CODES ---
  {
    category: 'Legitimate / Safe QR',
    title: '1. Official Microsoft Portal QR',
    payload: 'https://login.microsoftonline.com',
    expectedTier: 'safe',
    maxScore: 15,
  },
  {
    category: 'Legitimate / Safe QR',
    title: '2. Official Google Help Center QR',
    payload: 'https://support.google.com/accounts/answer/46526',
    expectedTier: 'safe',
    maxScore: 15,
  },
  {
    category: 'Legitimate / Safe QR',
    title: '3. Digital Restaurant Menu QR',
    payload: 'https://bistromenu.example.com/daily-specials',
    expectedTier: 'safe',
    maxScore: 15,
  },

  // --- 2. MILDLY SUSPICIOUS QR CODES ---
  {
    category: 'Mildly Suspicious QR',
    title: '4. Unverified Promotional Survey QR',
    payload: 'https://customer-rewards-survey.click/claim?user=8491',
    expectedTier: 'suspicious',
    minScore: 30,
    maxScore: 70,
  },
  {
    category: 'Mildly Suspicious QR',
    title: '5. Unsolicited Discount Voucher QR',
    payload: 'https://exclusive-deal-pass.link/special-offer',
    expectedTier: 'suspicious',
    minScore: 30,
    maxScore: 70,
  },

  // --- 3. HIGH THREAT PHISHING / TYPOSQUATTING QR CODES ---
  {
    category: 'High Threat Phishing QR',
    title: '6. Urgent HDFC Bank KYC Scam QR',
    payload: 'https://bit.ly/hdfc-kyc-verify-2024',
    expectedTier: 'danger',
    minScore: 75,
  },
  {
    category: 'High Threat Phishing QR',
    title: '7. Microsoft Brand Typosquatting QR (www.rnicrosoft.com)',
    payload: 'https://www.rnicrosoft.com/login/auth',
    expectedTier: 'danger',
    minScore: 75,
  },
  {
    category: 'High Threat Phishing QR',
    title: '8. DHL Customs Duty Smishing QR',
    payload: 'http://dhl-express-customs.top/pay/trace',
    expectedTier: 'danger',
    minScore: 75,
  },
]

async function runQrVerificationSuite() {
  console.log('================================================================================')
  console.log('📱 SHIELD AI — COMPREHENSIVE QR CODE SCANNING & DECODING SUITE')
  console.log('================================================================================\n')

  let passed = 0
  let failed = 0

  for (let i = 0; i < QR_TEST_CASES.length; i++) {
    const test = QR_TEST_CASES[i]
    console.log(`[QR TEST ${i + 1}/${QR_TEST_CASES.length}] [${test.category}] ${test.title}`)
    console.log(`  🔗 Encoded Payload: ${test.payload}`)

    // 1. Generate real PNG QR code buffer
    const qrBuffer = await QRCode.toBuffer(test.payload, {
      type: 'png',
      width: 400,
      margin: 2,
      errorCorrectionLevel: 'H',
    })

    const imageObj = {
      data: qrBuffer.toString('base64'),
      mimeType: 'image/png',
      byteLength: qrBuffer.length,
    }

    try {
      // 2. Test jsQR Decoder Engine
      const decodedUrl = await decodeQRCode(imageObj)

      if (!decodedUrl || decodedUrl !== test.payload) {
        console.log(`  ❌ DECODE FAILED! Got: "${decodedUrl}", Expected: "${test.payload}"`)
        failed++
        continue
      }
      console.log(`  ✅ QR Decoder successfully read matrix: "${decodedUrl}"`)

      // 3. Test Redirect Unwrapping & Threat Intelligence
      const unwrap = await unwrapRedirects(decodedUrl, 5)
      const targetUrl = unwrap.final || decodedUrl
      const typosquat = detectTyposquatting(targetUrl)

      const [vt, sb] = await Promise.all([
        checkVirusTotal(targetUrl),
        checkSafeBrowsing([targetUrl]),
      ])

      const urlReport = {
        ...unwrap,
        scanned_url: unwrap.original,
        final_url: unwrap.final,
        virustotal: vt,
        safe_browsing: sb,
      }

      const aiResponse = await analyzeWithGemini({
        content: `Decoded QR code target URL: ${targetUrl}`,
        image: imageObj,
        urlReports: [urlReport],
        inputType: 'qr_and_image',
      })

      let finalScore = applyEvidenceFloor(aiResponse.risk_score ?? 0, [urlReport])
      if (typosquat) finalScore = Math.max(finalScore, 95)

      const level = finalScore >= 75 ? 'danger' : (finalScore >= 40 ? 'suspicious' : 'safe')

      let testPassed = false
      if (test.expectedTier === 'safe') {
        testPassed = finalScore <= (test.maxScore ?? 20)
      } else if (test.expectedTier === 'suspicious') {
        testPassed = finalScore >= (test.minScore ?? 30) && finalScore <= (test.maxScore ?? 74)
      } else if (test.expectedTier === 'danger') {
        testPassed = finalScore >= (test.minScore ?? 75)
      }

      if (testPassed) {
        passed++
        console.log(`  ✅ PASSED: Risk Score=${finalScore}/100 (${level.toUpperCase()}) | ThreatType="${aiResponse.threat_type || 'N/A'}"`)
      } else {
        failed++
        console.log(`  ❌ FAILED: Risk Score=${finalScore}/100 (Expected: ${test.expectedTier}) | ThreatType="${aiResponse.threat_type || 'N/A'}"`)
      }
    } catch (err) {
      failed++
      console.log(`  ❌ ERROR during QR test: ${err.message}`)
    }

    console.log('--------------------------------------------------------------------------------')
    await new Promise((r) => setTimeout(r, 1200))
  }

  console.log('\n================================================================================')
  console.log(`📊 QR SUITE RESULTS: ${passed}/${QR_TEST_CASES.length} Tests Passed (${failed} Failed)`)
  console.log('================================================================================\n')

  return { passed, failed }
}

runQrVerificationSuite().catch(console.error)
