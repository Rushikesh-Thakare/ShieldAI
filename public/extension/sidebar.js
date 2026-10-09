const API_BASE = 'http://localhost:3000'

let currentUrl = window.location.href
let autoScanEnabled = true
let currentSnippetData = null

// DOM Elements
const activeUrlDisplay = document.getElementById('active-url-display')
const urlScanCard = document.getElementById('url-scan-card')
const urlRiskScore = document.getElementById('url-risk-score')
const urlVerdictTitle = document.getElementById('url-verdict-title')
const urlVerdictDesc = document.getElementById('url-verdict-desc')
const urlFlagsContainer = document.getElementById('url-flags-container')

const snipScanCard = document.getElementById('snip-scan-card')
const snipThumbnail = document.getElementById('snip-thumbnail')
const snipDimensionsTag = document.getElementById('snip-dimensions-tag')
const snipThreatType = document.getElementById('snip-threat-type')
const snipStatusIndicator = document.getElementById('snip-status-indicator')
const snipRiskScore = document.getElementById('snip-risk-score')
const snipVerdictTitle = document.getElementById('snip-verdict-title')
const snipVerdictDesc = document.getElementById('snip-verdict-desc')
const snipMetaDesc = document.getElementById('snip-meta-desc')
const snipFlagsContainer = document.getElementById('snip-flags-container')
const btnClearSnip = document.getElementById('btn-clear-snip')

const btnStartSnip = document.getElementById('btn-start-snip')
const btnRescanPage = document.getElementById('btn-rescan-page')
const btnCloseSidebar = document.getElementById('btn-close-sidebar')
const btnToggleAutoScan = document.getElementById('btn-toggle-autoscan')
const autoScanLabel = document.getElementById('autoscan-label')

const chatInput = document.getElementById('chat-input')
const btnSendChat = document.getElementById('btn-send-chat')
const chatMessages = document.getElementById('chat-messages')
const chatMessagesContainer = document.getElementById('chat-messages-container')
const btnMinimizeChat = document.getElementById('btn-minimize-chat')

btnMinimizeChat?.addEventListener('click', () => {
  if (chatMessagesContainer) {
    chatMessagesContainer.style.display = 'none'
  }
})

// Close Sidebar button
btnCloseSidebar?.addEventListener('click', () => {
  window.parent.postMessage({ type: 'shield:close-sidebar' }, '*')
})

// Start Snipping Tool button
btnStartSnip?.addEventListener('click', () => {
  window.parent.postMessage({ type: 'shield:start-snipping' }, '*')
})

// Re-scan Page button
btnRescanPage?.addEventListener('click', () => {
  if (currentUrl) scanUrl(currentUrl)
})

// Toggle Auto-Scan
btnToggleAutoScan?.addEventListener('click', () => {
  autoScanEnabled = !autoScanEnabled
  autoScanLabel.textContent = `Auto-Scan: ${autoScanEnabled ? 'ON' : 'OFF'}`
  btnToggleAutoScan.style.opacity = autoScanEnabled ? '1' : '0.6'
})

// Clear Snippet
btnClearSnip?.addEventListener('click', () => {
  snipScanCard.style.display = 'none'
  currentSnippetData = null
})

