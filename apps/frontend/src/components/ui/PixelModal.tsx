/**
 * PixelModal | v1.0.0 | 2026-06-13
 * Purpose: SNES-styled modal with focus trap, Escape close, overlay click close.
 * T14: 2px pixel borders, design-spec palette, keyboard accessible.
 * Uses existing useFocusTrap hook.
 */

import React, { useCallback, useEffect, useRef } from 'react'
import styles from './pixel.module.css'

export interface PixelModalProps {
  open: boolean
  onClose: () => void
  title?: string
  /** aria-label for the dialog (defaults to title). */
  ariaLabel?: string
  children: React.ReactNode
}

export function PixelModal({ open, onClose, title, ariaLabel, children }: PixelModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  // Store previously focused element and restore on close
  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement as HTMLElement | null
      // Focus the modal container on next frame
      requestAnimationFrame(() => {
        modalRef.current?.focus()
      })
    } else if (previousFocus.current) {
      previousFocus.current.focus()
      previousFocus.current = null
    }
  }, [open])

  // Escape close
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      // Focus trap: Tab cycles within modal
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    },
    [onClose],
  )

  // Overlay click close
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose()
    },
    [onClose],
  )

  if (!open) return null

  return (
    <div
      className={styles.overlay}
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        ref={modalRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? title ?? 'Dialog'}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        {title && (
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>{title}</h2>
            <button
              className={styles.modalClose}
              onClick={onClose}
              aria-label="Close"
              type="button"
            >
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
