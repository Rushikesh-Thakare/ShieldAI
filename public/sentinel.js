/**
 * SENTINEL // Autonomous AI Threat Intelligence Platform
 * Client Application Logic
 */

(() => {
  // DOM Elements Selector Helper
  const $ = (id) => document.getElementById(id);
  const GAUGE_ARC_LENGTH = 298.45; // PI * R (95)

  // Internal State
  const state = {
    activeTab: 'text',
    qrBase64: null,
    qrFileName: '',
    lastResult: null,
    lastAnalyzedText: '',
    isScanning: false,
    samples: null,
    supabase: null,
    user: null,
    session: null,
    authToken: null,
    historyScans: [],
    authMode: 'signin',
  };

  // Helper: Escape HTML strings to prevent XSS
  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, (tag) => {
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return map[tag] || tag;
    });
  }

  // Toast System
  let toastTimeout;
  function showToast(title, message, type = 'info') {
    const toast = $('soc-toast');
    const titleEl = $('toast-title');
    const msgEl = $('toast-msg');
    const iconBox = $('toast-icon-box');

    titleEl.textContent = title;
    msgEl.textContent = message;

    if (type === 'error') {
      iconBox.className = 'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-rose-500/20 text-rose-400 border border-rose-500/30';
      iconBox.innerHTML = '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    } else if (type === 'success') {
      iconBox.className = 'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      iconBox.innerHTML = '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
    } else {
      iconBox.className = 'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30';
      iconBox.innerHTML = '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    }

    toast.classList.remove('translate-y-20', 'opacity-0');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.add('translate-y-20', 'opacity-0');
    }, 3800);
  }

  // Clipboard Helper
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const tempTextArea = document.createElement('textarea');
      tempTextArea.value = text;
      document.body.appendChild(tempTextArea);
      tempTextArea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(tempTextArea);
      return success;
    }
  }

  // Draw Decorative Gauge Ticks
  function renderGaugeTicks() {
    const ticksGroup = $('gauge-tick-marks');
    if (!ticksGroup) return;

    for (let i = 0; i <= 10; i++) {
      const angle = Math.PI - (i / 10) * Math.PI;
      const rOuter = 82;
      const rInner = i % 5 === 0 ? 72 : 76;

      const x1 = 120 + rOuter * Math.cos(angle);
      const y1 = 125 - rOuter * Math.sin(angle);
      const x2 = 120 + rInner * Math.cos(angle);
      const y2 = 125 - rInner * Math.sin(angle);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1.toFixed(1));
      line.setAttribute('y1', y1.toFixed(1));
      line.setAttribute('x2', x2.toFixed(1));
      line.setAttribute('y2', y2.toFixed(1));
      ticksGroup.appendChild(line);
    }
  }

  // Update SVG Precision Gauge
  function updateGauge(score) {
    const arc = $('gauge-needle-arc');
    const scoreVal = $('gauge-numeric-score');
    const statusVal = $('gauge-risk-status');
    const ambient = $('radar-glow-ambient');
    const gradePill = $('threat-grade-pill');

    const safeScore = Math.max(0, Math.min(100, Math.round(score)));
    const offset = GAUGE_ARC_LENGTH * (1 - safeScore / 100);

    let color = '#10b981';
    let statusText = 'BENIGN / LOW RISK';
    let gradeText = 'CLEAN';
    let gradeBg = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    let glowColor = 'bg-emerald-500/20';

    if (safeScore >= 70) {
      color = '#ef4444';
      statusText = 'CRITICAL / VERIFIED PHISHING';
      gradeText = 'CRITICAL';
      gradeBg = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      glowColor = 'bg-rose-500/25';
    } else if (safeScore >= 35) {
      color = '#f59e0b';
      statusText = 'ELEVATED / SUSPICIOUS PATTERNS';
      gradeText = 'ELEVATED';
      gradeBg = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      glowColor = 'bg-amber-500/20';
    }

    arc.style.stroke = color;
    arc.style.strokeDashoffset = offset.toFixed(2);
    statusVal.textContent = statusText;
    statusVal.style.color = color;
    gradePill.textContent = gradeText;
    gradePill.className = `text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${gradeBg}`;
    ambient.className = `absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${glowColor}`;

    // Smooth count-up animation for numeric score
    const currentScore = parseInt(scoreVal.textContent, 10) || 0;
    const duration = 1200;
    const start = performance.now();

    function animateScore(now) {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      const easeOutQuad = 1 - (1 - progress) * (1 - progress);
      const val = Math.round(currentScore + (safeScore - currentScore) * easeOutQuad);

      scoreVal.textContent = val;
      if (progress < 1) {
        requestAnimationFrame(animateScore);
      }
    }
    requestAnimationFrame(animateScore);
  }

  function resetGauge() {
    const arc = $('gauge-needle-arc');
    arc.style.stroke = '#64748b';
    arc.style.strokeDashoffset = GAUGE_ARC_LENGTH.toString();
    $('gauge-numeric-score').textContent = '--';
    $('gauge-risk-status').textContent = 'Analyzing Vector...';
    $('gauge-risk-status').style.color = '#94a3b8';
    $('threat-grade-pill').textContent = 'SCANNING';
    $('threat-grade-pill').className = 'text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 animate-pulse';
  }

  // Tab Navigation Handling
  function initTabs() {
    const tabs = ['text', 'url', 'qr'];
    tabs.forEach((tab) => {
      const btn = $(`tab-${tab}`);
      btn.addEventListener('click', () => {
        state.activeTab = tab;
        tabs.forEach((t) => {
          const tBtn = $(`tab-${t}`);
          const panel = $(`panel-${t}`);
          const isSelected = t === tab;

          tBtn.setAttribute('aria-selected', isSelected.toString());
          if (isSelected) {
            tBtn.className = 'tab-selected px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 transition';
            panel.classList.remove('hidden');
          } else {
            tBtn.className = 'text-slate-400 hover:text-white px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 transition';
            panel.classList.add('hidden');
          }
        });
        updatePayloadMeta();
      });
    });

    $('input-text').addEventListener('input', updatePayloadMeta);
    $('input-url').addEventListener('input', updatePayloadMeta);
  }

  function updatePayloadMeta() {
    const meta = $('payload-meta');
    if (!meta) return;

    if (state.activeTab === 'text') {
      const chars = $('input-text').value.length;
      meta.textContent = `${chars} characters`;
    } else if (state.activeTab === 'url') {
      const chars = $('input-url').value.length;
      meta.textContent = `${chars} chars in URL`;
    } else {
      meta.textContent = state.qrFileName ? state.qrFileName : 'No image loaded';
    }
  }

  // QR Upload & File Handling
  function initQRHandling() {
    const fileInput = $('input-qr-file');
    const dropzone = $('qr-dropzone');
    const previewContainer = $('qr-preview-container');
    const dropPrompt = $('qr-drop-prompt');
    const previewImg = $('qr-preview-img');
    const fileDetails = $('qr-file-details');
    const removeBtn = $('qr-remove-btn');

    dropzone.addEventListener('click', () => fileInput.click());

    function processImageFile(file) {
      if (!file || !file.type.startsWith('image/')) {
        showToast('Invalid File Type', 'Please upload a valid image (PNG, JPEG, WEBP).', 'error');
        return;
      }
      if (file.size > 12 * 1024 * 1024) {
        showToast('File Too Large', 'Image exceeds the 12MB limit.', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        state.qrBase64 = e.target.result;
        state.qrFileName = file.name || 'uploaded_qr.png';

        previewImg.src = state.qrBase64;
        fileDetails.textContent = `${state.qrFileName} (${(file.size / 1024).toFixed(1)} KB)`;

        dropPrompt.classList.add('hidden');
        previewContainer.classList.remove('hidden');
        updatePayloadMeta();
        showToast('Image Loaded', `Ready to decode: ${state.qrFileName}`, 'info');
      };
      reader.readAsDataURL(file);
    }

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) processImageFile(file);
    });

    // Drag and Drop listeners
    ['dragenter', 'dragover'].forEach((eventName) => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('drop-highlight');
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('drop-highlight');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) processImageFile(file);
    });

    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.qrBase64 = null;
      state.qrFileName = '';
      fileInput.value = '';
      previewImg.src = '';
      previewContainer.classList.add('hidden');
      dropPrompt.classList.remove('hidden');
      updatePayloadMeta();
    });

    // Global Clipboard Paste (Ctrl+V) for images anywhere on the page
    window.addEventListener('paste', (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (const item of items) {
        if (item.type.indexOf('image') === 0) {
          const file = item.getAsFile();
          $('tab-qr').click();
          processImageFile(file);
          break;
        }
      }
    });
  }

  // Load and Bind Sample Presets
  async function initSamplePresets() {
    try {
      const res = await fetch('/api/samples');
      if (res.ok) {
        state.samples = await res.json();
      }
    } catch {
      // Offline fallback sample definitions
      state.samples = {
        bank_kyc: {
          content: `[ALERT] Dear HDFC Bank Customer,\nYour net banking and debit card access has been suspended today due to overdue KYC documentation.\nTo restore access within 24 hours and avoid a permanent penalty fee of Rs 1,500, authenticate your PAN and Aadhaar identity immediately at: https://bit.ly/hdfc-kyc-verify-2024\n\nDo not disclose your 6-digit OTP to anyone unless requested by our automated verification executive calling you now.\n- HDFC Anti-Fraud Department`,
        },
        delivery_scam: {
          content: `DHL Express: Package #DH-8849201-US has been withheld at local customs due to unpaid import duty of $2.45 USD. Failure to remit payment within 12 hours will result in automatic return of goods to shipper. Clear package here: http://dhl-express-customs.top/pay/trace`,
        },
        ceo_giftcard: {
          content: `From: CEO <david.miller.office@corp-executive-mail.xyz>\nTo: finance-team@company.internal\nSubject: CONFIDENTIAL: Urgent Vendor Acquisition Request\n\nHi, I am currently boarding an international flight and have limited cellular connection. We need to settle a confidential vendor milestone immediately before end-of-day. Please procure 10x $200 Apple Gift Cards and email the activation codes directly to this address. Mark it under executive petty expense. Do not discuss this with other team members until announced.`,
        },
        legit_notice: {
          content: `Internal IT Ops Notice: The single sign-on (SSO) gateway will undergo scheduled maintenance this Saturday between 02:00 UTC and 04:00 UTC. No password resets or account updates are required. Contact the internal helpdesk at helpdesk@company.com if you experience login anomalies following the maintenance window.`,
        },
      };
    }

    document.querySelectorAll('.sample-preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.sample;
        if (state.samples && state.samples[key]) {
          $('tab-text').click();
          $('input-text').value = state.samples[key].content;
          updatePayloadMeta();
          showToast('Sample Loaded', `Loaded template: ${btn.textContent.trim()}`, 'info');
        }
      });
    });
  }

  // Health Telemetry Sync
  async function initTelemetryPolling() {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        const gStatus = $('header-gemini-status');
        const vtStatus = $('header-vt-status');
        const sbStatus = $('header-sb-status');

        if (data.integrations?.gemini_ai) {
          gStatus.textContent = 'ONLINE';
          gStatus.className = 'text-emerald-400 font-semibold';
        } else {
          gStatus.textContent = 'OFFLINE';
          gStatus.className = 'text-rose-400 font-semibold';
        }

        if (data.integrations?.virustotal_v3) {
          vtStatus.textContent = 'SYNCED';
          vtStatus.className = 'text-emerald-400 font-semibold';
        } else {
          vtStatus.textContent = 'UNCONFIGURED';
          vtStatus.className = 'text-amber-400 font-semibold';
        }

        if (data.integrations?.google_safe_browsing_v4) {
          sbStatus.textContent = 'ACTIVE';
          sbStatus.className = 'text-emerald-400 font-semibold';
        } else {
          sbStatus.textContent = 'UNCONFIGURED';
          sbStatus.className = 'text-amber-400 font-semibold';
        }
      }
    } catch {
      // Non-fatal
    }
  }

  // Pipeline Execution Progress Visualizer
  let pipelineTimer = null;
  function startPipelineAnimation() {
    const feed = $('pipeline-live-feed');
    feed.classList.remove('hidden');

    const steps = ['pipe-step-1', 'pipe-step-2', 'pipe-step-3', 'pipe-step-4'];
    steps.forEach((id) => {
      const step = $(id);
      step.className = 'flex items-center gap-2.5 text-slate-600 transition';
      step.querySelector('.pipe-bullet').className = 'pipe-bullet w-1.5 h-1.5 rounded-full bg-slate-600';
    });

    let currentStep = 0;
    function advanceStep() {
      if (currentStep < steps.length) {
        const step = $(steps[currentStep]);
        step.className = 'flex items-center gap-2.5 text-cyan-300 font-semibold transition';
        const bullet = step.querySelector('.pipe-bullet');
        bullet.className = 'pipe-bullet w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping';

        // Set previous steps to completed
        for (let j = 0; j < currentStep; j++) {
          const prev = $(steps[j]);
          prev.className = 'flex items-center gap-2.5 text-emerald-400/90 transition';
          prev.querySelector('.pipe-bullet').className = 'pipe-bullet w-1.5 h-1.5 rounded-full bg-emerald-400';
        }
        currentStep++;
      }
    }

    advanceStep();
    pipelineTimer = setInterval(advanceStep, 950);
  }

  function stopPipelineAnimation() {
    clearInterval(pipelineTimer);
    $('pipeline-live-feed').classList.add('hidden');
  }

  // Execution: Submit Threat Scan
  async function executeScan() {
    if (state.isScanning) return;

    let payloadType = state.activeTab;
    let payloadContent = '';

    if (payloadType === 'text') {
      payloadContent = $('input-text').value.trim();
      if (!payloadContent) {
        showToast('Empty Payload', 'Please paste text or email content to scan.', 'error');
        $('input-text').focus();
        return;
      }
    } else if (payloadType === 'url') {
      payloadContent = $('input-url').value.trim();
      if (!payloadContent) {
        showToast('Missing URL', 'Please enter a target URL to investigate.', 'error');
        $('input-url').focus();
        return;
      }
    } else {
      payloadType = 'image_base64';
      payloadContent = state.qrBase64;
      if (!payloadContent) {
        showToast('Missing QR Code', 'Please upload or paste a QR code image to decode.', 'error');
        return;
      }
    }

    // Set UI to Scanning state
    state.isScanning = true;
    $('scan-submit-btn').disabled = true;
    $('scan-btn-icon').classList.add('hidden');
    $('scan-btn-spinner').classList.remove('hidden');
    $('scan-btn-label').textContent = 'INVESTIGATING THREAT VECTOR...';
    $('qr-hologram-scan')?.classList.remove('hidden');

    resetGauge();
    startPipelineAnimation();

    // Close any previous action drawers
    $('stall-reply-container').classList.add('hidden');
    $('abuse-report-container').classList.add('hidden');

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (state.authToken) {
        headers['Authorization'] = `Bearer ${state.authToken}`;
      }

      const response = await fetch('/api/scan', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type: payloadType,
          content: payloadContent,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Investigation failed with HTTP ${response.status}`);
      }

      state.lastResult = data;
      state.lastAnalyzedText = data.analyzed_text;

      renderInvestigationResults(data);
      showToast('Investigation Complete', `Threat score: ${data.analysis.risk_score}/100`, data.analysis.risk_score >= 70 ? 'error' : 'success');

      // Silently refresh history drawer if logged in
      if (state.authToken) {
        fetchScanHistory(false);
      }

      // Silently refresh Live Cyber Threat Radar
      fetchTrendingThreats(false);
    } catch (err) {
      console.error('[Scan Execution Error]:', err);
      showToast('Scan Error', err.message, 'error');
      $('gauge-risk-status').textContent = 'Scan Interrupted';
      $('gauge-risk-status').style.color = '#ef4444';
      $('threat-grade-pill').textContent = 'FAILED';
      $('threat-grade-pill').className = 'text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30';
    } finally {
      state.isScanning = false;
      $('scan-submit-btn').disabled = false;
      $('scan-btn-icon').classList.remove('hidden');
      $('scan-btn-spinner').classList.add('hidden');
      $('scan-btn-label').textContent = 'INITIATE THREAT HUNT';
      $('qr-hologram-scan')?.classList.add('hidden');
      stopPipelineAnimation();
    }
  }

  // Visual Anatomy Highlighting Engine
  function buildVisualAnatomyHtml(sourceText, highlights = []) {
    if (!sourceText) return '<span class="text-slate-500 font-mono italic">No text content available.</span>';
    if (!highlights || highlights.length === 0) {
      return escapeHtml(sourceText);
    }

    // Step 1: Collect all occurrences of each highlight string
    const matchRanges = [];
    highlights.forEach((h, hlIndex) => {
      if (!h.text || typeof h.text !== 'string') return;
      let startIndex = 0;
      let foundIndex;
      while ((foundIndex = sourceText.indexOf(h.text, startIndex)) !== -1) {
        matchRanges.push({
          start: foundIndex,
          end: foundIndex + h.text.length,
          highlight: h,
          index: hlIndex,
        });
        startIndex = foundIndex + h.text.length;
      }
    });

    // Step 2: Sort matches by starting index, prioritize longer matches
    matchRanges.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

    // Step 3: De-conflict overlapping intervals
    const nonOverlapping = [];
    let currentLimit = -1;
    for (const match of matchRanges) {
      if (match.start >= currentLimit) {
        nonOverlapping.push(match);
        currentLimit = match.end;
      }
    }

    // Step 4: Reconstruct escaped HTML string with <mark> tags
    let outputHtml = '';
    let cursor = 0;

    for (const match of nonOverlapping) {
      // Append preceding unhighlighted text
      outputHtml += escapeHtml(sourceText.slice(cursor, match.start));

      const category = match.highlight.category || 'blue';
      const markClass = category === 'yellow' ? 'hl-yellow' : category === 'red' ? 'hl-red' : 'hl-blue';
      const categoryLabel = category === 'yellow' ? 'URGENCY' : category === 'red' ? 'MALICIOUS LINK' : 'SOCIAL ENG.';

      const tooltipText = `${categoryLabel}: ${match.highlight.reason || 'Suspicious indicator'}`;

      outputHtml += `<mark class="${markClass}" data-hl-id="${match.index}" title="${escapeHtml(tooltipText)}">${escapeHtml(sourceText.slice(match.start, match.end))}</mark>`;
      cursor = match.end;
    }

    // Append remaining text
    outputHtml += escapeHtml(sourceText.slice(cursor));
    return outputHtml;
  }

  // Render Full Threat Investigation Results
  function renderInvestigationResults(data) {
    const analysis = data.analysis;
    const telemetry = data.telemetry;

    // 1. Update Precision Gauge & Risk Status
    updateGauge(analysis.risk_score);

    // 2. Verdict Banner
    $('verdict-threat-type').textContent = analysis.threat_type;

    const brandBadge = $('verdict-brand-badge');
    if (analysis.impersonated_brand) {
      brandBadge.textContent = `SPOOFING: ${analysis.impersonated_brand}`;
      brandBadge.classList.remove('hidden');
    } else {
      brandBadge.classList.add('hidden');
    }

    $('verdict-recommended-action').textContent = analysis.recommended_action;
    $('verdict-summary').textContent = analysis.summary;

    // Verdict Edge Color
    const edge = $('verdict-status-edge');
    const iconContainer = $('verdict-icon-container');
    if (analysis.risk_score >= 70) {
      edge.className = 'absolute inset-y-0 left-0 w-2 bg-rose-500 shadow-[0_0_15px_#f43f5e]';
      iconContainer.className = 'w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0';
      iconContainer.innerHTML = '<svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    } else if (analysis.risk_score >= 35) {
      edge.className = 'absolute inset-y-0 left-0 w-2 bg-amber-500 shadow-[0_0_15px_#f59e0b]';
      iconContainer.className = 'w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0';
      iconContainer.innerHTML = '<svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    } else {
      edge.className = 'absolute inset-y-0 left-0 w-2 bg-emerald-500 shadow-[0_0_15px_#10b981]';
      iconContainer.className = 'w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0';
      iconContainer.innerHTML = '<svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>';
    }

    // Engine Tags
    $('telemetry-engine-tag').textContent = `Engine: ${telemetry.ai_engine || 'Gemini Flash'}`;
    $('telemetry-latency-tag').textContent = `Investigation: ${(telemetry.execution_time_ms / 1000).toFixed(2)}s`;

    // Red Flags Cloud
    const flagsContainer = $('verdict-red-flags-container');
    if (analysis.red_flags && analysis.red_flags.length > 0) {
      flagsContainer.innerHTML = analysis.red_flags
        .map((flag) => `<span class="px-3 py-1 rounded-lg text-xs font-mono bg-white/[0.04] border border-white/10 text-slate-300 flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span>${escapeHtml(flag)}</span>`)
        .join('');
      flagsContainer.classList.remove('hidden');
    } else {
      flagsContainer.innerHTML = '';
      flagsContainer.classList.add('hidden');
    }

    // 3. QR Decoded Banner (if QR code scanned)
    const qrBanner = $('decoded-qr-banner');
    if (telemetry.decoded_qr) {
      $('decoded-qr-text').textContent = telemetry.decoded_qr;
      qrBanner.classList.remove('hidden');
    } else {
      qrBanner.classList.add('hidden');
    }

    // 4. Visual Anatomy Highlighter
    const highlights = analysis.inline_highlights || [];
    $('visual-anatomy-view').innerHTML = buildVisualAnatomyHtml(data.analyzed_text, highlights);

    // 5. Highlight Breakdown List
    const breakdownList = $('highlights-breakdown-list');
    if (highlights.length > 0) {
      breakdownList.innerHTML = highlights
        .map((h, idx) => {
          const cat = h.category || 'blue';
          const catBadge = cat === 'yellow'
            ? '<span class="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-yellow-400/20 text-yellow-300 border border-yellow-400/30">URGENCY</span>'
            : cat === 'red'
            ? '<span class="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">MALICIOUS LINK</span>'
            : '<span class="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">SOCIAL ENG.</span>';

          return `
            <div data-hl-target="${idx}" class="p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 cursor-pointer transition flex items-start gap-3 group">
              <div class="shrink-0 mt-0.5">${catBadge}</div>
              <div class="text-xs">
                <p class="font-mono text-slate-200 font-semibold group-hover:text-cyan-300 transition">"${escapeHtml(h.text)}"</p>
                <p class="text-slate-400 text-[11px] mt-0.5">${escapeHtml(h.reason)}</p>
              </div>
            </div>`;
        })
        .join('');

      // Add click listener to jump & pulse corresponding mark
      breakdownList.querySelectorAll('[data-hl-target]').forEach((item) => {
        item.addEventListener('click', () => {
          const targetId = item.dataset.hlTarget;
          const mark = document.querySelector(`#visual-anatomy-view mark[data-hl-id="${targetId}"]`);
          if (mark) {
            mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
            mark.animate([
              { transform: 'scale(1)', filter: 'brightness(2)' },
              { transform: 'scale(1.05)', filter: 'brightness(2.5)' },
              { transform: 'scale(1)', filter: 'brightness(1)' },
            ], { duration: 600 });
          }
        });
      });
    } else {
      breakdownList.innerHTML = '<p class="text-xs font-mono text-emerald-400">Zero manipulative or coercive language patterns detected.</p>';
    }

    // 6. Infrastructure & URL Telemetry Cards
    const urlContainer = $('url-telemetry-container');
    const inspectedUrls = telemetry.urls_inspected || [];
    $('urls-count-badge').textContent = `${inspectedUrls.length} Link${inspectedUrls.length === 1 ? '' : 's'}`;

    if (inspectedUrls.length > 0) {
      urlContainer.innerHTML = inspectedUrls.map(renderUrlTelemetryCard).join('');
    } else {
      urlContainer.innerHTML = `
        <div class="rounded-xl bg-black/40 border border-white/5 p-6 text-center space-y-2">
          <svg class="w-8 h-8 text-slate-600 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
          </svg>
          <p class="text-xs font-mono text-slate-400">No outbound hyperlinks or network URLs identified in payload.</p>
        </div>`;
    }

    // Reveal Results Command Center & Smooth Scroll
    $('results-command-center').classList.remove('hidden');
    setTimeout(() => {
      $('results-command-center').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }

  // Render a Single URL Telemetry Card
  function renderUrlTelemetryCard(report) {
    const vt = report.virustotal || {};
    const sbMatches = report.safe_browsing_matches || [];
    let host = report.final;
    try {
      host = new URL(report.final).hostname;
    } catch {}

    // VirusTotal Badge
    let vtSummaryHtml = '';
    if (vt.status === 'analyzed') {
      const isMalicious = (vt.malicious || 0) > 0;
      const vtBadgeClass = isMalicious
        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';

      const total = vt.total_engines || (vt.malicious + vt.suspicious + vt.harmless + vt.undetected) || 1;
      const malPct = ((vt.malicious || 0) / total) * 100;
      const susPct = ((vt.suspicious || 0) / total) * 100;
      const safePct = ((vt.harmless || 0) / total) * 100;

      vtSummaryHtml = `
        <div class="space-y-2 pt-2 border-t border-white/5">
          <div class="flex items-center justify-between text-xs font-mono">
            <span class="text-slate-400">VirusTotal Detection Ratio:</span>
            <span class="font-bold px-2 py-0.5 rounded border ${vtBadgeClass}">
              ${vt.malicious} / ${total} ENGINES MALICIOUS
            </span>
          </div>

          <!-- Multi-Color Ratio Progress Bar -->
          <div class="h-2 w-full rounded-full bg-white/5 overflow-hidden flex">
            <div style="width: ${malPct}%" class="bg-rose-500"></div>
            <div style="width: ${susPct}%" class="bg-amber-400"></div>
            <div style="width: ${safePct}%" class="bg-emerald-500"></div>
          </div>

          <div class="flex items-center justify-between text-[11px] font-mono text-slate-500">
            <span>Community Votes: <b class="text-rose-400">${vt.votes?.malicious || 0} 👎</b> · <b class="text-emerald-400">${vt.votes?.harmless || 0} 👍</b></span>
            ${vt.permalink ? `<a href="${escapeHtml(vt.permalink)}" target="_blank" rel="noopener noreferrer" class="text-indigo-400 hover:text-indigo-300 underline">View VT Intel →</a>` : ''}
          </div>
        </div>`;
    } else if (vt.status === 'queued') {
      vtSummaryHtml = `
        <div class="pt-2 border-t border-white/5 text-xs font-mono text-amber-300 flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          <span>Queued for first-time VirusTotal engine analysis</span>
        </div>`;
    } else {
      vtSummaryHtml = `
        <div class="pt-2 border-t border-white/5 text-xs font-mono text-slate-500">
          <span>VirusTotal: ${escapeHtml(vt.message || 'Inactive')}</span>
        </div>`;
    }

    // Google Safe Browsing Banner
    let sbHtml = '';
    if (sbMatches.length > 0) {
      sbHtml = `
        <div class="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
          <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/></svg>
          <span>Google Safe Browsing: Match flagged as <b>${escapeHtml(sbMatches.map((m) => m.threatType).join(', '))}</b></span>
        </div>`;
    }

    // Hop-by-hop chain
    let chainHtml = '';
    if (report.chain && report.chain.length > 1) {
      chainHtml = `
        <div class="space-y-1.5 pt-2">
          <p class="text-[11px] font-mono font-semibold text-cyan-400 flex items-center gap-1.5">
            <span>↪ Traced ${report.chain.length - 1} Redirect Hop${report.chain.length > 2 ? 's' : ''}:</span>
          </p>
          <div class="space-y-1 pl-2 border-l border-white/10 font-mono text-[11px]">
            ${report.chain.map((c, i) => `
              <div class="flex items-center gap-2 text-slate-400">
                <span class="text-[10px] px-1.5 py-0.2 rounded bg-white/5 border border-white/10 ${i === report.chain.length - 1 ? 'text-cyan-400 border-cyan-500/30' : 'text-slate-500'}">HTTP ${c.status || 'OK'}</span>
                <span class="truncate max-w-[280px]" title="${escapeHtml(c.url)}">${escapeHtml(c.url)}</span>
              </div>
            `).join('')}
          </div>
        </div>`;
    }

    return `
      <div class="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
        <div>
          <span class="text-[10px] font-mono uppercase tracking-widest text-slate-500">Destination Host</span>
          <p class="font-mono text-sm font-bold text-white break-all">${escapeHtml(host)}</p>
          <p class="font-mono text-xs text-slate-400 break-all mt-0.5">${escapeHtml(report.final)}</p>
        </div>

        ${report.redirected ? chainHtml : ''}
        ${sbHtml}
        ${vtSummaryHtml}
      </div>`;
  }

  // Countermeasure 1: Generate Safe Stall Reply
  async function handleStallReply(strategyOverride) {
    if (!state.lastResult) return;

    if (typeof strategyOverride === 'string' && strategyOverride) {
      state.currentStallStrategy = strategyOverride;
    } else if (!state.currentStallStrategy) {
      state.currentStallStrategy = 'technical_glitch';
    }

    // Update tactic selector pills styling
    document.querySelectorAll('.stall-tactic-btn').forEach((btn) => {
      const isSelected = btn.dataset.strategy === state.currentStallStrategy;
      if (isSelected) {
        btn.className = 'stall-tactic-btn px-2.5 py-0.5 rounded text-[11px] font-semibold bg-purple-500/30 text-purple-200 border border-purple-400/40 transition';
      } else {
        btn.className = 'stall-tactic-btn px-2.5 py-0.5 rounded text-[11px] font-semibold text-slate-400 hover:text-white transition';
      }
    });

    const btn = $('btn-stall-reply');
    const spinner = $('stall-spinner');
    const container = $('stall-reply-container');
    const textEl = $('stall-reply-text');

    btn.disabled = true;
    spinner.classList.remove('hidden');

    try {
      const response = await fetch('/api/stall-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: state.lastAnalyzedText,
          threat_type: state.lastResult.analysis.threat_type,
          impersonated_brand: state.lastResult.analysis.impersonated_brand,
          strategy: state.currentStallStrategy,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to generate stall reply');

      textEl.textContent = data.reply;
      container.classList.remove('hidden');
      container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      showToast('Stall Countermeasure Ready', 'Copy or select an alternate tactic.', 'info');
    } catch (err) {
      showToast('Stall Reply Failed', err.message, 'error');
    } finally {
      btn.disabled = false;
      spinner.classList.add('hidden');
    }
  }

  // Countermeasure 2: Copy Registrar Abuse Report
  function buildAbuseReportTemplate(data) {
    const analysis = data.analysis;
    const telemetry = data.telemetry;
    const primaryUrl = telemetry.urls_inspected && telemetry.urls_inspected[0];
    let host = 'N/A';
    try {
      if (primaryUrl) host = new URL(primaryUrl.final).hostname;
    } catch {}

    const nowIso = new Date().toISOString();

    const urlsBlock = telemetry.urls_inspected?.length
      ? telemetry.urls_inspected.map((u, i) => {
          const vt = u.virustotal || {};
          return `  [Target #${i + 1}]
  Submitted URL : ${u.original}
  Final Target  : ${u.final}
  Redirect Chain: ${u.chain?.length > 1 ? u.chain.map((c) => `[HTTP ${c.status}] ${c.url}`).join(' -> ') : 'Direct (No redirects)'}
  VirusTotal    : ${vt.status === 'analyzed' ? `${vt.malicious} engines malicious / ${vt.total_engines} engines total` : vt.status || 'N/A'}${vt.permalink ? `\n  VT Reference  : ${vt.permalink}` : ''}`;
        }).join('\n\n')
      : '  No direct URLs captured in message artifact.';

    return `To: abuse@<domain-registrar>, abuse@<hosting-provider>
Cc: report@phishing.gov.in, reportphishing@apwg.org
Subject: Urgent Security Incident Takedown: ${analysis.threat_type} (${host})

Dear Abuse & Trust/Safety Team,

I am submitting a formal incident notification regarding malicious infrastructure operating under your network / domain management.

The resource below is actively engaged in ${analysis.threat_type.toLowerCase()}${analysis.impersonated_brand ? `, deceptive impersonation of ${analysis.impersonated_brand}` : ''}.

=== INCIDENT TELEMETRY ===
Timestamp (UTC)   : ${nowIso}
Threat Severity   : ${analysis.risk_score}/100 (${analysis.risk_level.toUpperCase()})
Classification    : ${analysis.threat_type}
Impersonated Brand: ${analysis.impersonated_brand || 'None/Generic'}
Ingestion Vector  : ${telemetry.input_vector === 'image_base64' ? 'Quishing (QR Code)' : telemetry.input_vector === 'url' ? 'Direct Link' : 'Electronic Message'}

=== NETWORK & INFRASTRUCTURE REPORT ===
${urlsBlock}

=== TACTICAL EVIDENCE & FORENSIC SUMMARY ===
Summary:
${analysis.summary}

Observed Red Flags:
${(analysis.red_flags || []).map((f) => `  * ${f}`).join('\n')}

=== RAW ARTIFACT EXCERPT ===
${(data.analyzed_text || '').slice(0, 1200).split('\n').map((l) => '> ' + l).join('\n')}

Please suspend and sinkhole the offending domain/hosting resources in accordance with your Acceptable Use Policies and ICANN abuse obligations.

Respectfully,
Cybersecurity Incident Responder
Sentinel Autonomous Threat Intelligence Platform`;
  }

  function handleCopyAbuseReport() {
    if (!state.lastResult) return;

    const report = buildAbuseReportTemplate(state.lastResult);
    const container = $('abuse-report-container');
    const pre = $('abuse-report-text');

    pre.textContent = report;
    container.classList.remove('hidden');

    copyToClipboard(report).then((success) => {
      if (success) {
        showToast('Abuse Report Copied', 'Incident takedown email copied to clipboard.', 'success');
      } else {
        showToast('Report Generated', 'You can manually copy the report from the box below.', 'info');
      }
    });
  }

  // Countermeasure 3: One-Click SOC Forensic PDF Report (Server-side)
  async function generatePDFReport() {
    if (!state.lastResult) {
      showToast('No Scan Data', 'Please execute or load a threat scan before generating a PDF.', 'warning');
      return;
    }

    try {
      showToast('Generating PDF', 'Creating forensic incident report...', 'info');

      const response = await fetch('/api/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state.lastResult),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sentinel-incident-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showToast('PDF Downloaded', 'Forensic incident report generated successfully.', 'success');
    } catch (err) {
      console.error('[PDF Generation Error]:', err);
      showToast('PDF Generation Failed', err.message || 'Unable to generate PDF report.', 'error');
    }
  }

  // Session Reset
  function resetSession() {
    $('input-text').value = '';
    $('input-url').value = '';
    $('qr-remove-btn')?.click();
    $('tab-text').click();
    updatePayloadMeta();

    $('results-command-center').classList.add('hidden');
    $('stall-reply-container').classList.add('hidden');
    $('abuse-report-container').classList.add('hidden');

    resetGauge();
    state.lastResult = null;
    state.lastAnalyzedText = '';
    showToast('Session Reset', 'Investigation workspace cleared.', 'info');
  }

  // Global Keyboard Shortcuts (Ctrl+Enter to scan)
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      executeScan();
    }
  });

  // Fetch and display trending threats from global threat lake
  async function fetchTrendingThreats() {
    try {
      const res = await fetch('/api/threat-lake/trending');
      if (res.ok) {
        const threats = await res.json();
        const ticker = $('trending-ticker');
        const refreshTime = $('trending-refresh-time');

        if (!threats || threats.length === 0) {
          ticker.innerHTML = '<div class="text-xs text-slate-500 italic py-2">No trending threats reported yet.</div>';
          refreshTime.textContent = 'Updated just now';
          return;
        }

        ticker.innerHTML = threats.map((threat, idx) => {
          const riskColor = threat.latest_risk_score >= 70 ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' :
                           threat.latest_risk_score >= 35 ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                           'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';

          const domain = threat.domain || 'Unknown';
          const count = threat.incident_count || 1;
          const score = threat.latest_risk_score || 0;

          return `
            <div class="flex-shrink-0 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10 hover:border-white/20 transition min-w-[200px]">
              <div class="flex items-center justify-between gap-2 mb-1">
                <span class="text-[10px] font-mono text-slate-400">#${idx + 1}</span>
                <span class="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${riskColor}">${score}/100</span>
              </div>
              <div class="text-xs font-semibold text-slate-200 truncate" title="${escapeHtml(threat.url)}">${escapeHtml(domain)}</div>
              <div class="text-[10px] text-slate-500 mt-0.5">${count} report${count > 1 ? 's' : ''}</div>
            </div>
          `;
        }).join('');

        refreshTime.textContent = `Updated ${new Date().toLocaleTimeString()}`;
      }
    } catch (err) {
      console.warn('[Trending Threats] Failed to fetch:', err.message);
      $('trending-ticker').innerHTML = '<div class="text-xs text-slate-500 italic py-2">Unable to load trending threats.</div>';
    }
  }

  // Fetch and display domain reputation dashboard
  async function fetchDomainReputation() {
    try {
      const res = await fetch('/api/domain-reputation');
      if (res.ok) {
        const data = await res.json();
        const stats = data.summary || {};
        const domains = data.domains || [];

        // Update summary stats
        if ($('stat-total-domains')) $('stat-total-domains').textContent = stats.total_domains_tracked || 0;
        if ($('stat-total-incidents')) $('stat-total-incidents').textContent = stats.total_incidents || 0;
        if ($('stat-avg-risk')) $('stat-avg-risk').textContent = stats.average_risk_score || 0;

        // Update domain list
        const listEl = $('domain-reputation-list');
        if (!domains || domains.length === 0) {
          listEl.innerHTML = '<div class="text-xs text-slate-500 italic py-2">No domain reputation data available.</div>';
          return;
        }

        listEl.innerHTML = domains.map((domain, idx) => {
          const riskColor = domain.latest_risk_score >= 70 ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' :
                           domain.latest_risk_score >= 35 ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                           'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';

          const threatTypes = Array.isArray(domain.threat_types) ? domain.threat_types.slice(0, 2).join(', ') : 'Unknown';

          return `
            <div class="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10 transition">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-[10px] font-mono text-slate-500">#${idx + 1}</span>
                  <span class="text-xs font-semibold text-slate-200 truncate">${escapeHtml(domain.domain)}</span>
                </div>
                <div class="text-[10px] text-slate-500 truncate mt-0.5">${escapeHtml(threatTypes)}</div>
              </div>
              <div class="flex items-center gap-3 ml-3">
                <div class="text-right">
                  <div class="text-[10px] font-mono text-slate-500">Incidents</div>
                  <div class="text-xs font-bold text-white">${domain.incident_count || 0}</div>
                </div>
                <span class="px-2 py-0.5 rounded text-[10px] font-bold font-mono ${riskColor}">${domain.latest_risk_score || 0}/100</span>
              </div>
            </div>
          `;
        }).join('');
      }
    } catch (err) {
      console.warn('[Domain Reputation] Failed to fetch:', err.message);
      $('domain-reputation-list').innerHTML = '<div class="text-xs text-slate-500 italic py-2">Unable to load domain reputation data.</div>';
    }
  }

  // Initialization Bootstrap
  function init() {
    renderGaugeTicks();
    initTabs();
    initQRHandling();
    initSamplePresets();
    initTelemetryPolling();
    fetchTrendingThreats(); // Load trending threats on startup
    fetchDomainReputation(); // Load domain reputation on startup

    $('scan-submit-btn').addEventListener('click', executeScan);
    $('reset-session-btn').addEventListener('click', resetSession);

    // Countermeasures
    $('btn-stall-reply').addEventListener('click', () => handleStallReply());
    $('btn-regen-stall').addEventListener('click', () => handleStallReply());

    document.querySelectorAll('.stall-tactic-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        handleStallReply(btn.dataset.strategy);
      });
    });

    $('btn-copy-stall').addEventListener('click', () => {
      const text = $('stall-reply-text').textContent;
      copyToClipboard(text).then(() => showToast('Copied', 'Stall reply copied to clipboard.', 'success'));
    });

    $('btn-copy-abuse-report').addEventListener('click', handleCopyAbuseReport);
    $('btn-copy-abuse-text').addEventListener('click', () => {
      const text = $('abuse-report-text').textContent;
      copyToClipboard(text).then(() => showToast('Copied', 'Abuse report copied to clipboard.', 'success'));
    });

    $('btn-download-pdf-report')?.addEventListener('click', generatePDFReport);

    // Supabase Auth & Scan History Drawer Listeners
    $('nav-auth-btn')?.addEventListener('click', openAuthModal);
    $('auth-modal-close')?.addEventListener('click', closeAuthModal);
    $('auth-modal-backdrop')?.addEventListener('click', closeAuthModal);
    $('auth-tab-signin')?.addEventListener('click', () => setAuthMode('signin'));
    $('auth-tab-signup')?.addEventListener('click', () => setAuthMode('signup'));
    $('auth-form')?.addEventListener('submit', handleAuthSubmit);
    $('nav-signout-btn')?.addEventListener('click', handleSignOut);

    $('nav-history-btn')?.addEventListener('click', openHistoryDrawer);
    $('history-refresh-btn')?.addEventListener('click', () => fetchScanHistory(true));

    // Refresh trending threats every 5 minutes
    setInterval(fetchTrendingThreats, 5 * 60 * 1000);
    $('history-drawer-close')?.addEventListener('click', closeHistoryDrawer);
    $('history-drawer-backdrop')?.addEventListener('click', closeHistoryDrawer);

    // Export buttons
    $('export-csv-btn')?.addEventListener('click', () => exportHistory('csv'));
    $('export-json-btn')?.addEventListener('click', () => exportHistory('json'));

    // Domain reputation refresh
    $('refresh-domain-reputation')?.addEventListener('click', fetchDomainReputation);

    // Initialize Supabase Auth connection
    initSupabase();

    // Initialize Live Cyber Threat Radar
    initThreatRadar();
  }

  // ==========================================
  // SUPABASE AUTH & SCAN HISTORY SUBSYSTEM
  // ==========================================

  // Initialize Supabase Client dynamically from backend /api/config
  async function initSupabase() {
    try {
      const res = await fetch('/api/config');
      if (!res.ok) return;
      const config = await res.json();

      if (config.supabaseUrl && config.supabaseAnonKey && window.supabase) {
        state.supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
          auth: {
            persistSession: true,
            storageKey: 'sentinel-supabase-auth',
          },
        });

        // Check existing active session
        const { data: { session } } = await state.supabase.auth.getSession();
        if (session && session.user) {
          state.session = session;
          state.user = session.user;
          state.authToken = session.access_token;
          updateAuthUI(session.user);
          fetchScanHistory(false);
        }

        // Listen for Auth changes
        state.supabase.auth.onAuthStateChange((_event, session) => {
          if (session && session.user) {
            state.session = session;
            state.user = session.user;
            state.authToken = session.access_token;
            updateAuthUI(session.user);
          } else {
            state.session = null;
            state.user = null;
            state.authToken = null;
            updateAuthUI(null);
            closeHistoryDrawer();
          }
        });
      }
    } catch (err) {
      console.warn('[Supabase Auth Init]:', err.message);
    }
  }

  // Update Navigation Bar Auth State
  function updateAuthUI(user) {
    const authBtn = $('nav-auth-btn');
    const userPill = $('nav-user-pill');
    const userEmail = $('nav-user-email');
    const historyBtn = $('nav-history-btn');

    if (user) {
      authBtn?.classList.add('hidden');
      userPill?.classList.remove('hidden');
      historyBtn?.classList.remove('hidden');
      if (userEmail) userEmail.textContent = user.email || 'Authenticated';
    } else {
      authBtn?.classList.remove('hidden');
      userPill?.classList.add('hidden');
      historyBtn?.classList.add('hidden');
    }
  }

  // Auth Modal Handlers
  function openAuthModal() {
    const modal = $('auth-modal');
    $('auth-error')?.classList.add('hidden');
    if ($('auth-error')) $('auth-error').textContent = '';
    if ($('auth-email')) $('auth-email').value = '';
    if ($('auth-password')) $('auth-password').value = '';
    setAuthMode('signin');
    modal?.classList.remove('hidden');
    setTimeout(() => $('auth-email')?.focus(), 100);
  }

  function closeAuthModal() {
    $('auth-modal')?.classList.add('hidden');
  }

  function setAuthMode(mode) {
    state.authMode = mode;
    const tabSignin = $('auth-tab-signin');
    const tabSignup = $('auth-tab-signup');
    const submitLabel = $('auth-submit-label');

    if (mode === 'signin') {
      if (tabSignin) tabSignin.className = 'py-2 rounded-lg font-bold transition text-white bg-indigo-600/40 border border-indigo-500/40';
      if (tabSignup) tabSignup.className = 'py-2 rounded-lg font-medium transition text-slate-400 hover:text-white';
      if (submitLabel) submitLabel.textContent = 'Sign In to Sentinel';
    } else {
      if (tabSignup) tabSignup.className = 'py-2 rounded-lg font-bold transition text-white bg-indigo-600/40 border border-indigo-500/40';
      if (tabSignin) tabSignin.className = 'py-2 rounded-lg font-medium transition text-slate-400 hover:text-white';
      if (submitLabel) submitLabel.textContent = 'Create Sentinel Account';
    }
  }

  async function handleAuthSubmit(e) {
    e.preventDefault();
    if (!state.supabase) {
      showToast('Config Error', 'Supabase credentials not configured on server.', 'error');
      return;
    }

    const email = $('auth-email').value.trim();
    const password = $('auth-password').value;
    const errorBox = $('auth-error');
    const spinner = $('auth-submit-spinner');
    const submitBtn = $('auth-submit-btn');

    errorBox?.classList.add('hidden');
    spinner?.classList.remove('hidden');
    if (submitBtn) submitBtn.disabled = true;

    try {
      if (state.authMode === 'signin') {
        const { error } = await state.supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        closeAuthModal();
        showToast('Signed In', `Welcome back, ${email}`, 'success');
        // When a user signs in, reveal a slide-over 'Scan History' drawer on the screen
        openHistoryDrawer();
      } else {
        const { data, error } = await state.supabase.auth.signUp({ email, password });
        if (error) throw error;

        if (data.session) {
          closeAuthModal();
          showToast('Account Created', `Authenticated as ${email}`, 'success');
          openHistoryDrawer();
        } else {
          closeAuthModal();
          showToast('Account Created', 'Please check your email to verify your account or sign in.', 'info');
        }
      }
    } catch (err) {
      if (errorBox) {
        errorBox.textContent = err.message || 'Authentication failed.';
        errorBox.classList.remove('hidden');
      }
    } finally {
      spinner?.classList.add('hidden');
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  async function handleSignOut() {
    if (state.supabase) {
      await state.supabase.auth.signOut();
      showToast('Signed Out', 'You have been logged out of Sentinel.', 'info');
    }
  }

  // Slide-over "Scan History" Drawer
  function openHistoryDrawer() {
    const drawer = $('history-drawer');
    const backdrop = $('history-drawer-backdrop');
    const panel = $('history-drawer-panel');

    if (!drawer) return;
    drawer.classList.remove('hidden');

    setTimeout(() => {
      backdrop?.classList.remove('opacity-0');
      backdrop?.classList.add('opacity-100');
      panel?.classList.remove('translate-x-full');
      panel?.classList.add('translate-x-0');
    }, 10);

    fetchScanHistory(true);
  }

  function closeHistoryDrawer() {
    const drawer = $('history-drawer');
    const backdrop = $('history-drawer-backdrop');
    const panel = $('history-drawer-panel');

    backdrop?.classList.remove('opacity-100');
    backdrop?.classList.add('opacity-0');
    panel?.classList.remove('translate-x-0');
    panel?.classList.add('translate-x-full');

    setTimeout(() => {
      drawer?.classList.add('hidden');
    }, 300);
  }

  // Fetch History from /api/history and Populate Drawer
  async function fetchScanHistory(showLoading = true) {
    if (!state.authToken) {
      return;
    }

    const loadingEl = $('history-loading');
    const emptyEl = $('history-empty');
    const container = $('history-items-container');

    if (showLoading) {
      loadingEl?.classList.remove('hidden');
      emptyEl?.classList.add('hidden');
    }

    try {
      const res = await fetch('/api/history', {
        headers: {
          'Authorization': `Bearer ${state.authToken}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to load history (${res.status})`);
      }

      const raw = await res.json();
      const scans = Array.isArray(raw) ? raw : (raw.scans || []);
      state.historyScans = scans;

      // Update counters
      const countStr = `${scans.length}`;
      if ($('nav-history-count')) $('nav-history-count').textContent = countStr;
      if ($('history-total-count')) $('history-total-count').textContent = `${scans.length} item${scans.length === 1 ? '' : 's'}`;

      loadingEl?.classList.add('hidden');

      if (scans.length === 0) {
        emptyEl?.classList.remove('hidden');
        if (container) container.innerHTML = '';
        return;
      }

      emptyEl?.classList.add('hidden');
      renderHistoryList(scans);

    } catch (err) {
      console.warn('[Fetch History Error]:', err.message);
      loadingEl?.classList.add('hidden');
      if (container && state.historyScans.length === 0) {
        emptyEl?.classList.remove('hidden');
      }
    }
  }

  // Populate History Drawer with Scan Cards
  function renderHistoryList(scans) {
    const container = $('history-items-container');
    if (!container) return;

    container.innerHTML = scans.map((scan, idx) => {
      const score = typeof scan.risk_score === 'number' ? scan.risk_score : 0;
      let badgeBg = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      let borderGlow = 'border-white/10 hover:border-emerald-500/50';

      if (score >= 70) {
        badgeBg = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
        borderGlow = 'border-white/10 hover:border-rose-500/50';
      } else if (score >= 35) {
        badgeBg = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
        borderGlow = 'border-white/10 hover:border-amber-500/50';
      }

      let timeAgo = 'Recently';
      if (scan.created_at) {
        try {
          const diffMs = Date.now() - new Date(scan.created_at).getTime();
          const mins = Math.floor(diffMs / 60000);
          if (mins < 1) timeAgo = 'Just now';
          else if (mins < 60) timeAgo = `${mins}m ago`;
          else {
            const hours = Math.floor(mins / 60);
            if (hours < 24) timeAgo = `${hours}h ago`;
            else timeAgo = new Date(scan.created_at).toLocaleDateString();
          }
        } catch {}
      }

      const vector = (scan.input_vector || 'text').toUpperCase();

      return `
        <div data-history-idx="${idx}" class="history-item-card p-3.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border ${borderGlow} transition cursor-pointer space-y-2 group">
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="text-xs font-bold text-white group-hover:text-cyan-300 transition truncate max-w-[230px]">
                ${escapeHtml(scan.threat_type || 'Threat Scan')}
              </p>
              <div class="flex items-center gap-1.5 mt-0.5">
                <span class="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/5 text-slate-400 border border-white/5">${vector}</span>
                <span class="text-[10px] font-mono text-slate-500">${timeAgo}</span>
              </div>
            </div>
            <div class="text-right shrink-0">
              <span class="text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${badgeBg}">
                ${score}/100
              </span>
            </div>
          </div>

          ${scan.impersonated_brand ? `
            <div class="flex items-center gap-1 text-[10px] font-mono text-rose-400">
              <span>⚠️ Spoofing:</span>
              <span class="font-bold underline">${escapeHtml(scan.impersonated_brand)}</span>
            </div>
          ` : ''}

          <p class="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
            ${escapeHtml(scan.summary || 'Click to load full forensic telemetry into the visual anatomy inspector.')}
          </p>

          <div class="pt-1 flex items-center justify-between text-[10px] font-mono text-cyan-400 opacity-0 group-hover:opacity-100 transition">
            <span>Click to load into inspector</span>
            <span>&rarr;</span>
          </div>
        </div>
      `;
    }).join('');

    // Bind click events to load historical scan into visual anatomy inspector
    container.querySelectorAll('.history-item-card').forEach((card) => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.dataset.historyIdx, 10);
        const scan = state.historyScans[idx];
        if (scan) {
          restoreHistoricalScan(scan);
        }
      });
    });
  }

  // Export scan history as CSV or JSON
  async function exportHistory(format) {
    if (!state.authToken) {
      showToast('Authentication Required', 'Please sign in to export your scan history.', 'warning');
      return;
    }

    try {
      showToast('Exporting...', `Generating ${format.toUpperCase()} export...`, 'info');

      const res = await fetch(`/api/export/history?format=${format}`, {
        headers: {
          'Authorization': `Bearer ${state.authToken}`,
        },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Export failed');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sentinel-history-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showToast('Export Complete', `Scan history exported as ${format.toUpperCase()}.`, 'success');
    } catch (err) {
      console.error('[Export History Error]:', err);
      showToast('Export Failed', err.message || 'Unable to export scan history.', 'error');
    }
  }

  // Restore Historical Scan back into Visual Anatomy Inspector
  function restoreHistoricalScan(scan) {
    const analysis = {
      risk_score: typeof scan.risk_score === 'number' ? scan.risk_score : 0,
      risk_level: scan.risk_level || (scan.risk_score >= 70 ? 'critical' : scan.risk_score >= 35 ? 'elevated' : 'benign'),
      threat_type: scan.threat_type || 'Unknown Threat',
      summary: scan.summary || '',
      impersonated_brand: scan.impersonated_brand || null,
      recommended_action: scan.recommended_action || (scan.risk_score >= 70 ? 'Immediate containment recommended: suspend linked accounts and sinkhole target URLs.' : 'Exercise caution and verify sender through secondary verified channel.'),
      red_flags: Array.isArray(scan.red_flags) ? scan.red_flags : [],
      inline_highlights: Array.isArray(scan.inline_highlights) ? scan.inline_highlights : [],
    };

    const telemetry = scan.telemetry || {
      input_vector: scan.input_vector || 'text',
      execution_time_ms: 720,
      urls_inspected: scan.telemetry?.urls_inspected || [],
      ai_engine: scan.telemetry?.ai_engine || 'Gemini Flash',
    };

    const scanData = {
      analysis,
      telemetry,
      analyzed_text: scan.analyzed_text || scan.summary || '',
    };

    // Update the input tab & textarea content
    if (scan.input_vector === 'url') {
      if ($('input-url')) $('input-url').value = scan.analyzed_text || '';
      $('tab-url')?.click();
    } else {
      if ($('input-text')) $('input-text').value = scan.analyzed_text || '';
      $('tab-text')?.click();
    }

    state.lastResult = scanData;
    state.lastAnalyzedText = scanData.analyzed_text;

    // Load data back into the visual anatomy inspector and command center
    renderInvestigationResults(scanData);
    closeHistoryDrawer();

    showToast('Scan Restored', `Restored ${scan.threat_type} (${analysis.risk_score}/100) into inspector`, 'success');
  }

  // ==========================================
  // LIVE CYBER THREAT RADAR SUBSYSTEM
  // ==========================================

  let radarAutoSyncTimer = null;

  function initThreatRadar() {
    const refreshBtn = $('radar-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        fetchTrendingThreats(true);
      });
    }

    // Initial fetch of trending threats
    fetchTrendingThreats(true);

    // Continuous 30s background sync
    clearInterval(radarAutoSyncTimer);
    radarAutoSyncTimer = setInterval(() => {
      fetchTrendingThreats(false);
    }, 30000);
  }

  async function fetchTrendingThreats(showSpinner = false) {
    const loadingEl = $('radar-loading');
    const emptyEl = $('radar-empty');
    const listEl = $('trending-domains-list');
    const blipsEl = $('radar-blips-container');
    const countEl = $('radar-threat-count');
    const refreshIcon = $('radar-refresh-icon');

    if (showSpinner) {
      refreshIcon?.classList.add('animate-spin');
      if (listEl && listEl.children.length === 0) {
        loadingEl?.classList.remove('hidden');
        emptyEl?.classList.add('hidden');
      }
    }

    try {
      const res = await fetch('/api/threat-lake/trending');
      if (!res.ok) {
        throw new Error(`Threat radar sync error (${res.status})`);
      }

      const threats = await res.json();
      const threatList = Array.isArray(threats) ? threats : [];

      // Update active signals count
      if (countEl) {
        countEl.textContent = `${threatList.length} Active`;
      }

      loadingEl?.classList.add('hidden');

      if (threatList.length === 0) {
        emptyEl?.classList.remove('hidden');
        if (listEl) listEl.innerHTML = '';
        if (blipsEl) blipsEl.innerHTML = '';
        return;
      }

      emptyEl?.classList.add('hidden');
      renderTrendingThreats(threatList);
      renderRadarBlips(threatList);
    } catch (err) {
      console.warn('[Threat Radar Error]:', err.message);
      loadingEl?.classList.add('hidden');
      if (listEl && listEl.children.length === 0) {
        emptyEl?.classList.remove('hidden');
      }
    } finally {
      refreshIcon?.classList.remove('animate-spin');
    }
  }

  function renderTrendingThreats(threats) {
    const listEl = $('trending-domains-list');
    if (!listEl) return;

    listEl.innerHTML = threats.map((item, idx) => {
      let domain = item.domain;
      if (!domain && item.url) {
        try { domain = new URL(item.url).hostname; } catch { domain = item.url; }
      }
      domain = domain || 'unknown-host.net';

      const riskScore = typeof item.latest_risk_score === 'number' ? item.latest_risk_score : 85;
      const threatType = (Array.isArray(item.threat_types) && item.threat_types[0]) || 'Phishing Link';
      const incidentCount = item.incident_count || 1;

      // Color coding based on risk and rank
      let rankBadgeClass = 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.3)]';
      if (idx === 1) rankBadgeClass = 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
      if (idx >= 2) rankBadgeClass = 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30';

      let scoreBadgeClass = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      if (riskScore < 70) scoreBadgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      if (riskScore < 35) scoreBadgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';

      let threatTypeClass = 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      if (threatType.toLowerCase().includes('banking') || threatType.toLowerCase().includes('kyc')) {
        threatTypeClass = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      } else if (threatType.toLowerCase().includes('delivery') || threatType.toLowerCase().includes('smish')) {
        threatTypeClass = 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
      }

      return `
        <div data-radar-idx="${idx}" class="trending-domain-card group p-3.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/10 hover:border-cyan-500/40 transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative cursor-pointer">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center font-mono font-extrabold text-xs shrink-0 ${rankBadgeClass}">
              #${idx + 1}
            </div>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-mono font-bold text-white text-xs sm:text-sm group-hover:text-cyan-300 transition truncate">${escapeHtml(domain)}</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${threatTypeClass}">
                  ${escapeHtml(threatType)}
                </span>
              </div>
              <div class="flex items-center gap-3 text-[11px] font-mono text-slate-400 mt-1">
                <span class="text-rose-400 flex items-center gap-1 font-semibold">
                  <span>🔥</span>
                  <span>${incidentCount} ${incidentCount === 1 ? 'Incident' : 'Reports'}</span>
                </span>
                <span class="text-slate-600 hidden sm:inline">&bull;</span>
                <span class="truncate max-w-[220px] text-slate-500 hidden sm:inline" title="${escapeHtml(item.url || domain)}">${escapeHtml(item.url || domain)}</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2.5 shrink-0 justify-end">
            <span class="text-xs font-mono font-bold px-2.5 py-1 rounded-full border ${scoreBadgeClass}">
              ${riskScore}/100
            </span>
            <button type="button" class="btn-inspect-trending px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 hover:text-cyan-200 border border-cyan-500/30 text-xs font-mono font-semibold transition active:scale-95 flex items-center gap-1.5" data-url="${escapeHtml(item.url || domain)}">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <span>Inspect</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Bind card and inspect button events
    listEl.querySelectorAll('.trending-domain-card').forEach((card) => {
      const idx = card.dataset.radarIdx;

      // Card hover highlights blip on radar scope
      card.addEventListener('mouseenter', () => {
        const blip = document.querySelector(`.radar-blip-item[data-radar-idx="${idx}"]`);
        if (blip) {
          blip.classList.add('scale-150', 'z-30');
          blip.querySelector('.blip-pulse-wave')?.classList.add('bg-cyan-400/60');
        }
      });
      card.addEventListener('mouseleave', () => {
        const blip = document.querySelector(`.radar-blip-item[data-radar-idx="${idx}"]`);
        if (blip) {
          blip.classList.remove('scale-150', 'z-30');
          blip.querySelector('.blip-pulse-wave')?.classList.remove('bg-cyan-400/60');
        }
      });

      // Quick Inspect button
      const inspectBtn = card.querySelector('.btn-inspect-trending');
      inspectBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = inspectBtn.dataset.url;
        loadUrlIntoScanner(url);
      });

      // Card click also triggers quick inspect
      card.addEventListener('click', () => {
        const url = inspectBtn?.dataset.url;
        if (url) loadUrlIntoScanner(url);
      });
    });
  }

  function renderRadarBlips(threats) {
    const blipsContainer = $('radar-blips-container');
    if (!blipsContainer) return;

    blipsContainer.innerHTML = threats.map((item, idx) => {
      let domain = item.domain;
      if (!domain && item.url) {
        try { domain = new URL(item.url).hostname; } catch { domain = item.url; }
      }
      domain = domain || 'threat';

      const riskScore = typeof item.latest_risk_score === 'number' ? item.latest_risk_score : 85;

      // Calculate polar coordinates for tactical scope
      // Distribute across range rings (20% to 75% distance from center)
      const radiusPercent = 20 + ((idx * 13) % 55);
      // Distribute evenly around the 360 circle with offsets
      const angles = [42, 125, 215, 305, 170];
      const angleDeg = angles[idx % angles.length];
      const rad = (angleDeg * Math.PI) / 180;

      const x = 50 + radiusPercent * Math.cos(rad);
      const y = 50 + radiusPercent * Math.sin(rad);

      let blipCoreColor = 'bg-rose-500 shadow-[0_0_12px_#f43f5e]';
      let blipWaveColor = 'bg-rose-500/40';
      if (riskScore < 70) {
        blipCoreColor = 'bg-amber-400 shadow-[0_0_12px_#fbbf24]';
        blipWaveColor = 'bg-amber-400/40';
      }
      if (riskScore < 35) {
        blipCoreColor = 'bg-cyan-400 shadow-[0_0_12px_#22d3ee]';
        blipWaveColor = 'bg-cyan-400/40';
      }

      return `
        <div data-radar-idx="${idx}" class="radar-blip-item absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform duration-200 group" style="left: ${x.toFixed(1)}%; top: ${y.toFixed(1)}%;">
          <!-- Expanding Ping Wave -->
          <div class="blip-pulse-wave absolute -inset-2.5 rounded-full ${blipWaveColor} pointer-events-none"></div>
          <!-- Glowing Blip Node -->
          <div class="relative w-4 h-4 rounded-full ${blipCoreColor} border border-white flex items-center justify-center text-[9px] font-mono font-black text-black select-none">
            ${idx + 1}
          </div>
          <!-- Tactical Tooltip Hover Popover -->
          <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-30 pointer-events-none whitespace-nowrap">
            <div class="px-2.5 py-1 rounded-lg bg-black/90 border border-cyan-500/40 text-[10px] font-mono text-cyan-200 shadow-2xl backdrop-blur-md">
              <span class="font-bold text-white">#${idx + 1} ${escapeHtml(domain)}</span>
              <span class="text-rose-400 font-bold ml-1.5">${riskScore}/100</span>
            </div>
            <div class="w-1.5 h-1.5 bg-black border-r border-b border-cyan-500/40 transform rotate-45 -mt-1"></div>
          </div>
        </div>
      `;
    }).join('');

    // Bind blip hover & click interactions to cards
    blipsContainer.querySelectorAll('.radar-blip-item').forEach((blip) => {
      const idx = blip.dataset.radarIdx;

      blip.addEventListener('mouseenter', () => {
        const card = document.querySelector(`.trending-domain-card[data-radar-idx="${idx}"]`);
        if (card) {
          card.classList.add('bg-white/[0.08]', 'border-cyan-500/80', 'shadow-[0_0_15px_rgba(6,182,212,0.25)]');
        }
      });

      blip.addEventListener('mouseleave', () => {
        const card = document.querySelector(`.trending-domain-card[data-radar-idx="${idx}"]`);
        if (card) {
          card.classList.remove('bg-white/[0.08]', 'border-cyan-500/80', 'shadow-[0_0_15px_rgba(6,182,212,0.25)]');
        }
      });

      blip.addEventListener('click', () => {
        const card = document.querySelector(`.trending-domain-card[data-radar-idx="${idx}"]`);
        const inspectBtn = card?.querySelector('.btn-inspect-trending');
        const url = inspectBtn?.dataset.url;
        if (url) loadUrlIntoScanner(url);
      });
    });
  }

  // Quick load URL into the scanner workspace
  function loadUrlIntoScanner(url) {
    if (!url) return;
    const tabUrl = $('tab-url');
    const inputUrl = $('input-url');

    if (tabUrl) tabUrl.click();
    if (inputUrl) {
      inputUrl.value = url;
      inputUrl.focus();
      inputUrl.classList.add('ring-2', 'ring-cyan-400', 'border-cyan-400');
      setTimeout(() => {
        inputUrl.classList.remove('ring-2', 'ring-cyan-400', 'border-cyan-400');
      }, 1500);
    }

    // Smoothly scroll up to the Ingestion Grid
    const scannerSection = $('tab-url');
    if (scannerSection) {
      scannerSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    showToast('Loaded Into Scanner', `Target ${url} staged for threat hunt. Press Initiate or Ctrl+Enter.`, 'info');
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
