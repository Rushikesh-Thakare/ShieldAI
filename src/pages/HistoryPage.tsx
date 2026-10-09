import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  History, ShieldCheck, ShieldAlert, ArrowUpRight, Download,
  RefreshCw, Trash2, LockKeyhole, AlertTriangle, ArrowRight
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import type { ScanResult } from '../types'

export const HistoryPage: React.FC = () => {
  const { session, user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [scans, setScans] = useState<ScanResult[]>([])
  const [loading, setLoading] = useState(true)

  const loadHistory = async () => {
    setLoading(true)

    // Check if authenticated
    if (session?.access_token) {
      try {
        const res = await fetch('/api/history', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })

        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data.scans) && data.scans.length > 0) {
            setScans(data.scans)
            if (user?.id) {
              localStorage.setItem(`shield_user_scans_${user.id}`, JSON.stringify(data.scans))
            }
            setLoading(false)
            return
          }
        }
      } catch {
        // Fallback to local storage
      }
    }

    // Load from local storage
    const key = user?.id ? `shield_user_scans_${user.id}` : 'shield_guest_scans'
    const stored = localStorage.getItem(key)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setScans(parsed)
        }
      } catch {}
    } else {
      // Default sample records if fresh install
      const sampleScans: ScanResult[] = [
        {
          id: 'scan-demo-1',
          created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
          risk_score: 97,
          risk_level: 'danger',
          verdict: 'Phishing website blocked',
          summary: 'Lookalike banking domain fakebank-login.com with credential harvesting form.',
          threat_type: 'Banking Phishing',
          domains: ['fakebank-login.com'],
          flags: [
            {
              type: 'Credential Harvesting',
              text_snippet: 'Password input',
              color: '#ef4444',
              explanation: 'Sensitive password request on untrusted domain',
            },
          ],
        },
        {
          id: 'scan-demo-2',
          created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
          risk_score: 68,
          risk_level: 'suspicious',
          verdict: 'Suspicious delivery customs notification',
          summary: 'Smishing SMS leading to unverified TLD dhl-express-customs.top',
          threat_type: 'Smishing / Advance-Fee',
          domains: ['dhl-express-customs.top'],
          flags: [
            {
              type: 'False Urgency',
              text_snippet: 'Unpaid customs fee',
              color: '#f59e0b',
              explanation: 'Urgent payment demand',
            },
          ],
        },
        {
          id: 'scan-demo-3',
          created_at: new Date(Date.now() - 1000 * 60 * 420).toISOString(),
          risk_score: 4,
          risk_level: 'safe',
          verdict: 'Benign Corporate IT Notice',
          summary: 'Scheduled single sign-on maintenance announcement with legitimate domain signature.',
          threat_type: 'Benign Notice',
          flags: [],
        },
      ]
      setScans(sampleScans)
    }

    setLoading(false)
  }

  useEffect(() => {
    void loadHistory()
  }, [session, user])

  const handleRestoreScan = (scan: ScanResult) => {
    navigate(`/dashboard?scan_id=${scan.id}`)
  }

  const handleClearHistory = () => {
    const key = user?.id ? `shield_user_scans_${user.id}` : 'shield_guest_scans'
    localStorage.removeItem(key)
    setScans([])
    toast('Local scan history cleared.')
  }

  const handleExportHistory = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(scans, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute('download', `shield-scan-history-${Date.now()}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
    toast('Scan audit history exported as JSON!')
  }

  const totalDangerous = scans.filter((s) => s.risk_level === 'danger').length
  const totalSuspicious = scans.filter((s) => s.risk_level === 'suspicious').length
  const totalSafe = scans.filter((s) => s.risk_level === 'safe').length

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Just now'
    const d = new Date(isoString)
    return isNaN(d.getTime())
      ? 'Just now'
      : d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
  }

  return (
    <div className="history-page-container">
      {/* History Header */}
      <div className="history-header">
        <div>
          <div className="history-kicker">
            <History size={14} className="text-emerald" />
            <span>AUDIT TRAIL & INCIDENT VAULT</span>
          </div>
          <h1>Security Scan History<span className="period">.</span></h1>
          <p>
            {user
              ? `Private forensic audit trail for ${user.email}. Restored scans allow instant SOC review.`
              : 'Audit trail for this workstation. Sign in to sync your scans securely across all devices.'}
          </p>
        </div>

        <div className="history-header-actions">
          <button
            type="button"
            className="button button-outline"
            onClick={loadHistory}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className="button button-outline"
            onClick={handleExportHistory}
            disabled={scans.length === 0}
          >
            <Download size={14} />
            <span>Export JSON</span>
          </button>
          {scans.length > 0 && (
            <button
              type="button"
              className="button button-quiet"
              onClick={handleClearHistory}
            >
              <Trash2 size={14} />
              <span>Clear History</span>
            </button>
          )}
        </div>
      </div>

      {/* Guest Notice if not authenticated */}
      {!user && (
        <div className="history-guest-banner">
          <div className="guest-banner-left">
            <LockKeyhole size={18} className="text-amber" />
            <div>
              <strong>Browsing in Local Guest Mode</strong>
              <p>Your scans are currently saved only to this browser session. Sign up to enable cloud persistence.</p>
            </div>
          </div>
          <Link to="/auth?mode=signup" className="button button-primary banner-signin-btn">
            <span>Connect Account</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* Summary Metrics */}
      <div className="history-metrics-grid">
        <div className="history-metric-card">
          <span className="metric-icon red">
            <ShieldAlert size={18} />
          </span>
          <div>
            <strong>{totalDangerous}</strong>
            <small>Interceptions (High Threat)</small>
          </div>
        </div>

        <div className="history-metric-card">
          <span className="metric-icon amber">
            <AlertTriangle size={18} />
          </span>
          <div>
            <strong>{totalSuspicious}</strong>
            <small>Flagged as Suspicious</small>
          </div>
        </div>

        <div className="history-metric-card">
          <span className="metric-icon green">
            <ShieldCheck size={18} />
          </span>
          <div>
            <strong>{totalSafe}</strong>
            <small>Verified Safe & Clean</small>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="history-table-card">
        {loading ? (
          <div className="history-loading">
            <RefreshCw size={24} className="animate-spin text-emerald" />
            <span>Retrieving forensic scan logs...</span>
          </div>
        ) : scans.length === 0 ? (
          <div className="history-empty-state">
            <ShieldCheck size={40} className="text-emerald" />
            <h3>No Scans Recorded Yet</h3>
            <p>Inspect suspicious links, QR codes, or messages in the Threat Hunting console.</p>
            <Link to="/dashboard" className="button button-primary">
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <div className="table-responsive-wrapper">
            <table className="history-scans-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Target Domain / Input</th>
                  <th>Forensic Verdict</th>
                  <th>Risk Level</th>
                  <th>Risk Score</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {scans.map((scan) => {
                  const targetLabel =
                    scan.domains?.[0] ||
                    scan.urls_inspected?.[0]?.scanned_url ||
                    scan.input_type ||
                    'Scanned Item'

                  return (
                    <tr key={scan.id}>
                      <td className="timestamp-cell">
                        <span>{formatDate(scan.created_at)}</span>
                      </td>

                      <td className="target-cell">
                        <code className="target-code">{targetLabel}</code>
                      </td>

                      <td className="verdict-cell">
                        <strong className="verdict-title">{scan.verdict}</strong>
                        <p className="verdict-summary">{scan.summary}</p>
                      </td>

                      <td className="risk-level-cell">
                        <span className={`risk-pill ${scan.risk_level}`}>
                          <i />
                          <span>{scan.risk_level.toUpperCase()}</span>
                        </span>
                      </td>

                      <td className="score-cell">
                        <strong>{scan.risk_score}</strong>
                        <small> / 100</small>
                      </td>

                      <td className="action-cell">
                        <button
                          type="button"
                          className="button button-primary button-sm restore-btn"
                          onClick={() => handleRestoreScan(scan)}
                          title="Restore in Dashboard"
                        >
                          <ArrowUpRight size={13} />
                          <span>Restore in Console</span>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
