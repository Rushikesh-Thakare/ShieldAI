import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  Shield, Mail, Key, ArrowRight, ArrowLeft,
  CheckCircle2, AlertCircle
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export const AuthPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()

  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login'
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(initialMode)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // If already authenticated, redirect to destination
  useEffect(() => {
    if (user) {
      const redirect = searchParams.get('redirect') || '/dashboard'
      navigate(redirect)
    }
  }, [user, navigate, searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')
    const targetRedirect = searchParams.get('redirect') || '/dashboard'

    if (!supabase) {
      // Offline / Demo mode notice
      toast('Demo environment: Supabase client is operating in localized mode.', 'info')
      navigate(targetRedirect)
      return
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify.')
      return
    }

    setLoading(true)

    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth?mode=reset`,
        })
        if (error) throw error
        setSuccessMessage('Password recovery link has been dispatched to your email.')
        toast('Recovery email sent!')
      } else if (mode === 'signup') {
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) throw error
        if (data.session) {
          toast('Account created and authenticated!')
          navigate(targetRedirect)
        } else {
          setSuccessMessage('Account registered! Please check your email inbox to confirm registration.')
          toast('Verification email sent!')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        toast('Welcome back to Shield AI!')
        navigate(targetRedirect)
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Authentication could not be completed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page-wrapper">
      <div className="auth-ambient-glow" />

      <div className="auth-glassmorphic-card">
        {/* Card Header */}
        <div className="auth-card-header">
          <Link to="/" className="brand" aria-label="Shield AI Home">
            <span className="brand-mark">
              <Shield size={22} strokeWidth={2.4} />
              <span />
            </span>
            <span>
              SHIELD<span className="brand-ai">AI</span>
            </span>
          </Link>

          <span className="auth-eyebrow">
            {mode === 'forgot'
              ? 'CREDENTIAL RECOVERY'
              : mode === 'signup'
              ? 'NEW DEFENDER ACCESS'
              : 'ENTERPRISE SOC GATEWAY'}
          </span>

          <h2>
            {mode === 'forgot'
              ? 'Reset Account Access'
              : mode === 'signup'
              ? 'Create Defender Account'
              : 'Sign In to Shield AI'}
          </h2>
          <p>
            {mode === 'forgot'
              ? 'Enter your registered email to receive secure recovery credentials.'
              : mode === 'signup'
              ? 'Activate real-time cloud threat intelligence and persistent scan history.'
              : 'Access your private incident logs and threat telemetry.'}
          </p>
        </div>

        {/* Tab Switcher */}
        {mode !== 'forgot' && (
          <div className="auth-tabs-toggle">
            <button
              type="button"
              className={`auth-tab-btn ${mode === 'login' ? 'active' : ''}`}
              onClick={() => {
                setMode('login')
                setErrorMessage('')
                setSuccessMessage('')
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`auth-tab-btn ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => {
                setMode('signup')
                setErrorMessage('')
                setSuccessMessage('')
              }}
            >
              Sign Up
            </button>
          </div>
        )}

        {/* Error / Success Feedback */}
        {errorMessage && (
          <div className="auth-alert-box error" role="alert">
            <AlertCircle size={15} />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="auth-alert-box success" role="status">
            <CheckCircle2 size={15} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-input-group">
            <label htmlFor="auth-email">Work / Personal Email</label>
            <div className="auth-input-field">
              <Mail size={16} className="input-field-icon" />
              <input
                id="auth-email"
                type="email"
                required
                autoComplete="email"
                placeholder="analyst@enterprise.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div className="auth-input-group">
              <div className="label-with-action">
                <label htmlFor="auth-password">Password</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    className="forgot-password-link"
                    onClick={() => {
                      setMode('forgot')
                      setErrorMessage('')
                      setSuccessMessage('')
                    }}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="auth-input-field">
                <Key size={16} className="input-field-icon" />
                <input
                  id="auth-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
          )}

          {mode === 'signup' && (
            <div className="auth-input-group">
              <label htmlFor="auth-confirm-password">Confirm Password</label>
              <div className="auth-input-field">
                <Key size={16} className="input-field-icon" />
                <input
                  id="auth-confirm-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            className="button button-primary auth-submit-btn"
            disabled={loading}
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : mode === 'forgot' ? (
              <>
                <span>Send Reset Link</span>
                <ArrowRight size={15} />
              </>
            ) : mode === 'signup' ? (
              <>
                <span>Create Defender Account</span>
                <ArrowRight size={15} />
              </>
            ) : (
              <>
                <span>Sign In to Console</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>

        {/* Footer Navigation */}
        <div className="auth-card-footer">
          {mode === 'forgot' ? (
            <button
              type="button"
              className="back-to-login-btn"
              onClick={() => {
                setMode('login')
                setErrorMessage('')
                setSuccessMessage('')
              }}
            >
              <ArrowLeft size={14} />
              <span>Back to Sign In</span>
            </button>
          ) : (
            <div className="footer-links-row">
              <Link to="/dashboard" className="guest-skip-link">
                Continue as Guest Analyst &gt;
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
