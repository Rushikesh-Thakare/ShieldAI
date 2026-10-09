const pageText = document.body?.innerText?.slice(0, 12000) ?? ''
const signals = {
  passwordForm: Boolean(document.querySelector('input[type="password"]')),
  urgency: /\b(urgent|immediately|account suspended|verify now|act now|unusual activity)\b/i.test(pageText),
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'shield:inspect') sendResponse(signals)
})

chrome.runtime.sendMessage({ type: 'shield:page-audit', signals })
