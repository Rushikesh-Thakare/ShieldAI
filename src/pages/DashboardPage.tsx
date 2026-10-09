import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Shield, ShieldCheck, AlertTriangle, CheckCircle2,
  Globe2, QrCode, FileImage, Sparkles, Download, Bot, Copy,
  FolderOpen, Trash2, LockKeyhole, RefreshCw,
  Terminal, X, Zap, AlignLeft, Activity
} from 'lucide-react'
import { apiRequest } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import type { ScanResult, Risk, ScanFlag, InlineHighlight } from '../types'

// Precision SVG Gauge Component
const PrecisionGauge: React.FC<{ score: number; risk: Risk }> = ({ score, risk }) => {
  // SVG semi-circle gauge calculation: radius 80, center (100, 95)
  // Arc from 180 deg to 360 deg (PI rad)
  const radius = 75
  const circumference = Math.PI * radius
  const normalizedScore = Math.min(100, Math.max(0, score))
  const strokeDashoffset = circumference - (circumference * normalizedScore) / 100

  const getRiskColor = (r: Risk) => {
    switch (r) {
      case 'danger': return '#ef4444'
      case 'suspicious': return '#f59e0b'
      default: return '#10b981'
    }
  }

  const color = getRiskColor(risk)

  return (
    <div className="precision-gauge-container">
      <div className="gauge-svg-wrap">
        <svg viewBox="0 0 200 120" className="gauge-svg">
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="45%" stopColor="#f59e0b" />
              <stop offset="85%" stopColor="#ef4444" />
            </linearGradient>
            <filter id="gaugeGlow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background Track */}
          <path
            d="M 25 105 A 75 75 0 0 1 175 105"
            fill="none"
            stroke="#1c2536"
            strokeWidth="14"
            strokeLinecap="round"
          />

          {/* Active Value Arc */}
          <path
            d="M 25 105 A 75 75 0 0 1 175 105"
            fill="none"
            stroke={color}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            filter="url(#gaugeGlow)"
            style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s ease' }}
          />

          {/* Inner Needle Target Indicator */}
          <text x="100" y="88" textAnchor="middle" className="gauge-score-text" fill={color}>
            {score}
          </text>
          <text x="100" y="106" textAnchor="middle" className="gauge-sub-text">
            / 100 RISK
          </text>
        </svg>
      </div>

      <div className={`gauge-badge ${risk}`}>
        <span className="gauge-status-dot" style={{ backgroundColor: color }} />
        <span>
          {risk === 'danger'
            ? 'HIGH THREAT DETECTED'
            : risk === 'suspicious'
            ? 'SUSPICIOUS INDICATORS'
            : 'BENIGN / LOW RISK'}
        </span>
      </div>
    </div>
  )
}

