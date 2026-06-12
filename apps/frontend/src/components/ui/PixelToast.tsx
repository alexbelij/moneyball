/**
 * PixelToast | v1.0.0 | 2026-06-13
 * Purpose: SNES-styled toast notifications (info/success/error).
 * T14: auto-dismiss, stacking, design-spec palette.
 */

import React, { createContext, useCallback, useContext, useState } from 'react'
import styles from './pixel.module.css'

export type ToastVariant = 'info' | 'success' | 'error'

interface Toast {
  id: number
  text: string
  variant: ToastVariant
}

interface ToastContextValue {
  toast: (text: string, variant?: ToastVariant) => void
}

const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
})

export function useToast() {
  return useContext(ToastContext)
}

let nextId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((text: string, variant: ToastVariant = 'info') => {
    const id = nextId++
    setToasts((prev) => [...prev, { id, text, variant }])
    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const variantClasses: Record<ToastVariant, string> = {
    info: styles.toastInfo,
    success: styles.toastSuccess,
    error: styles.toastError,
  }

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className={styles.toastContainer} aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${styles.toast} ${variantClasses[t.variant]}`}
            role="status"
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
