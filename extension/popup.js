/**
 * Sentinel Threat Scanner — Chrome Extension Popup (MV3)
 *
 * Extracts document.body.innerText from the active browser tab via chrome.scripting.executeScript,
 * submits it to the local Sentinel threat intel API (http://localhost:3000/api/scan),
 * and displays the risk_score, threat_type, and security verdict directly in the popup.
 */

const API_BASE = 'http://localhost:3000';

// Element Selectors
const scanBtn = document.getElementById('scan-btn');
const scanIcon = document.getElementById('scan-icon');
const scanSpinner = document.getElementById('scan-spinner');
const scanLabel = document.getElementById('scan-label');
const statusMsg = document.getElementById('status-msg');
const resultsCard = document.getElementById('results-card');
const errorCard = document.getElementById('error-card');
const scoreValue = document.getElementById('score-value');
const threatTypeEl = document.getElementById('threat-type');
const riskBadge = document.getElementById('risk-badge');
const scoreRing = document.getElementById('score-ring');
const summaryText = document.getElementById('summary-text');
const brandRow = document.getElementById('brand-row');
const brandName = document.getElementById('brand-name');
const flagsContainer = document.getElementById('flags-container');
const latencyTag = document.getElementById('latency-tag');
const errorMsg = document.getElementById('error-msg');
const dashboardLink = document.getElementById('dashboard-link');

/**
 * Toggle UI loading state on the scan button
 */
function setLoading(isLoading) {
  scanBtn.disabled = isLoading;
  scanIcon.classList.toggle('hidden', isLoading);
  scanSpinner.classList.toggle('hidden', !isLoading);
  scanLabel.textContent = isLoading ? 'Analyzing Page…' : 'Scan Active Tab';

  if (isLoading) {
    scanBtn.classList.add('pulse-btn');
  } else {
    scanBtn.classList.remove('pulse-btn');
  }
}

/**
 * Format and style the risk gauge according to severity score
 */
function updateRiskScoreUI(score) {
  scoreValue.textContent = score;

  if (score >= 70) {
    scoreRing.style.borderColor = '#f43f5e';
    scoreRing.style.boxShadow = '0 0 14px rgba(244, 63, 94, 0.45)';
    riskBadge.textContent = 'CRITICAL THREAT';
    riskBadge.style.color = '#fda4af';
    riskBadge.style.borderColor = 'rgba(244, 63, 94, 0.4)';
    riskBadge.style.backgroundColor = 'rgba(244, 63, 94, 0.18)';
  } else if (score >= 35) {
    scoreRing.style.borderColor = '#f59e0b';
    scoreRing.style.boxShadow = '0 0 14px rgba(245, 158, 11, 0.4)';
    riskBadge.textContent = 'ELEVATED RISK';
    riskBadge.style.color = '#fcd34d';
    riskBadge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
    riskBadge.style.backgroundColor = 'rgba(245, 158, 11, 0.18)';
  } else {
    scoreRing.style.borderColor = '#10b981';
    scoreRing.style.boxShadow = '0 0 14px rgba(16, 185, 129, 0.4)';
    riskBadge.textContent = 'BENIGN / SAFE';
    riskBadge.style.color = '#6ee7b7';
    riskBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    riskBadge.style.backgroundColor = 'rgba(16, 185, 129, 0.18)';
  }
}

/**
 * Render scan results returned by the Sentinel backend
 */