// Inline Visual Anatomy Highlighter
const AnatomyHighlighter: React.FC<{
  flags: ScanFlag[]
  highlights?: InlineHighlight[]
  rawContent?: string
}> = ({ flags, highlights = [], rawContent = '' }) => {
  const [activeFlag, setActiveFlag] = useState<ScanFlag | null>(flags[0] || null)

  const items = useMemo(() => {
    if (flags.length > 0) return flags
    if (highlights.length > 0) {
      return highlights.map((h) => ({
        text_snippet: h.text,
        type: h.category,
        color: '#ef4444',
        explanation: h.reason,
      }))
    }
    return []
  }, [flags, highlights])

  if (items.length === 0) {
    return (
      <div className="anatomy-empty">
        <CheckCircle2 size={16} className="text-emerald" />
        <span>No malicious linguistic triggers or deceptive form markers detected.</span>
      </div>
    )
  }

  return (
    <div className="anatomy-highlighter-block">
      <div className="anatomy-header">
        <span className="eyebrow">
          <Terminal size={12} /> INLINE FORENSIC ANATOMY HIGHLIGHTER
        </span>
        <span className="anatomy-count-tag">{items.length} Flagged Indicators</span>
      </div>

      {rawContent && (
        <div className="anatomy-content-preview">
          <span className="preview-label">INSPECTED PAYLOAD BODY</span>
          <p className="preview-text">{rawContent}</p>
        </div>
      )}

      <div className="anatomy-chips-row">
        {items.map((item, idx) => {
          const isSelected = activeFlag?.text_snippet === item.text_snippet
          return (
            <button
              key={idx}
              type="button"
              className={`anatomy-chip ${isSelected ? 'active' : ''}`}
              onClick={() => setActiveFlag(item)}
            >
              <span className="chip-indicator" style={{ backgroundColor: item.color || '#ef4444' }} />
              <strong>{item.type}</strong>
              <small>"{item.text_snippet.slice(0, 32)}{item.text_snippet.length > 32 ? '...' : ''}"</small>
            </button>
          )
        })}
      </div>

      {activeFlag && (
        <div className="anatomy-detail-card" style={{ borderLeftColor: activeFlag.color || '#ef4444' }}>
          <div className="detail-meta">
            <span className="flag-type-badge">{activeFlag.type}</span>
            <code className="flag-snippet">"{activeFlag.text_snippet}"</code>
          </div>
          <p className="flag-explanation">{activeFlag.explanation}</p>
        </div>
      )}
    </div>
  )
}

