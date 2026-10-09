import React from 'react'
import { Navigate, useLocation, Outlet } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

interface ProtectedRouteProps {
  children?: React.ReactNode
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div
        className="cyber-spinner-overlay"
        role="status"
        aria-live="polite"
        style={{
          minHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.25rem',
          background: 'transparent',
          color: '#f8fafc',
          padding: '2rem',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '64px',
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Outer glowing spinner ring */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '2px solid rgba(99, 102, 241, 0.15)',
              borderTopColor: '#00e5ff',
              borderRightColor: '#6366f1',
              animation: 'spin 0.9s cubic-bezier(0.55, 0.15, 0.45, 0.85) infinite',
              filter: 'drop-shadow(0 0 8px rgba(0, 229, 255, 0.45))',
            }}
          />

          {/* Inner counter-rotating ring */}
          <div
            style={{
              position: 'absolute',
              inset: '6px',
              borderRadius: '50%',
              border: '2px solid transparent',
              borderBottomColor: 'rgba(99, 102, 241, 0.8)',
              animation: 'spin 1.4s linear infinite reverse',
            }}
          />

          {/* Centered shield glyph */}
          <Shield
            size={22}
            style={{
              color: '#00e5ff',
              filter: 'drop-shadow(0 0 6px rgba(0, 229, 255, 0.6))',
              animation: 'pulse 1.8s ease-in-out infinite',
            }}
          />
        </div>

        {/* Status Typography */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#00e5ff',
              marginBottom: '0.35rem',
            }}
          >
            VERIFYING ENCLAVE SESSION...
          </div>
          <div
            style={{
              fontSize: '0.8rem',
              color: '#94a3b8',
            }}
          >
            Cryptographic authentication handshake in progress
          </div>
        </div>

        {/* Subtle CSS animation definition */}
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(0.94); }
          }
        `}</style>
      </div>
    )
  }

  if (!user) {
    const returnRedirect =
      location.pathname && location.pathname !== '/'
        ? `${location.pathname}${location.search}`
        : '/dashboard'

    return (
      <Navigate
        to={`/auth?redirect=${encodeURIComponent(returnRedirect)}`}
        replace
      />
    )
  }

  return children ? <>{children}</> : <Outlet />
}

export default ProtectedRoute
