import { assessUrl } from './detector.js'

const params = new URLSearchParams(location.search)
const rawUrl = params.get('url') ?? ''
let serverAssessment = null
try {
  const parsed = JSON.parse(params.get('assessment') || 'null')
  if (parsed && typeof parsed.summary === 'string' && Array.isArray(parsed.signals)) serverAssessment = parsed
} catch {
  serverAssessment = null
}
const parsedUrl = (() => {
  try { return new URL(rawUrl) } catch { return null }
})()
const host = parsedUrl?.hostname.replace(/^www\./, '') || 'Unknown address'
const assessment = serverAssessment ?? assessUrl(rawUrl)
const evidence = assessment.signals.map((signal, index) => ({
  title: signal,
  text: serverAssessment?.summary ?? [
    'This signal is part of the local example rules used by the prototype.',
    'A signal can be a reason to pause, but does not prove that a site is malicious.',
    'Shield does not read or submit anything typed into page forms.',
    'Confirm the website address independently before entering personal details.',
  ][index % 4],
}))

document.querySelector('#blocked-url').textContent = host
const score = document.querySelector('#score')
if (score) score.textContent = `${assessment.score} / 100`
const description = document.querySelector('.details-hero p')
if (description && serverAssessment?.summary) description.textContent = serverAssessment.summary
const note = document.querySelector('.local-note')
if (note && serverAssessment?.source === 'server') {
  note.textContent = 'Analysis and evidence provided by your Shield account.'
}

const evidenceList = document.querySelector('#evidence-list')
for (const [index, item] of evidence.entries()) {
  const row = document.createElement('div')
  row.className = 'evidence'
  const number = document.createElement('span')
  number.className = 'number'
  number.textContent = String(index + 1).padStart(2, '0')
  const content = document.createElement('div')
  const title = document.createElement('strong')
  title.textContent = item.title
  const detail = document.createElement('p')
  detail.textContent = item.text
  content.append(title, detail)
  row.append(number, content)
  evidenceList.append(row)
}

document.querySelector('#return-safe').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  if (tab?.id) await chrome.tabs.update(tab.id, { url: 'chrome://newtab/' })
})

document.querySelector('#show-evidence')?.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  if (tab?.id) await chrome.tabs.update(tab.id, { url: chrome.runtime.getURL(`evidence.html?url=${encodeURIComponent(rawUrl)}`) })
})

document.querySelector('#back')?.addEventListener('click', () => history.back())
