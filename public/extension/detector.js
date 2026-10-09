const knownDangerousHosts = new Set([
  'fakebank-login.com',
  'secure-account-verify.xyz',
  'microsoft-security-alert.com',
])

const shortenerHosts = new Set([
  'bit.ly',
  'tinyurl.com',
  't.co',
  'short.ly',
])

export function assessUrl(rawUrl, pageSignals = {}) {
  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    return { risk: 'unknown', score: 0, host: 'Unavailable', signals: ['Page address unavailable'] }
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { risk: 'unknown', score: 0, host: parsed.hostname || 'Browser page', signals: ['Browser-internal page'] }
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
  const fullUrl = `${host}${parsed.pathname}${parsed.search}`.toLowerCase()
  const signals = []

  if (knownDangerousHosts.has(host)) {
    return {
      risk: 'danger',
      score: 97,
      host,
      signals: ['Known demo phishing domain', 'Credential request', 'Brand impersonation'],
    }
  }

  const suspiciousUrl = /verify|secure[-.]account|account[-.]?alert|login[-.]?verify|password[-.]?reset|urgent[-.]?sign/i.test(fullUrl)
  const suspiciousTld = /\.(xyz|top|click|work|zip)$/i.test(host)
  const shortener = shortenerHosts.has(host)
  const passwordForm = Boolean(pageSignals.passwordForm)
  const urgency = Boolean(pageSignals.urgency)

  if (shortener) signals.push('Link shortener hides destination')
  if (suspiciousTld) signals.push('Unusual domain ending')
  if (suspiciousUrl) signals.push('Account or verification language in URL')
  if (passwordForm) signals.push('Page requests a password')
  if (urgency) signals.push('Urgency language on page')

  const strongCombination = (suspiciousTld && (suspiciousUrl || passwordForm)) || (suspiciousUrl && passwordForm && urgency)
  if (strongCombination) {
    if (signals.length < 3 && passwordForm) signals.push('Credential form on a suspicious domain')
    return { risk: 'danger', score: 92, host, signals: signals.slice(0, 4) }
  }

  if (signals.length > 0) {
    return { risk: 'suspicious', score: Math.min(78, 46 + signals.length * 8), host, signals }
  }

  return {
    risk: 'safe',
    score: 4,
    host,
    signals: ['No obvious URL warning signs', ...(passwordForm ? ['Password form detected (not a verdict by itself)'] : [])],
  }
}