function displayScanResults(data) {
  const analysis = data.analysis || {};
  const telemetry = data.telemetry || {};

  // Extract core metrics: risk_score and threat_type
  const riskScore = typeof analysis.risk_score === 'number'
    ? analysis.risk_score
    : (typeof data.risk_score === 'number' ? data.risk_score : 0);

  const threatType = analysis.threat_type || data.threat_type || 'Unknown Threat';

  // Display risk_score and threat_type directly in the popup
  updateRiskScoreUI(riskScore);
  threatTypeEl.textContent = threatType;

  // Display summary and context
  summaryText.textContent = analysis.summary || 'Security assessment completed successfully.';

  // Brand Impersonation
  if (analysis.impersonated_brand) {
    brandName.textContent = analysis.impersonated_brand;
    brandRow.classList.remove('hidden');
  } else {
    brandRow.classList.add('hidden');
  }

  // Red Flags
  const flags = Array.isArray(analysis.red_flags) ? analysis.red_flags : [];
  if (flags.length > 0) {
    flagsContainer.innerHTML = flags
      .slice(0, 4)
      .map((flag) => `<span class="px-2 py-0.5 rounded text-xs font-mono" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: #cbd5e1;">⚠️ ${escapeHtml(flag)}</span>`)
      .join('');
    flagsContainer.classList.remove('hidden');
  } else {
    flagsContainer.classList.add('hidden');
  }

  // Execution Telemetry
  if (telemetry.execution_time_ms) {
    latencyTag.textContent = `${(telemetry.execution_time_ms / 1000).toFixed(1)}s`;
  } else {
    latencyTag.textContent = '';
  }

  // Transition visibility
  resultsCard.classList.remove('hidden');
  errorCard.classList.add('hidden');
  statusMsg.classList.add('hidden');
}

/**
 * Show error card with descriptive explanation
 */
function displayError(message) {
  errorMsg.textContent = message;
  errorCard.classList.remove('hidden');
  resultsCard.classList.add('hidden');
  statusMsg.classList.add('hidden');
}

/**
 * HTML Escaping helper
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Core Scanner Function:
 * 1. Queries the active browser tab.
 * 2. Uses chrome.scripting.executeScript to retrieve document.body.innerText.
 * 3. POSTs the extracted text to http://localhost:3000/api/scan.
 * 4. Displays risk_score and threat_type in the popup.
 */
async function scanActiveTab() {
  setLoading(true);
  resultsCard.classList.add('hidden');
  errorCard.classList.add('hidden');
  statusMsg.textContent = 'Extracting active tab text…';
  statusMsg.classList.remove('hidden');

  try {
    // Verify Chrome Extension API availability
    if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.scripting) {
      throw new Error('Chrome extension scripting API is unavailable. Run this inside an active Chrome browser session.');
    }

    // 1. Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      throw new Error('No active browser tab detected.');
    }

    // Protect against non-injectable chrome internal pages
    if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:'))) {
      throw new Error('Cannot inspect internal browser URLs. Please open a public website or webmail tab.');
    }

    statusMsg.textContent = 'Reading page inner text…';

    // 2. Extract document.body.innerText using chrome.scripting.executeScript
    const executionResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.body.innerText,
    });

    const pageText = executionResults?.[0]?.result;

    if (!pageText || typeof pageText !== 'string' || pageText.trim().length === 0) {
      throw new Error('The active tab does not contain inspectable text content.');
    }

    // Truncate to reasonable payload size (20KB)
    const contentToScan = pageText.trim().slice(0, 20000);

    statusMsg.textContent = 'Submitting to Sentinel Threat Intel API…';

    // 3. Send text via POST request to http://localhost:3000/api/scan
    const response = await fetch(`${API_BASE}/api/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'text',
        content: contentToScan,
      }),
    });

    if (!response.ok) {
      let errorDetail = `Server responded with status ${response.status}`;
      try {
        const errorJson = await response.json();
        if (errorJson.error) errorDetail = errorJson.error;
      } catch {
        // Fall back to status string
      }
      throw new Error(errorDetail);
    }

    const scanData = await response.json();

    // 4. Display the returned risk_score and threat_type directly in the popup
    displayScanResults(scanData);

  } catch (err) {
    console.error('[Sentinel Extension Error]:', err);

    let friendlyMessage = err.message || 'An unexpected error occurred during scan.';
    if (friendlyMessage.includes('Failed to fetch') || friendlyMessage.includes('NetworkError')) {
      friendlyMessage = 'Unable to connect to Sentinel server at http://localhost:3000. Ensure the local server is running (npm run dev).';
    }

    displayError(friendlyMessage);
  } finally {
    setLoading(false);
  }
}

// Attach click event for "Scan Active Tab"
scanBtn.addEventListener('click', scanActiveTab);

// Link that opens the local dashboard in a new tab
if (dashboardLink) {
  dashboardLink.addEventListener('click', (e) => {
    e.preventDefault();
    const targetUrl = 'http://localhost:3000';
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: targetUrl });
    } else {
      window.open(targetUrl, '_blank');
    }
  });
}
