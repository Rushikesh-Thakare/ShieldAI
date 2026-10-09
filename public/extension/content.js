let sidebarFrame = null
let floatingTrigger = null
let isSidebarOpen = false

function initSidebar() {
  if (sidebarFrame) return

  sidebarFrame = document.createElement('iframe')
  sidebarFrame.id = 'shield-squeeze-sidebar-frame'
  sidebarFrame.src = chrome.runtime.getURL('sidebar.html')
  sidebarFrame.allow = 'clipboard-read; clipboard-write'
  document.documentElement.appendChild(sidebarFrame)

  floatingTrigger = document.createElement('div')
  floatingTrigger.id = 'shield-floating-trigger'
  floatingTrigger.title = 'Click to open Shield AI Squeeze Sidebar'
  floatingTrigger.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
    <span>SHIELD AI</span>
  `
  floatingTrigger.addEventListener('click', () => toggleSidebar(true))
  document.documentElement.appendChild(floatingTrigger)
}

function applySqueeze(enable) {
  const root = document.documentElement
  const body = document.body

  if (enable) {
    root.classList.add('shield-squeeze-active')
    body?.classList.add('shield-squeeze-active')

    // Force inline CSS to override stubborn framework layouts (e.g. Facebook, Google, React)
    root.style.setProperty('width', 'calc(100vw - 420px)', 'important')
    root.style.setProperty('max-width', 'calc(100vw - 420px)', 'important')
    root.style.setProperty('margin-right', '420px', 'important')
    root.style.setProperty('box-sizing', 'border-box', 'important')
    root.style.setProperty('overflow-x', 'hidden', 'important')
    root.style.setProperty('transition', 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1), margin-right 0.3s cubic-bezier(0.16, 1, 0.3, 1)', 'important')

    if (body) {
      body.style.setProperty('width', 'calc(100vw - 420px)', 'important')
      body.style.setProperty('max-width', 'calc(100vw - 420px)', 'important')
      body.style.setProperty('margin-right', '420px', 'important')
      body.style.setProperty('box-sizing', 'border-box', 'important')
      body.style.setProperty('overflow-x', 'hidden', 'important')
      body.style.setProperty('transition', 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1), margin-right 0.3s cubic-bezier(0.16, 1, 0.3, 1)', 'important')
    }
  } else {
    root.classList.remove('shield-squeeze-active')
    body?.classList.remove('shield-squeeze-active')

    root.style.removeProperty('width')
    root.style.removeProperty('max-width')
    root.style.removeProperty('margin-right')
    root.style.removeProperty('box-sizing')
    root.style.removeProperty('overflow-x')
    root.style.removeProperty('transition')

    if (body) {
      body.style.removeProperty('width')
      body.style.removeProperty('max-width')
      body.style.removeProperty('margin-right')
      body.style.removeProperty('box-sizing')
      body.style.removeProperty('overflow-x')
      body.style.removeProperty('transition')
    }
  }

  // Notify webpage responsive layouts to adapt instantly
  try {
    window.dispatchEvent(new Event('resize'))
  } catch {}
}

function toggleSidebar(forceState) {
  initSidebar()
  const next = typeof forceState === 'boolean' ? forceState : !isSidebarOpen
  isSidebarOpen = next

  applySqueeze(isSidebarOpen)

  if (isSidebarOpen) {
    sidebarFrame.classList.add('shield-open')
    floatingTrigger.classList.add('shield-hidden')

    // Inform sidebar of current page URL and title
    setTimeout(() => {
      sidebarFrame.contentWindow?.postMessage({
        type: 'shield:page-info',
        url: window.location.href,
        title: document.title,
        host: window.location.hostname,
      }, '*')
    }, 200)
  } else {
    sidebarFrame.classList.remove('shield-open')
    floatingTrigger.classList.remove('shield-hidden')
  }
}

// Interactive Snipping Tool
function startSnippingTool() {
  const existingOverlay = document.getElementById('shield-snip-overlay')
  if (existingOverlay) existingOverlay.remove()

  const overlay = document.createElement('div')
  overlay.id = 'shield-snip-overlay'

  const tip = document.createElement('div')
  tip.id = 'shield-snip-tip'
  tip.innerHTML = `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/>
    </svg>
    <span>Click & drag a box over any QR code, image, login form, or text &nbsp;·&nbsp; <b>ESC to cancel</b></span>
  `
  overlay.appendChild(tip)

  let startX = 0
  let startY = 0
  let isSelecting = false
  let snipBox = null

  function onMouseDown(e) {
    if (e.button !== 0) return
    isSelecting = true
    startX = e.clientX
    startY = e.clientY

    snipBox = document.createElement('div')
    snipBox.id = 'shield-snip-box'
    snipBox.style.left = `${startX}px`
    snipBox.style.top = `${startY}px`
    snipBox.style.width = '0px'
    snipBox.style.height = '0px'
    overlay.appendChild(snipBox)
  }

  function onMouseMove(e) {
    if (!isSelecting || !snipBox) return
    const currentX = e.clientX
    const currentY = e.clientY

    const left = Math.min(startX, currentX)
    const top = Math.min(startY, currentY)
    const width = Math.abs(currentX - startX)
    const height = Math.abs(currentY - startY)

    snipBox.style.left = `${left}px`
    snipBox.style.top = `${top}px`
    snipBox.style.width = `${width}px`
    snipBox.style.height = `${height}px`
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      cleanup()
      sidebarFrame?.contentWindow?.postMessage({ type: 'shield:snip-cancelled' }, '*')
    }
  }

  async function onMouseUp(e) {
    if (!isSelecting) return
    isSelecting = false

    const endX = e.clientX
    const endY = e.clientY
    const rect = {
      x: Math.min(startX, endX),
      y: Math.min(startY, endY),
      width: Math.abs(endX - startX),
      height: Math.abs(endY - startY),
    }

    cleanup()

    // Minimum sensible area
    if (rect.width < 15 || rect.height < 15) {
      sidebarFrame?.contentWindow?.postMessage({ type: 'shield:snip-cancelled' }, '*')
      return
    }

    // Capture context text within coordinates
    let extractedText = ''
    try {
      const elements = document.elementsFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
      for (const el of elements) {
        if (el.id?.startsWith('shield-')) continue
        const text = el.innerText?.trim()
        if (text && text.length > extractedText.length && text.length < 5000) {
          extractedText = text
        }
      }
    } catch {
      // fallback
    }

    // Request tab screenshot from background
    chrome.runtime.sendMessage({ type: 'shield:capture-viewport' }, (response) => {
      if (!response?.dataUrl) {
        sidebarFrame?.contentWindow?.postMessage({
          type: 'shield:snip-error',
          error: response?.error || 'Failed to capture screen area.',
        }, '*')
        return
      }

      // Crop the screenshot to the selection box
      const img = new Image()
      img.onload = () => {
        const dpr = window.devicePixelRatio || 1
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(rect.width * dpr)
        canvas.height = Math.round(rect.height * dpr)
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.drawImage(
          img,
          Math.round(rect.x * dpr),
          Math.round(rect.y * dpr),
          Math.round(rect.width * dpr),
          Math.round(rect.height * dpr),
          0,
          0,
          canvas.width,
          canvas.height
        )

        const croppedDataUrl = canvas.toDataURL('image/png')
        sidebarFrame?.contentWindow?.postMessage({
          type: 'shield:snip-result',
          image: croppedDataUrl,
          text: extractedText,
          url: window.location.href,
          width: rect.width,
          height: rect.height,
        }, '*')
      }
      img.src = response.dataUrl
    })
  }

  function cleanup() {
    overlay.removeEventListener('mousedown', onMouseDown)
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
    window.removeEventListener('keydown', onKeyDown)
    overlay.remove()
  }

  overlay.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('keydown', onKeyDown)
  document.documentElement.appendChild(overlay)
}

// Window messages from iframe sidebar
window.addEventListener('message', (event) => {
  const data = event.data
  if (!data || typeof data !== 'object') return

  if (data.type === 'shield:close-sidebar') {
    toggleSidebar(false)
  } else if (data.type === 'shield:start-snipping') {
    startSnippingTool()
  }
})

// Extension runtime messages
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'shield:toggle-sidebar') {
    toggleSidebar()
    sendResponse({ open: isSidebarOpen })
  } else if (message?.type === 'shield:open-sidebar') {
    toggleSidebar(true)
    sendResponse({ open: true })
  } else if (message?.type === 'shield:close-sidebar') {
    toggleSidebar(false)
    sendResponse({ open: false })
  }
})

// Initialize floating button when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSidebar)
} else {
  initSidebar()
}
