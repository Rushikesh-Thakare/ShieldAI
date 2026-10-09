import 'dotenv/config'
import { Jimp } from 'jimp'
import { analyzeWithGemini } from '../services/geminiService.js'

/**
 * Test Suite: 15 Visual Image Scans
 * - 5 Normal / Unthreatening Images
 * - 5 Mildly Suspicious Images
 * - 5 Dangerous Phishing / Threat Images
 */

// Helper to create a clean PNG buffer
async function createImageBuffer(width, height, bgColorHex) {
  const image = new Jimp({ width, height, color: bgColorHex })
  const buffer = await image.getBuffer('image/png')
  return {
    data: buffer.toString('base64'),
    mimeType: 'image/png',
    byteLength: buffer.length,
  }
}

const TEST_CASES = [
  // === CATEGORY 1: 5 NORMAL / UNTHREATENING IMAGES ===
  {
    category: 'Normal / Benign',
    title: '1. Gemini in Gmail Feature Overview (The User Example)',
    content: 'Gemini in Gmail\nWith Gemini in Gmail, you get a personal, proactive inbox assistant that helps you respond quickly in your own voice, get things done faster, and turn information into answers without the digging.',
    expectedTier: 'safe',
    maxRiskScore: 15,
  },
  {
    category: 'Normal / Benign',
    title: '2. Chocolate Chip Cookies Recipe Card',
    content: 'Classic Chocolate Chip Cookies Recipe\nPrep time: 15 mins | Bake time: 10 mins\nIngredients: 2 cups all-purpose flour, 1 cup butter softened, 3/4 cup brown sugar, 1 tsp vanilla extract, 2 cups semi-sweet chocolate chips.\nInstructions: Cream butter and sugar, fold in chocolate chips, bake at 350°F (175°C) until golden brown.',
    expectedTier: 'safe',
    maxRiskScore: 15,
  },
  {
    category: 'Normal / Benign',
    title: '3. React useEffect Documentation Snippet',
    content: 'React Docs · Using the Effect Hook\nuseEffect lets you synchronize a component with an external system. Call useEffect at the top level of your component to declare an Effect: useEffect(() => { const sub = subscribe(); return () => sub.unsubscribe(); }, [dependencies]);',
    expectedTier: 'safe',
    maxRiskScore: 15,
  },
  {
    category: 'Normal / Benign',
    title: '4. Local Weather Forecast Card',
    content: 'San Francisco, CA Weather Forecast\nToday: 72°F · Clear and Sunny · Humidity 45% · Wind NW at 8 mph · Air Quality: Good (Index 28).\nTomorrow: High 70°F / Low 54°F with light afternoon coastal fog.',
    expectedTier: 'safe',
    maxRiskScore: 15,
  },
  {
    category: 'Normal / Benign',
    title: '5. Corporate Internal Team Welcome Message',
    content: 'Welcome to the Engineering Team, Sarah!\nWe are excited to have you join our frontend infrastructure pod. Please join us for a team welcome lunch today at 1:00 PM in the 4th-floor cafeteria. Your onboarding buddy David will meet you at 11:00 AM.',
    expectedTier: 'safe',
    maxRiskScore: 15,
  },

  // === CATEGORY 2: 5 MILDLY SUSPICIOUS / CAUTIONARY IMAGES ===
  {
    category: 'Mildly Suspicious',
    title: '6. Unverified Product Beta Tester Invitation',
    content: 'Exclusive Beta Access: You have been invited to test our upcoming productivity suite ahead of public launch. Click here to preview features and submit early feedback. Unverified external sender.',
    expectedTier: 'suspicious',
    minRiskScore: 30,
    maxRiskScore: 70,
  },
  {
    category: 'Mildly Suspicious',
    title: '7. Unsolicited Webinar Registration Banner',
    content: 'Join Free Live Masterclass: "Mastering Cloud Architecture in 2026". Limited spots available for this week. Register with your work email to receive meeting link.',
    expectedTier: 'suspicious',
    minRiskScore: 30,
    maxRiskScore: 70,
  },
  {
    category: 'Mildly Suspicious',
    title: '8. Unsolicited Commercial Supplier Quotation',
    content: 'Unsolicited Inquiry: Please find attached our prospective Q4 component pricing sheet for review. If your procurement department is interested in alternate sourcing, please reply with your specifications.',
    expectedTier: 'suspicious',
    minRiskScore: 25,
    maxRiskScore: 70,
  },
  {
    category: 'Mildly Suspicious',
    title: '9. Cloud Storage Quota Warning Notification',
    content: 'Storage Alert: Your cloud drive is 98% full. Inbound files may bounce. Click here to review storage upgrade options and retain seamless synchronization.',
    expectedTier: 'suspicious',
    minRiskScore: 30,
    maxRiskScore: 70,
  },
  {
    category: 'Mildly Suspicious',
    title: '10. Unsolicited Customer Reward Survey',
    content: 'Customer Satisfaction Survey: You have been selected for our quarterly user study. Complete this 3-question survey to receive a $25 store credit voucher. Valid for 48 hours.',
    expectedTier: 'suspicious',
    minRiskScore: 30,
    maxRiskScore: 70,
  },

  // === CATEGORY 3: 5 HIGH THREAT / PHISHING IMAGES ===
  {
    category: 'High Threat / Phishing',
    title: '11. Microsoft Brand Typosquatting (www.rnicrosoft.com)',
    content: 'www.rnicrosoft.com/login/auth - Sign in to your Microsoft Office 365 Account. Enter your corporate email and domain password to continue.',
    expectedTier: 'danger',
    minRiskScore: 75,
  },
  {
    category: 'High Threat / Phishing',
    title: '12. Fake Netflix Subscription Suspension Card',
    content: 'Netflix: Your subscription has been placed on hold because your monthly billing card was declined. Update your credit card number, expiration date, and CVV security code within 24 hours to prevent account cancellation: http://netflix-billing-update.xyz',
    expectedTier: 'danger',
    minRiskScore: 75,
  },
  {
    category: 'High Threat / Phishing',
    title: '13. CEO Executive Wire Fraud / Apple Gift Cards',
    content: 'From: CEO <executive.office@corp-internal-board.xyz>\nTo: finance@company.com\nSubject: CONFIDENTIAL: Immediate Apple Gift Card purchase required.\nI am boarding a flight. Buy 10x $200 Apple gift cards right now and email the scratch-off PIN codes directly to me before 3 PM. Do not call me.',
    expectedTier: 'danger',
    minRiskScore: 75,
  },
  {
    category: 'High Threat / Phishing',
    title: '14. DHL Customs Duty Advance-Fee Scam',
    content: 'DHL Express: Shipment #DH-992019 has been detained at customs checkpoint for unpaid duty fee of $2.85 USD. Pay immediately at http://dhl-express-customs.top/pay/trace to release your package for delivery today.',
    expectedTier: 'danger',
    minRiskScore: 75,
  },
  {
    category: 'High Threat / Phishing',
    title: '15. Microsoft 365 Password Expiration Form',
    content: 'Microsoft 365 Security Notice: Your enterprise email password expires in 2 hours. Keep your current password by verifying your credentials now at: https://login.microsoftonline-portal-auth.xyz/verify',
    expectedTier: 'danger',
    minRiskScore: 75,
  },
]

