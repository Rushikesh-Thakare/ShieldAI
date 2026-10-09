import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LandingPage } from './pages/LandingPage'
import { DashboardPage } from './pages/DashboardPage'
import { ThreatLakePage } from './pages/ThreatLakePage'
import { AssistantPage } from './pages/AssistantPage'
import { HistoryPage } from './pages/HistoryPage'
import { AuthPage } from './pages/AuthPage'
import './App.css'

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Shell Layout with persistent top navigation */}
            <Route element={<Layout />}>
              {/* Public Routes: accessible to everyone */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/threat-lake" element={<ThreatLakePage />} />

              {/* Protected Routes: gated by <ProtectedRoute> */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/history"
                element={
                  <ProtectedRoute>
                    <HistoryPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/assistant"
                element={
                  <ProtectedRoute>
                    <AssistantPage />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Public Auth Route: accessible to everyone */}
            <Route path="/auth" element={<AuthPage />} />

            {/* Catch-all fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