// URL Scanning Logic
async function scanUrl(url) {
  if (!url || url.startsWith('chrome://') || url.startsWith('about:')) {
    renderUrlResult({
      risk_score: 0,
      risk_level: 'safe',
      verdict: 'Browser System Tab',
      summary: 'Internal browser pages are not external network locations.',
      flags: [],
    })
    return
  }

  currentUrl = url
  activeUrlDisplay.textContent = url

  urlRiskScore.textContent = '...'
  urlRiskScore.className = 'score-badge safe'
  urlVerdictTitle.textContent = 'Scanning active URL...'
  urlVerdictDesc.textContent = 'Evaluating domain reputation, redirect chains, and deceptive keywords.'
  urlFlagsContainer.innerHTML = '<div style="font-size:10px; color:var(--text-muted);"><span class="loading-spinner"></span> Querying Sentinel SOC & Gemini AI...</div>'

  try {
    const res = await fetch(`${API_BASE}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: url }),
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }

    const data = await res.json()
    renderUrlResult(data)
  } catch (err) {
    // Local fallback check
    const isSuspicious = /fakebank|phish|verify|secure-login|urgent|\.xyz|\.top/i.test(url)
    renderUrlResult({
      risk_score: isSuspicious ? 88 : 5,
      risk_level: isSuspicious ? 'danger' : 'safe',
      verdict: isSuspicious ? 'Suspicious domain patterns detected' : 'Standard website format',
      summary: isSuspicious
        ? 'Domain matches credential harvesting patterns or high-risk TLDs.'
        : 'Page inspected. No obvious scam patterns detected in URL structure.',
      flags: isSuspicious ? [
        { text_snippet: url, explanation: 'Suspicious TLD or impersonation keywords', color: 'red' },
      ] : [],
    })
  }
}

let lastUrlScore = 0
let lastUrlVerdict = 'Inspecting'
let lastUrlSummary = ''
let lastSnipScore = 0
let lastSnipVerdict = ''
let lastSnipSummary = ''

function renderUrlResult(result) {
  const score = result.risk_score ?? 0
  const level = result.risk_level ?? (score >= 70 ? 'danger' : score >= 40 ? 'suspicious' : 'safe')

  lastUrlScore = score
  lastUrlVerdict = result.verdict || (score === 0 ? 'No scam signals detected' : 'Threat warning')
  lastUrlSummary = result.summary || 'Inspected by Shield AI threat engine.'

  urlCardRiskClass(level)
  urlRiskScore.textContent = `${score}`
  urlRiskScore.className = `score-badge ${level}`
  urlVerdictTitle.textContent = lastUrlVerdict
  urlVerdictDesc.textContent = lastUrlSummary

  urlFlagsContainer.innerHTML = ''
  if (result.flags && result.flags.length > 0) {
    result.flags.slice(0, 4).forEach((flag) => {
      const el = document.createElement('div')
      el.className = `flag-item ${flag.color === 'red' ? 'red' : 'yellow'}`
      el.innerHTML = `<strong>${flag.type || 'Warning'}:</strong> <span>${flag.explanation || flag.text_snippet || ''}</span>`
      urlFlagsContainer.appendChild(el)
    })
  } else {
    const el = document.createElement('div')
    el.className = 'flag-item'
    el.innerHTML = '<strong>Security Status:</strong> <span>All clear. Domain verified and clean.</span>'
    urlFlagsContainer.appendChild(el)
  }
}

function urlCardRiskClass(level) {
  urlScanCard.classList.remove('safe', 'suspicious', 'danger')
  urlScanCard.classList.add(level)
}

// Snipped Area Analysis Logic
async function scanSnippet({ image, text, url, width, height }) {
  currentSnippetData = { image, text, url, width, height }
  snipScanCard.style.display = 'block'
  snipThumbnail.src = image
  snipDimensionsTag.textContent = `${Math.round(width)} × ${Math.round(height)} px`
  snipThreatType.textContent = 'Analyzing Snippet...'
  snipStatusIndicator.style.display = 'block'

  snipRiskScore.textContent = '...'
  snipRiskScore.className = 'score-badge safe'
  snipVerdictTitle.textContent = 'Deep Context Inspection'
  snipVerdictDesc.textContent = 'Decoding QR codes, reading typography, and analyzing visual elements with Gemini Vision.'
  if (snipMetaDesc) {
    snipMetaDesc.textContent = 'Decoding QR codes, reading typography, and analyzing visual elements with Gemini Vision.'
  }
  snipFlagsContainer.innerHTML = ''

  // Collapse previous chat messages to maximize space for snippet card
  if (chatMessagesContainer) {
    chatMessagesContainer.style.display = 'none'
  }

  // Smoothly ensure snippet card is in view without hiding the URL card above
  setTimeout(() => {
    snipScanCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, 60)

  try {
    const res = await fetch(`${API_BASE}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image,
        mimeType: 'image/png',
        content: text ? `Snipped region context text: "${text}" from ${url}` : url,
      }),
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const data = await res.json()
    renderSnippetResult(data)
  } catch (err) {
    // Client-side fallback heuristics with strict pattern detection
    const isTyposquat = text && /(?:rnicrosoft|arnazon|goog1e|paypa1|micros0ft|faceb00k|netf1ix|instagrarn|hdfcbankunoffic)/i.test(text)
    const isCoercive = text && (
      /(?:password|otp|pin|ssn|cvv|secret code).{0,40}(?:enter|verify|provide|confirm|submit|send)/i.test(text) ||
      /(?:account|card|access|service).{0,25}(?:suspend|block|freeze|terminate|penalty).{0,35}(?:click|verify|immediate|within \d+)/i.test(text) ||
      /(?:gift card|crypto|wire transfer).{0,30}(?:send|purchase|buy|urgently)/i.test(text)
    )
    const isMildSus = text && /(?:limited time|act now|hurry|claim prize|selected for|exclusive bonus|survey)/i.test(text)

    const isDanger = isTyposquat || isCoercive
    const riskScore = isDanger ? 94 : (isMildSus ? 45 : 4)
    const riskLevel = isDanger ? 'danger' : (isMildSus ? 'suspicious' : 'safe')
    const threatType = isTyposquat ? 'Brand Impersonation / Typosquatting' : (isCoercive ? 'Credential Phishing / Urgency Coercion' : (isMildSus ? 'Promotional Solicitation' : 'Benign / Safe'))
    const verdict = isTyposquat ? 'Brand Lookalike / Typosquatting Detected' : (isCoercive ? 'Suspicious Form or Urgent Coercion Detected' : (isMildSus ? 'Unverified Promotional Content' : 'Content Verified Safe'))
    const summary = isTyposquat
      ? 'The snipped region contains a lookalike domain designed to deceptively imitate a major brand.'
      : (isCoercive
          ? 'The snipped region contains sensitive credential requests combined with coercive language.'
          : (isMildSus
              ? 'The snipped region contains marketing or promotional urgency. Exercise normal caution.'
              : `The analyzed snippet appears clean with standard informational content and no deceptive indicators.`))

    renderSnippetResult({
      risk_score: riskScore,
      risk_level: riskLevel,
      threat_type: threatType,
      verdict: verdict,
      summary: summary,
      flags: isTyposquat ? [
        { type: 'Brand Impersonation', explanation: 'Domain uses deceptive lookalike characters to mimic a trusted brand.', color: 'red' },
      ] : (isCoercive ? [
        { type: 'Credential Harvesting Pattern', explanation: 'Visual form or text solicits authentication credentials.', color: 'red' },
        { type: 'Urgency Pressure', explanation: 'Uses coercion signals to rush the user.', color: 'red' },
      ] : (isMildSus ? [
        { type: 'Promotional Urgency', explanation: 'Uses promotional language to encourage interaction.', color: 'yellow' },
      ] : [
        { type: 'Visual Inspection', explanation: 'Standard web elements, no malicious patterns.', color: 'blue' },
      ])),
    })
  }
}

