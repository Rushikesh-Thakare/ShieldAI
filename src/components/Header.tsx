import React, { useState, useRef, useEffect } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import {
  Shield, LayoutDashboard, Database, Sparkles, History,
  LogOut, ChevronDown, Activity, Menu, X, ArrowRight
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export const Header: React.FC = () => {
  const { user, signOut } = useAuth()
  const [profileOpen, setProfileOpen] = useState(false)
  const [engineTooltip, setEngineTooltip] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    await signOut()
    setProfileOpen(false)
    navigate('/auth')
  }

  const userEmail = user?.email || 'User'
  const userInitial = userEmail.charAt(0).toUpperCase()

  const engines = [
    { id: 'gemini', name: 'Gemini', status: 'Active', latency: '48ms', model: '2.0-flash / 1.5-flash' },
    { id: 'virustotal', name: 'VirusTotal', status: 'Live Cache', latency: '82ms', model: '90+ Engines' },
    { id: 'safebrowsing', name: 'SafeBrowsing', status: 'Connected', latency: '65ms', model: 'v4 Lookup' },
  ]

  return (
    <header className="topbar shield-header">
      <div className="header-left">
        <Link to="/" className="brand" aria-label="Shield AI Home">
          <span className="brand-mark">
            <Shield size={20} strokeWidth={2.4} />
            <span />
          </span>
          <span>
            SHIELD<span className="brand-ai">AI</span>
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="header-nav" aria-label="Main Navigation">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `header-nav-link ${isActive ? 'active' : ''}`}
          >
            <LayoutDashboard size={15} />
            <span>Dashboard</span>
          </NavLink>
          <NavLink
            to="/threat-lake"
            className={({ isActive }) => `header-nav-link ${isActive ? 'active' : ''}`}
          >
            <Database size={15} />
            <span>Threat Lake</span>
          </NavLink>
          <NavLink
            to="/assistant"
            className={({ isActive }) => `header-nav-link ${isActive ? 'active' : ''}`}
          >
            <Sparkles size={15} />
            <span>AI Assistant</span>
          </NavLink>
          <NavLink
            to="/history"
            className={({ isActive }) => `header-nav-link ${isActive ? 'active' : ''}`}
          >
            <History size={15} />
            <span>History</span>
          </NavLink>
        </nav>
      </div>

      <div className="header-right">
        {/* Real-time Engine Status Pills */}
        <div className="engine-status-group" aria-label="Detection Engine Statuses">
          {engines.map((engine) => (
            <div
              key={engine.id}
              className="engine-pill"
              onMouseEnter={() => setEngineTooltip(engine.id)}
              onMouseLeave={() => setEngineTooltip(null)}
              title={`${engine.name}: ${engine.status} (${engine.latency})`}
            >
              <span className="engine-dot" />
              <span className="engine-name">{engine.name}</span>
              {engineTooltip === engine.id && (
                <div className="engine-popover">
                  <div className="engine-popover-title">
                    <Activity size={12} /> {engine.name} Defense Node
                  </div>
                  <div className="engine-popover-detail">
                    <span>Status: <strong>{engine.status}</strong></span>
                    <span>Latency: <strong>{engine.latency}</strong></span>
                    <span>Backend: <strong>{engine.model}</strong></span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* User Auth Section */}
        {user ? (
          <div className="user-profile-container" ref={profileRef}>
            <button
              className="user-profile-trigger"
              onClick={() => setProfileOpen(!profileOpen)}
              aria-label="User Profile Menu"
              aria-expanded={profileOpen}
            >
              <div className="user-avatar-badge">{userInitial}</div>
              <span className="user-display-email">{userEmail.split('@')[0]}</span>
              <ChevronDown size={14} className={`dropdown-caret ${profileOpen ? 'open' : ''}`} />
            </button>

            {profileOpen && (
              <div className="profile-dropdown-menu">
                <div className="dropdown-user-info">
                  <div className="dropdown-avatar">{userInitial}</div>
                  <div className="dropdown-meta">
                    <strong className="user-email-text">{userEmail}</strong>
                    <span className="user-status-pill">
                      <span className="status-online-dot" /> Authenticated
                    </span>
                  </div>
                </div>
                <div className="dropdown-divider" />
                <Link
                  to="/history"
                  className="dropdown-item"
                  onClick={() => setProfileOpen(false)}
                >
                  <History size={14} /> My Scans & Incident Vault
                </Link>
                <Link
                  to="/dashboard"
                  className="dropdown-item"
                  onClick={() => setProfileOpen(false)}
                >
                  <LayoutDashboard size={14} /> SOC Hunting Console
                </Link>
                <div className="dropdown-divider" />
                <button
                  type="button"
                  className="dropdown-item dropdown-logout"
                  onClick={handleLogout}
                >
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="auth-buttons-group">
            <Link to="/auth?mode=login" className="button button-outline header-auth-btn">
              Sign In
            </Link>
            <Link to="/auth?mode=signup" className="button button-primary header-auth-btn">
              <span>Sign Up</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        )}

        {/* Mobile menu hamburger */}
        <button
          className="mobile-menu-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="mobile-nav-drawer">
          <NavLink
            to="/dashboard"
            className="mobile-nav-item"
            onClick={() => setMobileMenuOpen(false)}
          >
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
          </NavLink>
          <NavLink
            to="/threat-lake"
            className="mobile-nav-item"
            onClick={() => setMobileMenuOpen(false)}
          >
            <Database size={16} />
            <span>Threat Lake</span>
          </NavLink>
          <NavLink
            to="/assistant"
            className="mobile-nav-item"
            onClick={() => setMobileMenuOpen(false)}
          >
            <Sparkles size={16} />
            <span>AI Assistant</span>
          </NavLink>
          <NavLink
            to="/history"
            className="mobile-nav-item"
            onClick={() => setMobileMenuOpen(false)}
          >
            <History size={16} />
            <span>Scan History</span>
          </NavLink>
          <div className="mobile-drawer-footer">
            {user ? (
              <button className="button button-danger full-button" onClick={handleLogout}>
                <LogOut size={14} /> Sign Out ({userEmail.split('@')[0]})
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <Link
                  to="/auth?mode=login"
                  className="button button-outline"
                  style={{ flex: 1 }}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign In
                </Link>
                <Link
                  to="/auth?mode=signup"
                  className="button button-primary"
                  style={{ flex: 1 }}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