async function run15ImageTests() {
  console.log('================================================================================')
  console.log('🛡️  SHIELD AI — 15 IMAGE THREAT INTELLIGENCE VERIFICATION SUITE')
  console.log('================================================================================\n')

  let passed = 0
  let failed = 0
  const results = []

  for (let i = 0; i < TEST_CASES.length; i++) {
    const test = TEST_CASES[i]
    console.log(`[TEST ${i + 1}/15] [${test.category}] ${test.title}`)

    // Generate visual image buffer
    const imgBuf = await createImageBuffer(600, 280, test.category.includes('Normal') ? 0xffffffff : (test.category.includes('Mild') ? 0xfef9c3ff : 0xfee2e2ff))

    try {
      const response = await analyzeWithGemini({
        content: test.content,
        image: {
          data: imgBuf.data,
          mimeType: imgBuf.mimeType,
        },
        inputType: 'image_and_text',
      })

      const score = response.risk_score ?? 0
      const threatType = response.threat_type || 'N/A'
      const verdict = response.verdict || 'N/A'
      const level = score >= 75 ? 'danger' : (score >= 40 ? 'suspicious' : 'safe')

      let testPassed = false
      if (test.expectedTier === 'safe') {
        testPassed = score <= (test.maxRiskScore ?? 25)
      } else if (test.expectedTier === 'suspicious') {
        testPassed = score >= (test.minRiskScore ?? 30) && score <= (test.maxRiskScore ?? 74)
      } else if (test.expectedTier === 'danger') {
        testPassed = score >= (test.minRiskScore ?? 75)
      }

      if (testPassed) {
        passed++
        console.log(`  ✅ PASSED: Score=${score}/100 (${level.toUpperCase()}) | ThreatType="${threatType}" | Verdict="${verdict.slice(0, 50)}..."`)
      } else {
        failed++
        console.log(`  ❌ FAILED: Score=${score}/100 (Expected Tier: ${test.expectedTier}) | ThreatType="${threatType}" | Verdict="${verdict}"`)
      }

      results.push({
        title: test.title,
        category: test.category,
        score,
        tier: level,
        expected: test.expectedTier,
        passed: testPassed,
        threatType,
        summary: response.summary,
      })
    } catch (err) {
      failed++
      console.log(`  ❌ ERROR running test: ${err.message}`)
      results.push({
        title: test.title,
        category: test.category,
        error: err.message,
        passed: false,
      })
    }

    console.log('--------------------------------------------------------------------------------')
    await new Promise((r) => setTimeout(r, 1200))
  }

  console.log('\n================================================================================')
  console.log(`📊 FINAL RESULTS: ${passed}/15 Tests Passed (${failed} Failed)`)
  console.log('================================================================================\n')

  return { passed, failed, results }
}

run15ImageTests().catch(console.error)