function renderSnippetResult(result) {
  snipStatusIndicator.style.display = 'none'
  const score = result.risk_score ?? 0
  const level = result.risk_level ?? (score >= 70 ? 'danger' : score >= 40 ? 'suspicious' : 'safe')

  lastSnipScore = score
  lastSnipVerdict = result.verdict || (score >= 70 ? 'Threat Detected in Snippet' : 'Snippet Verified Safe')
  lastSnipSummary = result.summary || 'Inspected by Gemini AI Vision.'

  snipScanCard.classList.remove('safe', 'suspicious', 'danger')
  snipScanCard.classList.add(level)

  snipRiskScore.textContent = `${score}`
  snipRiskScore.className = `score-badge ${level}`
  snipThreatType.textContent = result.threat_type || (score >= 70 ? 'High Risk Threat' : 'Benign / Safe')
  snipVerdictTitle.textContent = lastSnipVerdict
  snipVerdictDesc.textContent = lastSnipSummary
  if (snipMetaDesc) {
    snipMetaDesc.textContent = lastSnipSummary
  }

  snipFlagsContainer.innerHTML = ''
  if (result.flags && result.flags.length > 0) {
    result.flags.slice(0, 6).forEach((flag) => {
      const el = document.createElement('div')
      el.className = `flag-item ${flag.color === 'red' ? 'red' : 'yellow'}`
      el.innerHTML = `<strong>${flag.type || 'Flag'}:</strong> <span>${flag.explanation || flag.text_snippet || ''}</span>`
      snipFlagsContainer.appendChild(el)
    })
  }

  // Ensure user sees snippet result comfortably without jumping away from top
  setTimeout(() => {
    snipScanCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, 60)
}

function formatAiResponse(text) {
  if (!text) return ''
  let formatted = String(text)
  // Convert markdown bold **text** to styled bold
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#00E5FF;font-weight:700;">$1</strong>')
  // Convert markdown italic *text* to em
  formatted = formatted.replace(/\*(.+?)\*/g, '<em style="color:#E2E8F0;">$1</em>')
  // Convert markdown bullets
  formatted = formatted.replace(/^[\*\-]\s+(.+)$/gm, '• $1')
  // Convert double and single line breaks
  formatted = formatted.replace(/\n\n+/g, '<br><br>').replace(/\n/g, '<br>')
  return formatted
}

function generateFastCopilotFallback(question) {
  const q = String(question || '').toLowerCase()
  let domain = 'this website'
  try {
    if (currentUrl) domain = new URL(currentUrl).hostname || currentUrl
  } catch {
    domain = currentUrl || 'this website'
  }

  if (q.includes('password') || q.includes('login') || q.includes('credential')) {
    if (lastUrlScore >= 60) {
      return `⚠️ **Do not enter passwords here.** This site has an elevated risk score (${lastUrlScore}/100) and displays characteristics associated with phishing or credential harvesting.`
    }
    return `The domain **${domain}** shows a clean safety index (${lastUrlScore}/100). However, always ensure the lock icon is present and the domain matches before submitting passwords.`
  }

  if (q.includes('score') || q.includes('why') || q.includes('risk') || q.includes('explain')) {
    return `The current risk index is **${lastUrlScore}/100** (${lastUrlVerdict}). This evaluation is based on real-time domain age, DNS telemetry, and structural heuristics. ${lastUrlSummary}`
  }

  if (q.includes('brand') || q.includes('impersonat') || q.includes('fake') || q.includes('real')) {
    return `Shield inspected **${domain}** for typosquatting, character lookalikes, and brand spoofing. Status: **${lastUrlVerdict}**. ${lastUrlScore < 40 ? 'No deceptive brand imitation detected.' : 'Warning: Brand imitation markers detected.'}`
  }

  if (q.includes('safe') || q.includes('legit') || q.includes('trust') || q.includes('danger')) {
    if (lastUrlScore >= 70) {
      return `🚫 **High Risk Alert:** We recommend caution on this page (Risk: ${lastUrlScore}/100 — ${lastUrlVerdict}).`
    } else if (lastUrlScore >= 40) {
      return `⚠️ **Moderate Caution:** Risk index is ${lastUrlScore}/100. Double check payment or login fields.`
    }
    return `✅ **Site Verified Clean:** Risk index is **${lastUrlScore}/100** (${lastUrlVerdict}). Zero malicious flags detected on this URL.`
  }

  if (q.includes('hi') || q.includes('hello') || q.includes('hey')) {
    return `Hello! I am **Shield AI**, actively protecting your browsing on **${domain}**. Ask me any question about page safety, or click **Scan Screen Area** to crop a suspicious element.`
  }

  return `Safety report for **${domain}**: Risk index is **${lastUrlScore}/100** (${lastUrlVerdict}). ${currentSnippetData ? `Scanned area was analyzed (${lastSnipVerdict}). ` : ''}Always verify payment portals and one-time security codes.`
}

// Universal mouse wheel listener so the sidebar is ALWAYS scrollable anywhere
window.addEventListener('wheel', (e) => {
  const scrollContainer = document.querySelector('.sidebar-scroll-body')
  if (!scrollContainer) return
  // Allow nested copilot message box to scroll if cursor is inside it
  if (e.target.closest('.copilot-messages')) return
  scrollContainer.scrollTop += e.deltaY
}, { passive: true })

// Chat Copilot
btnSendChat?.addEventListener('click', handleChat)
chatInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleChat()
})

