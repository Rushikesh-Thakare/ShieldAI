const form = document.querySelector('#connect-form')
const emailInput = document.querySelector('#email')
const passwordInput = document.querySelector('#password')
const apiInput = document.querySelector('#api-base')
const message = document.querySelector('#connect-message')
const button = document.querySelector('#connect-button')

const saved = await chrome.storage.sync.get(['shieldApiBaseUrl', 'shieldEmail'])
if (typeof saved.shieldApiBaseUrl === 'string') apiInput.value = saved.shieldApiBaseUrl
if (typeof saved.shieldEmail === 'string') emailInput.value = saved.shieldEmail

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  button.disabled = true
  message.textContent = ''
  const apiBase = apiInput.value.trim().replace(/\/+$/, '')
  try {
    const response = await fetch(`${apiBase}/api/extension/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailInput.value.trim(), password: passwordInput.value }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'Could not connect to Shield.')
    if (typeof payload.access_token !== 'string' || typeof payload.refresh_token !== 'string') {
      throw new Error('Shield returned an invalid sign-in session.')
    }
    await chrome.storage.local.set({
      shieldAccessToken: payload.access_token,
      shieldRefreshToken: payload.refresh_token,
    })
    await chrome.storage.sync.set({
      shieldApiBaseUrl: apiBase,
      shieldEmail: emailInput.value.trim(),
    })
    message.className = 'connect-success'
    message.textContent = 'Account connected. You can close this tab and open the Shield extension.'
    passwordInput.value = ''
  } catch (error) {
    message.className = 'connect-error'
    message.textContent = error instanceof Error ? error.message : 'Could not connect to Shield.'
  } finally {
    button.disabled = false
  }
})