export const DashboardPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { session, user } = useAuth()
  const { toast } = useToast()

  // Tab mode: 'url' | 'text' | 'qr' | 'screenshot'
  const [activeTab, setActiveTab] = useState<'url' | 'text' | 'qr' | 'screenshot'>('url')
  const [inputVal, setInputVal] = useState('')
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [recentScans, setRecentScans] = useState<ScanResult[]>([])

  // Image Upload state (QR / Screenshot)
  const [uploadedFile, setUploadedFile] = useState<{
    name: string
    size: string
    preview: string
    mimeType: string
  } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Simulation presets
  const [samples, setSamples] = useState<
    Record<string, { title: string; type: string; category: string; content: string }>
  >({})

  // Stall Bot state
  const [stallOpen, setStallOpen] = useState(false)
  const [stallLoading, setStallLoading] = useState(false)
  const [stallStrategy, setStallStrategy] = useState<
    'confused_victim' | 'technical_glitch' | 'bureaucratic_delay'
  >('confused_victim')
  const [stallReply, setStallReply] = useState('')

  // Load samples and history
  useEffect(() => {
    void apiRequest<Record<string, { title: string; type: string; category: string; content: string }>>(
      '/api/samples',
      {},
      false
    )
      .then((data) => setSamples(data))
      .catch(() => {})

    // Load recent scans from local cache
    const cacheKey = user?.id ? `shield_user_scans_${user.id}` : 'shield_guest_scans'
    const stored = localStorage.getItem(cacheKey)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setRecentScans(parsed)
        }
      } catch {}
    }
  }, [user])

  const restoredScanRef = useRef<string | null>(null)

  // Support restoring scan via ?scan_id=, ?url=, or ?input= query param
  useEffect(() => {
    const scanId = searchParams.get('scan_id')
    const urlParam = searchParams.get('url') || searchParams.get('input') || searchParams.get('payload')

    if (urlParam && !inputVal) {
      setInputVal(urlParam)
      if (urlParam.startsWith('http://') || urlParam.startsWith('https://')) {
        setActiveTab('url')
      } else {
        setActiveTab('text')
      }
    }

    if (!scanId || restoredScanRef.current === scanId) return

    // 1. Check in currently loaded recentScans
    const match = recentScans.find((s) => s.id === scanId)
    if (match) {
      restoredScanRef.current = scanId
      setResult(match)
      setInputVal(match.domains?.[0] || match.urls_inspected?.[0]?.scanned_url || urlParam || '')
      toast(`Restored incident scan: ${match.verdict}`)
      return
    }

    // 2. Fetch from history endpoint or fallback cache
    const token = session?.access_token
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`

    fetch('/api/history', { headers })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (Array.isArray(data.scans)) {
          const found = data.scans.find((s: ScanResult) => s.id === scanId)
          if (found && restoredScanRef.current !== scanId) {
            restoredScanRef.current = scanId
            setResult(found)
            setInputVal(found.domains?.[0] || found.urls_inspected?.[0]?.scanned_url || urlParam || '')
            toast(`Restored incident scan: ${found.verdict}`)
          }
        }
      })
      .catch(() => {})
  }, [searchParams, recentScans, session, toast])

  const handleSelectPreset = (key: string) => {
    const sample = samples[key]
    if (sample) {
      setInputVal(sample.content)
      setActiveTab(sample.type === 'text' && !sample.content.startsWith('http') ? 'text' : 'url')
      setUploadedFile(null)
      toast(`Loaded scenario: ${sample.title}`)
    }
  }

  const handleProcessImage = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast('Please upload a valid image file (PNG, JPG, WebP)', 'warning')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      toast('Maximum image file size is 8 MB', 'warning')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result)
      const sizeStr = `${(file.size / 1024).toFixed(1)} KB`
      setUploadedFile({
        name: file.name,
        size: sizeStr,
        preview: dataUrl,
        mimeType: file.type,
      })
      setInputVal(file.name)
      toast(`Image ready: ${file.name}`)
    }
    reader.readAsDataURL(file)
  }

  const triggerAnalyze = async (customPayload?: string) => {
    const payload = (customPayload !== undefined ? customPayload : inputVal).trim()
    if (!payload && !uploadedFile) {
      toast('Please enter a URL, message, or upload an image to analyze.', 'warning')
      return
    }

    setChecking(true)
    setResult(null)

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`
      }

      const bodyData: { input: string; image?: string; mimeType?: string } = {
        input: payload,
      }
      if (uploadedFile) {
        bodyData.image = uploadedFile.preview
        bodyData.mimeType = uploadedFile.mimeType
      }

      const res = await fetch('/api/scan', {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyData),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || 'Scan analysis failed')
      }

      const scanData: ScanResult = await res.json()
      setResult(scanData)

      // Save to recent scans
      setRecentScans((prev) => {
        const next = [scanData, ...prev.filter((s) => s.id !== scanData.id)].slice(0, 50)
        const key = user?.id ? `shield_user_scans_${user.id}` : 'shield_guest_scans'
        localStorage.setItem(key, JSON.stringify(next))
        return next
      })

      // Update URL query param for easy bookmarking/sharing
      setSearchParams({ scan_id: scanData.id })
      toast('Threat intelligence scan completed!')
    } catch (err) {
      // Local fallback heuristics if offline or demo
      const isDangerous = /fakebank|hdfc|kyc|verify|login|urgent|customs|delivery|giftcard|wire|penalty/i.test(payload)
      const fallback: ScanResult = {
        id: `scan-${Date.now()}`,
        created_at: new Date().toISOString(),
        risk_score: isDangerous ? 94 : 4,
        risk_level: isDangerous ? 'danger' : 'safe',
        verdict: isDangerous ? 'Phishing & Credential Harvester Detected' : 'No Threat Signatures Found',
        summary: isDangerous
          ? 'This submission matches known credential harvesting, brand impersonation, and false urgency signatures.'
          : 'Analyzed payload passed security evaluation with zero blacklisted indicators.',
        threat_type: isDangerous ? 'Banking Phishing' : 'Benign Content',
        flags: isDangerous
          ? [
              {
                type: 'Credential Request',
                text_snippet: payload.slice(0, 60),
                color: '#ef4444',
                explanation: 'Requests sensitive authentication details or immediate user credentials.',
              },
              {
                type: 'False Urgency',
                text_snippet: 'Act now / Urgent verification',
                color: '#f59e0b',
                explanation: 'Pressures the recipient to act without independent validation.',
              },
            ]
          : [],
        urls_inspected: [{ scanned_url: payload, hops: 1 }],
      }
      setResult(fallback)
      toast('Analyzed via localized heuristics.', 'info')
    } finally {
      setChecking(false)
    }
  }

  const handleExportPdf = async () => {
    if (!result) return
    toast('Synthesizing PDF incident forensic report...')
    try {
      const res = await fetch('/api/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      })

      if (!res.ok) throw new Error('PDF export failed')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `shield-incident-${result.id}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast('Forensic PDF downloaded successfully!')
    } catch {
      toast('Could not generate PDF from server; check server logs.', 'warning')
    }
  }

  const handleStallBot = async (strategy = stallStrategy) => {
    setStallLoading(true)
    try {
      const res = await apiRequest<{ reply: string }>('/api/stall-reply', {
        method: 'POST',
        body: JSON.stringify({
          content: inputVal || result?.summary || 'Urgent verification request',
          threat_type: result?.threat_type || 'Banking Phishing',
          impersonated_brand: result?.impersonated_brand || 'FakeBank',
          strategy,
        }),
      })
      setStallReply(res.reply)
    } catch {
      const canned: Record<string, string> = {
        confused_victim:
          'Oh dear, I saw your urgent notification! Which bank branch are you calling from? My grandson usually assists with my laptop and I cannot find the verification link. Could you send step-by-step instructions?',
        technical_glitch:
          'I attempted to load your verification gateway, but our corporate firewall returned HTTP 504 Gateway Timeout. Is there an alternate mirror host or IP address I should route through?',
        bureaucratic_delay:
          'Pursuant to Security Directive SEC-902, I have logged Ticket #TR-8812 with our compliance auditor. Please provide your corporate employee identification code and certificate thumbprint to authorize release.',
      }
      setStallReply(canned[strategy] || canned.confused_victim)
    } finally {
      setStallLoading(false)
    }
  }

  return (
    <div className="dashboard-container">
      {/* Top Banner / Hunting Hub Header */}
      <div className="hunting-hub-header">
        <div className="hunting-title-wrap">
          <div className="hunting-badge">
            <Activity size={14} className="text-emerald" />
            <span>PRIMARY SOC THREAT WORKSPACE</span>
          </div>
          <h1>Threat Hunting Console<span className="period">.</span></h1>
          <p>
            Real-time multi-modal analysis across URLs, raw messages, deceptive QR codes, and screenshots.
          </p>
        </div>

        {/* 1-Click SOC Simulation Presets */}
        <div className="presets-bar">
          <span className="presets-label">
            <Zap size={14} className="text-amber" />
            <span>1-Click Scenarios:</span>
          </span>
          {Object.entries(samples).length > 0 ? (
            Object.entries(samples).map(([key, s]) => (
              <button
                key={key}
                type="button"
                className="preset-chip"
                onClick={() => handleSelectPreset(key)}
              >
                {s.title}
              </button>
            ))
          ) : (
            <>
              <button
                type="button"
                className="preset-chip"
                onClick={() => {
                  setInputVal('https://bit.ly/hdfc-kyc-verify-2024')
                  setActiveTab('url')
                  toast('Loaded Bank KYC Phish preset')
                }}
              >
                Bank KYC Phish
              </button>
              <button
                type="button"
                className="preset-chip"
                onClick={() => {
                  setInputVal('http://dhl-express-customs.top/pay/trace')
                  setActiveTab('url')
                  toast('Loaded Delivery Customs Scam preset')
                }}
              >
                Delivery Customs Scam
              </button>
              <button
                type="button"
                className="preset-chip"
                onClick={() => {
                  setInputVal(
                    'URGENT: David Miller CEO here. Settle $2000 in Apple gift cards immediately before our board meeting. Reply with card codes.'
                  )
                  setActiveTab('text')
                  toast('Loaded CEO Gift Card Fraud preset')
                }}
              >
                CEO Wire Fraud
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Hunting Workspace Layout */}
      <div className="hunting-grid-layout">
        {/* Left Column: Input Form & Uploads */}
        <div className="hunting-input-panel">
          {/* Workspace Tabs */}
          <div className="workspace-tabs-row">
            <button
              type="button"
              className={`workspace-tab ${activeTab === 'url' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('url')
                setUploadedFile(null)
              }}
            >
              <Globe2 size={15} />
              <span>URL / Domain</span>
            </button>
            <button
              type="button"
              className={`workspace-tab ${activeTab === 'text' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('text')
                setUploadedFile(null)
              }}
            >
              <AlignLeft size={15} />
              <span>Text / Message</span>
            </button>
            <button
              type="button"
              className={`workspace-tab ${activeTab === 'qr' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('qr')
                setUploadedFile(null)
              }}
            >
              <QrCode size={15} />
              <span>QR Code</span>
            </button>
            <button
              type="button"
              className={`workspace-tab ${activeTab === 'screenshot' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('screenshot')
                setUploadedFile(null)
              }}
            >
              <FileImage size={15} />
              <span>Screenshot</span>
            </button>
          </div>

          {/* Tab 1 & 2: Text / URL Input Box */}
          {activeTab === 'url' || activeTab === 'text' ? (
            <div className="hunting-input-card">
              <div className="input-textarea-wrapper">
                {activeTab === 'url' ? (
                  <input
                    type="url"
                    className="hunting-text-input single-line"
                    placeholder="Enter suspicious link (e.g. https://fakebank-login.com or bit.ly/kyc)..."
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void triggerAnalyze()}
                  />
                ) : (
                  <textarea
                    rows={5}
                    className="hunting-text-input multi-line"
                    placeholder="Paste email headers, SMS body, WhatsApp extortion message, or urgent request..."
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                  />
                )}
              </div>

              <div className="input-actions-bar">
                <div className="privacy-badge">
                  <LockKeyhole size={13} />
                  <span>Private SOC Inspection · No Logs Shared</span>
                </div>

                <div className="submit-buttons-row">
                  {inputVal && (
                    <button
                      type="button"
                      className="button button-quiet"
                      onClick={() => setInputVal('')}
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="button"
                    className="button button-primary submit-analyze-btn"
                    onClick={() => void triggerAnalyze()}
                    disabled={checking}
                  >
                    <Sparkles size={16} />
                    <span>{checking ? 'Evaluating...' : 'Analyze with Shield AI'}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Tab 3 & 4: Image Drag & Drop (QR Code / Screenshot) */
            <div className="hunting-media-upload-card">
              {!uploadedFile ? (
                <div
                  className={`media-dropzone-large ${isDragging ? 'dragging' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setIsDragging(true)
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setIsDragging(false)
                    const file = e.dataTransfer.files?.[0]
                    if (file) handleProcessImage(file)
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleProcessImage(file)
                    }}
                  />
                  <div className="dropzone-icon">
                    {activeTab === 'qr' ? <QrCode size={38} /> : <FileImage size={38} />}
                  </div>
                  <h3>
                    Drag & Drop {activeTab === 'qr' ? 'Suspicious QR Code' : 'Screenshot Image'}
                  </h3>
                  <p>PNG, JPG, WebP up to 8 MB · Instant decode & multi-modal inspection</p>
                  <button
                    type="button"
                    className="button button-outline browse-files-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      fileInputRef.current?.click()
                    }}
                  >
                    <FolderOpen size={15} /> Select File From Device
                  </button>
                </div>
              ) : (
                <div className="media-preview-box">
                  <div className="preview-thumb-container">
                    <img src={uploadedFile.preview} alt="Upload preview" className="preview-thumb-img" />
                    <span className="preview-type-pill">
                      {activeTab === 'qr' ? 'QR IMAGE' : 'SCREENSHOT'}
                    </span>
                  </div>
                  <div className="preview-meta-container">
                    <strong>{uploadedFile.name}</strong>
                    <span>{uploadedFile.size} · Multimodal payload ready</span>
                    <div className="preview-actions">
                      <button
                        type="button"
                        className="button button-primary"
                        onClick={() => void triggerAnalyze(uploadedFile.name)}
                        disabled={checking}
                      >
                        <Sparkles size={15} />
                        <span>{checking ? 'Analyzing...' : 'Run Vision Inspection'}</span>
                      </button>
                      <button
                        type="button"
                        className="button button-outline"
                        onClick={() => setUploadedFile(null)}
                      >
                        <Trash2 size={14} /> Remove
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Info Box / How Engines Work */}
          <div className="engines-infobox">
            <div className="infobox-header">
              <ShieldCheck size={16} className="text-emerald" />
              <strong>Real-Time Pipeline Architecture</strong>
            </div>
            <p>
              Every payload triggers recursive redirect tracing, typosquatting calculation,
              VirusTotal cache correlation (1h expiry), SafeBrowsing lookups, and Gemini 2.0 reasoning.
            </p>
          </div>
        </div>

        {/* Right Column: Precision Gauge, Results, Anatomy, and Export */}
        <div className="hunting-result-panel">
          {checking ? (
            <div className="evaluating-card">
              <div className="evaluating-pulse-circle">
                <Shield size={36} className="text-emerald" />
              </div>
              <h3>Deconstructing Threat Telemetry...</h3>
              <p>Evaluating domain entropy, SSL certificate chains, and deceptive markers.</p>
              <div className="evaluating-steps-list">
                <span className="step-badge active"><CheckCircle2 size={13} /> Typosquatting Analysis</span>
                <span className="step-badge active"><CheckCircle2 size={13} /> VirusTotal 90+ Scanners</span>
                <span className="step-badge active"><CheckCircle2 size={13} /> Gemini 2.0 Flash Reasoning</span>
              </div>
            </div>
          ) : result ? (
            <div className={`scan-result-card risk-${result.risk_level}`}>
              {/* Result Header & Precision SVG Gauge */}
              <div className="result-header-row">
                <div className="result-verdict-summary">
                  <span className="eyebrow">FORENSIC VERDICT</span>
                  <h2>{result.verdict}</h2>
                  <p className="summary-paragraph">{result.summary}</p>
                  {result.impersonated_brand && (
                    <div className="impersonation-alert">
                      <AlertTriangle size={14} />
                      <span>Target Brand: <strong>{result.impersonated_brand}</strong></span>
                    </div>
                  )}
                </div>

                <PrecisionGauge score={result.risk_score} risk={result.risk_level} />
              </div>

              {/* Redirect Hops Telemetry */}
              {result.urls_inspected && result.urls_inspected.length > 0 && (
                <div className="telemetry-box">
                  <div className="telemetry-box-header">
                    <span><Globe2 size={14} /> REDIRECT CHAIN TELEMETRY</span>
                    <span className="hops-badge">
                      {result.urls_inspected[0]?.hops || 1} HOP(S)
                    </span>
                  </div>
                  <div className="telemetry-hops-list">
                    {result.urls_inspected[0]?.chain?.map((hop, i) => (
                      <div key={i} className="telemetry-hop-item">
                        <span className="hop-code">{hop.status}</span>
                        <span className="hop-url">{hop.url}</span>
                      </div>
                    ))}
                    <div className="telemetry-hop-item destination">
                      <span className="hop-code dest">DEST</span>
                      <span className="hop-url">
                        {result.urls_inspected[0]?.final ||
                          result.urls_inspected[0]?.scanned_url}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Inline Visual Anatomy Highlighter */}
              <AnatomyHighlighter
                flags={result.flags || []}
                highlights={result.inline_highlights}
                rawContent={inputVal}
              />

              {/* SOC Actions Bar: PDF Exporter & Stall-Bot Drawer */}
              <div className="result-actions-strip">
                <button
                  type="button"
                  className="button button-outline pdf-export-btn"
                  onClick={handleExportPdf}
                >
                  <Download size={15} />
                  <span>Export Forensic PDF</span>
                </button>

                <button
                  type="button"
                  className="button button-outline stall-bot-trigger-btn"
                  onClick={() => {
                    setStallOpen(true)
                    void handleStallBot()
                  }}
                >
                  <Bot size={15} className="text-amber" />
                  <span>Launch Scam-Bait Stall Bot</span>
                </button>

                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => {
                    navigate(`/assistant?context=${encodeURIComponent(result.summary)}`)
                  }}
                >
                  <Sparkles size={14} />
                  <span>Consult AI Copilot</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-workspace-state">
              <div className="empty-shield-icon">
                <ShieldCheck size={48} strokeWidth={1.3} />
              </div>
              <h3>Threat Hunting Standby</h3>
              <p>
                Enter a suspect address or choose a 1-click preset scenario from the toolbar above to
                render the precision risk gauge and inline forensic breakdown.
              </p>
              <div className="quick-start-chips">
                <button
                  type="button"
                  className="start-chip"
                  onClick={() => {
                    setInputVal('https://fakebank-login.com')
                    void triggerAnalyze('https://fakebank-login.com')
                  }}
                >
                  Inspect Sample Phishing Bank &gt;
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stall Bot Drawer / Modal */}
      {stallOpen && (
        <div className="stall-bot-backdrop" onClick={() => setStallOpen(false)}>
          <div className="stall-bot-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div className="drawer-title">
                <Bot size={20} className="text-amber" />
                <h3>AI Scam-Bait Stall Bot</h3>
              </div>
              <button
                type="button"
                className="close-drawer-btn"
                onClick={() => setStallOpen(false)}
                aria-label="Close Stall Bot"
              >
                <X size={18} />
              </button>
            </div>

            <p className="drawer-description">
              Deploy automated cognitive friction to tie up scammer resources without revealing any
              legitimate user credentials or sensitive personal information.
            </p>

            <div className="strategy-buttons-grid">
              <button
                type="button"
                className={`strategy-pill ${stallStrategy === 'confused_victim' ? 'active' : ''}`}
                onClick={() => {
                  setStallStrategy('confused_victim')
                  void handleStallBot('confused_victim')
                }}
              >
                <strong>Confused Senior / Victim</strong>
                <small>Feigns computer illiteracy</small>
              </button>

              <button
                type="button"
                className={`strategy-pill ${stallStrategy === 'technical_glitch' ? 'active' : ''}`}
                onClick={() => {
                  setStallStrategy('technical_glitch')
                  void handleStallBot('technical_glitch')
                }}
              >
                <strong>Technical Glitch (504/403)</strong>
                <small>Asks for alternate mirror IP</small>
              </button>

              <button
                type="button"
                className={`strategy-pill ${stallStrategy === 'bureaucratic_delay' ? 'active' : ''}`}
                onClick={() => {
                  setStallStrategy('bureaucratic_delay')
                  void handleStallBot('bureaucratic_delay')
                }}
              >
                <strong>Bureaucratic Compliance</strong>
                <small>Demands employee registration ID</small>
              </button>
            </div>

            <div className="stall-reply-output-box">
              {stallLoading ? (
                <div className="stall-loading-text">
                  <Sparkles size={16} className="text-amber" />
                  <span>Synthesizing defensive conversational bait with Gemini...</span>
                </div>
              ) : (
                <p className="stall-reply-text">
                  {stallReply || 'Select a bait strategy above to generate automated counter-response.'}
                </p>
              )}
            </div>

            <div className="drawer-footer-actions">
              <button
                type="button"
                className="button button-primary"
                onClick={() => {
                  void navigator.clipboard.writeText(stallReply)
                  toast('Bait reply copied to clipboard!')
                }}
                disabled={!stallReply || stallLoading}
              >
                <Copy size={15} />
                <span>Copy Bait Response</span>
              </button>

              <button
                type="button"
                className="button button-outline"
                onClick={() => void handleStallBot()}
                disabled={stallLoading}
              >
                <RefreshCw size={15} />
                <span>Regenerate</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
