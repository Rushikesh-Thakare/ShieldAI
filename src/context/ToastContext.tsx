import React, { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react'

type ToastType = 'success' | 'warning' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType>({
  toast: () => {},
})

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    if (!message) return
    const id = `${Date.now()}-${Math.random()}`

    setToasts((prev) => {
      // Prevent duplicate notification stacking
      if (prev.some((t) => t.message === message)) {
        return prev
      }
      // Cap maximum simultaneous toasts to 3
      const capped = prev.length >= 3 ? prev.slice(prev.length - 2) : prev
      return [...capped, { id, message, type }]
    })

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3200)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="global-toast-container" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-notification toast-${t.type}`}>
            {t.type === 'success' ? (
              <CheckCircle2 size={16} className="toast-icon" />
            ) : t.type === 'warning' ? (
              <AlertTriangle size={16} className="toast-icon" />
            ) : (
              <Info size={16} className="toast-icon" />
            )}
            <span className="toast-message">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
