import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Shield, ShieldCheck, ShieldAlert, ArrowRight, Activity, Globe2,
  LockKeyhole, Sparkles, Zap, QrCode, Database,
  CheckCircle2, Bot, ChevronRight
} from 'lucide-react'
import { apiRequest } from '../lib/api'
import type { ThreatLakeItem } from '../types'

export const LandingPage: React.FC = () => {
  const [trending, setTrending] = useState<ThreatLakeItem[]>([])

  useEffect(() => {
    void apiRequest<{ threats: ThreatLakeItem[] }>('/api/threat-lake/trending', {}, false)
      .then((data) => {
        if (Array.isArray(data.threats)) {
          setTrending(data.threats.slice(0, 4))
        }
      })
      .catch(() => {})
  }, [])

  return (
    <div className="landing-page-wrapper">
      {/* Hero Section */}
      <section className="landing-hero-section">
        <div className="landing-hero-content">
          <div className="hero-pill-badge">
            <span className="badge-pulse" />
            <Shield size={14} className="text-emerald" />
            <span>NEXT-GEN AUTONOMOUS CYBER DEFENSE</span>
          </div>

          <h1 className="hero-headline">
            Stop Phishing & Scams <br />
            <span className="gradient-text">Before the First Click.</span>
          </h1>

          <p className="hero-subhead">
            Shield AI unites Google Gemini 2.0 Flash, VirusTotal intelligence, and SafeBrowsing telemetry
            to inspect deceptive URLs, QR codes, and malicious messages in sub-50ms latency.
          </p>

          <div className="hero-actions">
            <Link to="/dashboard" className="button button-primary hero-cta-btn">
              <Zap size={16} />
              <span>Launch Threat Console</span>
              <ArrowRight size={16} />
            </Link>

            <Link to="/threat-lake" className="button button-outline hero-secondary-btn">
              <Database size={15} />
              <span>Explore Threat Lake</span>
            </Link>

            <Link to="/assistant" className="button button-quiet hero-secondary-btn">
              <Sparkles size={15} />
              <span>Ask AI Security Copilot</span>
            </Link>
          </div>

          <div className="hero-trust-row">
            <div className="trust-item">
              <CheckCircle2 size={15} className="text-emerald" />
              <span>Tri-Engine Fusion</span>
            </div>
            <div className="trust-item">
              <LockKeyhole size={15} className="text-emerald" />
              <span>Zero-Data Retention Scans</span>
            </div>
            <div className="trust-item">
              <Activity size={15} className="text-emerald" />
              <span>Crowdsourced IoC Lake</span>
            </div>
          </div>
        </div>

        {/* Hero Visual Orbit */}
        <div className="landing-hero-graphic">
          <div className="radar-circle circle-1" />
          <div className="radar-circle circle-2" />
          <div className="radar-circle circle-3" />
          <div className="radar-sweep" />

          <div className="hero-shield-core">
            <ShieldCheck size={68} strokeWidth={1.5} />
            <div className="shield-glow-effect" />
          </div>

          <div className="floating-metric-card metric-top-left">
            <Globe2 size={15} className="text-sky" />
            <div>
              <strong>Domain Typosquatting</strong>
              <small>Intercepted in 38ms</small>
            </div>
            <span className="status-dot dot-green" />
          </div>

          <div className="floating-metric-card metric-bottom-right">
            <QrCode size={15} className="text-amber" />
            <div>
              <strong>Deceptive QR Decoder</strong>
              <small>Deep redirect unwrap</small>
            </div>
            <span className="status-dot dot-amber" />
          </div>

          <div className="floating-metric-card metric-bottom-left">
            <Bot size={15} className="text-purple" />
            <div>
              <strong>Stall-Bot Scam Baited</strong>
              <small>Cognitive time-drain active</small>
            </div>
            <span className="status-dot dot-green" />
          </div>
        </div>
      </section>

      {/* Live Threat Stats Bar */}
      <section className="live-stats-bar">
        <div className="stat-metric-cell">
          <span className="metric-number">99.4%</span>
          <span className="metric-label">Precision Phishing Detection</span>
        </div>
        <div className="stat-metric-cell">
          <span className="metric-number">&lt; 48ms</span>
          <span className="metric-label">Engine Response Time</span>
        </div>
        <div className="stat-metric-cell">
          <span className="metric-number">90+</span>
          <span className="metric-label">VirusTotal Anti-Virus Scanners</span>
        </div>
        <div className="stat-metric-cell">
          <span className="metric-number">100%</span>
          <span className="metric-label">Automated IoC Lake Aggregation</span>
        </div>
      </section>

      {/* Feature Breakdown Grid */}
      <section className="feature-showcase-section">
        <div className="section-title-wrap">
          <span className="eyebrow">DEFENSE ARCHITECTURE</span>
          <h2>Multimodal Security For Modern Attacks</h2>
          <p>Scammers don't stop at plain text links. Shield AI operates across four distinct vectors.</p>
        </div>

        <div className="feature-cards-grid">
          <div className="feature-card">
            <div className="feature-icon-wrapper icon-emerald">
              <Globe2 size={24} />
            </div>
            <h3>Deep Redirect Unwrapping</h3>
            <p>
              Inspects shortened links (bit.ly, tinyurl) through recursive HTTP hop traversal. Identifies
              hidden destination hostnames and correlates them against threat databases.
            </p>
            <div className="feature-footer-tag">URL Forensics</div>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper icon-sky">
              <QrCode size={24} />
            </div>
            <h3>Quishing & QR Inspection</h3>
            <p>
              Upload or scan deceptive QR codes from parking meters, restaurant tables, or paper bills.
              Extracts the embedded payloads and executes automated sandbox safety evaluations.
            </p>
            <div className="feature-footer-tag">QR / Vision Engine</div>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper icon-purple">
              <Bot size={24} />
            </div>
            <h3>Autonomous Stall-Bot</h3>
            <p>
              Turn the tables on threat actors. Shield's AI generates deceptive, convincing responses
              (Confused Victim, Technical Glitch, Bureaucratic Delay) to tie up attacker infrastructure.
            </p>
            <div className="feature-footer-tag">Cognitive Countermeasure</div>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper icon-amber">
              <Database size={24} />
            </div>
            <h3>Threat Lake Intelligence</h3>
            <p>
              Every verified malicious domain is automatically ingested into our crowdsourced Threat Lake,
              arming your SOC and community with real-time indicators of compromise (IoCs).
            </p>
            <div className="feature-footer-tag">Community Defense</div>
          </div>
        </div>
      </section>

      {/* Live Threat Lake Preview Strip */}
      <section className="threat-lake-preview-strip">
        <div className="preview-strip-header">
          <div>
            <span className="eyebrow">LIVE TELEMETRY STREAM</span>
            <h3>Recently Neutralized Malicious Domains</h3>
          </div>
          <Link to="/threat-lake" className="button button-outline view-all-lake-btn">
            <span>View Full Threat Lake</span>
            <ChevronRight size={14} />
          </Link>
        </div>

        <div className="threat-cards-preview-row">
          {trending.length > 0 ? (
            trending.map((t, i) => (
              <div key={i} className="threat-lake-mini-card">
                <div className="mini-card-top">
                  <ShieldAlert size={16} className="text-red" />
                  <span className="threat-score-pill danger">{t.highest_risk_score || t.risk_score || 94} Risk</span>
                </div>
                <strong className="mini-card-domain">{t.domain}</strong>
                <span className="mini-card-type">{t.threat_type || t.category || 'Credential Harvester'}</span>
                <small className="mini-card-incidents">{t.incident_count || t.incidents || 1} intercepted calls</small>
              </div>
            ))
          ) : (
            <>
              <div className="threat-lake-mini-card">
                <div className="mini-card-top">
                  <ShieldAlert size={16} className="text-red" />
                  <span className="threat-score-pill danger">98 Risk</span>
                </div>
                <strong className="mini-card-domain">fakebank-login.com</strong>
                <span className="mini-card-type">Banking Phishing</span>
                <small className="mini-card-incidents">37 intercepted calls</small>
              </div>
              <div className="threat-lake-mini-card">
                <div className="mini-card-top">
                  <ShieldAlert size={16} className="text-red" />
                  <span className="threat-score-pill danger">92 Risk</span>
                </div>
                <strong className="mini-card-domain">secure-account-verify.xyz</strong>
                <span className="mini-card-type">Credential Harvesting</span>
                <small className="mini-card-incidents">19 intercepted calls</small>
              </div>
              <div className="threat-lake-mini-card">
                <div className="mini-card-top">
                  <ShieldAlert size={16} className="text-amber" />
                  <span className="threat-score-pill warning">74 Risk</span>
                </div>
                <strong className="mini-card-domain">dhl-express-customs.top</strong>
                <span className="mini-card-type">Smishing / Advance-Fee</span>
                <small className="mini-card-incidents">12 intercepted calls</small>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="landing-cta-banner">
        <div className="cta-banner-inner">
          <div className="cta-left">
            <span className="eyebrow">ZERO SETUP REQUIRED</span>
            <h2>Ready to Verify Suspicious Content?</h2>
            <p>
              Paste any URL, email text, SMS alert, or upload a QR image to receive a complete forensic
              breakdown in milliseconds.
            </p>
          </div>
          <div className="cta-right">
            <Link to="/dashboard" className="button button-primary cta-large-btn">
              <Zap size={18} />
              <span>Open Threat Hunting Console</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