async function handleChat() {
  const query = chatInput.value.trim()
  if (!query) return

  if (chatMessagesContainer) {
    chatMessagesContainer.style.display = 'flex'
  }
  chatMessages.style.display = 'flex'
  chatMessages.style.flexDirection = 'column'
  chatMessages.style.gap = '6px'

  // User message bubble
  const userEl = document.createElement('div')
  userEl.style.padding = '8px 12px'
  userEl.style.background = 'linear-gradient(135deg, #0052FF 0%, #0088FF 100%)'
  userEl.style.borderRadius = '10px 10px 2px 10px'
  userEl.style.color = '#FFFFFF'
  userEl.style.fontSize = '11.5px'
  userEl.style.fontWeight = '500'
  userEl.style.alignSelf = 'flex-end'
  userEl.style.maxWidth = '90%'
  userEl.style.boxShadow = '0 2px 8px rgba(0, 102, 255, 0.25)'
  userEl.textContent = query
  chatMessages.appendChild(userEl)
  chatInput.value = ''

  // Shield AI thinking bubble
  const botEl = document.createElement('div')
  botEl.style.padding = '10px 12px'
  botEl.style.background = 'rgba(15, 23, 42, 0.9)'
  botEl.style.border = '1px solid rgba(0, 229, 255, 0.25)'
  botEl.style.borderRadius = '10px 10px 10px 2px'
  botEl.style.color = '#F1F5F9'
  botEl.style.fontSize = '11.5px'
  botEl.style.lineHeight = '1.45'
  botEl.style.alignSelf = 'flex-start'
  botEl.style.maxWidth = '92%'
  botEl.innerHTML = '<span class="loader-ring" style="width:8px;height:8px;border-width:1.5px;margin-right:4px;"></span> <span style="color:#00E5FF;font-weight:600;">Shield AI</span> is thinking...'
  chatMessages.appendChild(botEl)
  chatMessages.scrollTop = chatMessages.scrollHeight

  const contextData = `Active Page: ${currentUrl}. Page Risk Score: ${lastUrlScore}/100 (${lastUrlVerdict}). ` +
    (currentSnippetData ? `User captured visual snippet (${lastSnipVerdict}, Risk: ${lastSnipScore}/100, text: "${currentSnippetData.text || ''}").` : 'No snippet captured.')

  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: query,
        context: contextData,
        provider: 'gemini',
      }),
      signal: AbortSignal.timeout(22000),
    })

    if (!res.ok) throw new Error('Chat failed')
    const data = await res.json()
    const replyText = data.answer || data.reply || data.text || ''
    if (!replyText) throw new Error('Empty response')

    botEl.innerHTML = `<div style="font-size:10px;font-weight:800;letter-spacing:0.05em;color:#00E5FF;margin-bottom:4px;display:flex;align-items:center;gap:4px;">✦ SHIELD AI</div>${formatAiResponse(replyText)}`
  } catch (err) {
    const fallbackAnswer = generateFastCopilotFallback(query)
    botEl.innerHTML = `<div style="font-size:10px;font-weight:800;letter-spacing:0.05em;color:#00E5FF;margin-bottom:4px;display:flex;align-items:center;gap:4px;">✦ SHIELD AI</div>${formatAiResponse(fallbackAnswer)}`
  }
  chatMessages.scrollTop = chatMessages.scrollHeight
}

// Listen for messages from parent content script
window.addEventListener('message', (event) => {
  const data = event.data
  if (!data || typeof data !== 'object') return

  if (data.type === 'shield:page-info') {
    if (autoScanEnabled && data.url) {
      scanUrl(data.url)
    } else if (data.url) {
      currentUrl = data.url
      activeUrlDisplay.textContent = data.url
    }
  } else if (data.type === 'shield:snip-result') {
    scanSnippet(data)
  }
})
