import { assessUrl } from './detector.js'

const warningPage = (url) => `${chrome.runtime.getURL('warning.html')}?url=${encodeURIComponent(url)}`
const pageSignals = new Map()

// Clicking extension icon toggles the Squeeze Sidebar on the active page
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'shield:toggle-sidebar' })
  } catch {
    // If content script was not ready, inject scripts and then toggle
    try {
      await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['sidebar-host.css'] })
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] })
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, { type: 'shield:toggle-sidebar' }).catch(() => {})
      }, 100)
    } catch {
      // Chrome protected page (e.g. chrome://)
    }
  }
})

// Navigation-level proactive phishing blocker (when permitted)
if (chrome.webNavigation?.onBeforeNavigate) {
  chrome.webNavigation.onBeforeNavigate.addListener((navigation) => {
    if (navigation.frameId !== 0) return

    const assessment = assessUrl(navigation.url)
    if (assessment.risk !== 'danger') return

    chrome.tabs.update(navigation.tabId, { url: warningPage(navigation.url) })
  })
}

// Viewport screenshot capture for Snipping Tool
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'shield:capture-viewport') {
    const windowId = sender.tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT
    chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, (dataUrl) => {
      const err = chrome.runtime.lastError?.message
      sendResponse({ dataUrl: dataUrl || null, error: err })
    })
    return true // Keep channel open for async response
  }

  if (message?.type === 'shield:page-audit' && typeof sender.tab?.id === 'number') {
    pageSignals.set(sender.tab.id, message.signals ?? {})
    const assessment = assessUrl(sender.tab.url ?? '', message.signals ?? {})
    if (assessment.risk === 'danger') {
      chrome.tabs.update(sender.tab.id, { url: warningPage(sender.tab.url ?? '') })
    }
    return
  }

  if (message?.type === 'shield:get-page-signals') {
    const tabId = message.tabId
    if (typeof tabId !== 'number') return
    sendResponse(pageSignals.get(tabId) ?? {})
  }
})

chrome.tabs.onRemoved.addListener((tabId) => pageSignals.delete(tabId))
