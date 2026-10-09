import { answerWithGemini } from './geminiService.js'
import { answerWithGroq } from './groqService.js'

const safeFallback = 'I could not reach an AI service just now. Do not open suspicious links or share passwords or one-time codes. Verify requests using the organization’s official app or a phone number you already trust.'

function getSynthesizedAnswer(question, context = '') {
  const q = String(question || '').toLowerCase()
  if (q.includes('otp') || q.includes('code') || q.includes('one-time') || q.includes('2fa')) {
    return 'Never share your One-Time Password (OTP) or 2FA codes. Legitimate banks and support teams will NEVER ask for your OTP over phone, SMS, or email. Sharing it grants immediate authorization to transfer funds or reset your credentials.'
  }
  if (q.includes('password') || q.includes('credential') || q.includes('login') || q.includes('sign in')) {
    return 'If you entered your password on a suspicious site, change it immediately on the official service app or verified domain. If you reuse that password on other accounts, update those as well and enable two-factor authentication.'
  }
  if (q.includes('money') || q.includes('transfer') || q.includes('gift card') || q.includes('wire') || q.includes('pay') || q.includes('fee')) {
    return 'Do not send funds or purchase gift cards. Scammers use artificial urgency or threats of account suspension to rush you into making irreversible payments. Verify requests directly through official banking channels.'
  }
  if (q.includes('safe') || q.includes('risk') || q.includes('hacked') || q.includes('compromised')) {
    return 'You are safe as long as you did not submit passwords, credit card numbers, or OTPs on the page. Shield stopped the connection before your information was sent. You can check the Recovery Guide for proactive hardening steps.'
  }
  if (q.includes('what should i do') || q.includes('next step') || q.includes('help') || q.includes('how to recover')) {
    return 'Follow these 4 immediate steps: 1) Close the tab and do not click links in that message. 2) If you typed credentials, change your password via the official website. 3) Enable 2-factor authentication. 4) Use Shield’s Recovery Guide to verify your account security.'
  }
  if (q.includes('why') || q.includes('evidence') || q.includes('how did you know') || q.includes('details')) {
    return 'Shield flagged this threat based on lookalike domain signatures, recently registered hosting, credential harvesting forms, and artificial urgency. Legitimate providers never use unverified redirect chains.'
  }
  if (q.includes('hi') || q.includes('hello') || q.includes('who are you') || q.includes('what is shield')) {
    return 'Hello! I am Shield AI, your real-time scam and phishing defense copilot. I analyze suspicious links, explain security anomalies, and help protect your personal data. What would you like to check?'
  }
  return `Based on Shield's security analysis${context ? ` (${context})` : ''}: Do not enter personal information, credentials, or one-time codes on unverified pages. Always open services through their official mobile app or type the verified URL yourself.`
}

export async function answerWithChatProvider(question, context = '', preferredProvider = 'gemini') {
  const preferred = preferredProvider === 'groq' ? 'groq' : 'gemini'
  const providers = preferred === 'gemini' ? ['gemini', 'groq'] : ['groq', 'gemini']
  const attemptedProviders = []
  const failures = []

  for (const provider of providers) {
    const configured = provider === 'gemini'
      ? Boolean(process.env.GEMINI_API_KEY)
      : Boolean(process.env.GROQ_API_KEY)
    if (!configured) continue
    attemptedProviders.push(provider)

    try {
      const answer = provider === 'gemini'
        ? await answerWithGemini(question, context)
        : await answerWithGroq(question, context)
      return { answer, provider }
    } catch (error) {
      const reason = error?.status
        ? `HTTP ${error.status}${error.status === 404 ? ' (model not found)' : ''}`
        : error?.name === 'TimeoutError' || error?.name === 'AbortError'
          ? 'request timed out'
          : 'request failed'
      failures.push(`${provider === 'groq' ? 'Groq' : 'Gemini'}: ${reason}`)
      console.error(`[Shield API] ${provider} chat request failed:`, error instanceof Error ? error.message : 'Unknown error')
    }
  }

  const fallbackAnswer = attemptedProviders.length ? getSynthesizedAnswer(question, context) : safeFallback

  return {
    answer: fallbackAnswer,
    provider: attemptedProviders.length ? 'Shield Security Engine' : 'safe_fallback',
    warning: attemptedProviders.length
      ? `${attemptedProviders.length === 1 ? 'The configured AI provider failed' : 'Both configured AI providers failed'}. ${failures.join('; ')}. Check provider keys/models or try again shortly.`
      : 'Configure GEMINI_API_KEY or GROQ_API_KEY on the server to enable AI chat.',
  }
}
