/**
 * useFocusTrap.ts | v1.0.0 | 2026-06-12
 * Purpose: Focus trap hook — traps Tab/Shift+Tab inside a container,
 * restores focus on unmount, Esc triggers onClose callback.
 */

import { useEffect, useRef, useCallback } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[role="tab"]',
  '[role="switch"]',
].join(', ')

interface UseFocusTrapOptions {
  /** Called when Esc is pressed inside the trap. */
  onClose?: () => void
  /** Whether the trap is active. Default true. */
  active?: boolean
}

export function useFocusTrap<T extends HTMLElement = HTMLElement>(
  options: UseFocusTrapOptions = {},
) {
  const { onClose, active = true } = options
  const containerRef = useRef<T | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Save the previously focused element on mount
  useEffect(() => {
    if (!active) return
    previousFocusRef.current = document.activeElement as HTMLElement | null

    // Auto-focus the first focusable element inside the container
    const container = containerRef.current
    if (container) {
      const first = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      if (first) {
        // Small delay to ensure container is rendered
        requestAnimationFrame(() => first.focus())
      }
    }

    // Restore focus on unmount
    return () => {
      previousFocusRef.current?.focus()
    }
  }, [active])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!active) return
      const container = containerRef.current
      if (!container) return

      if (e.key === 'Escape') {
        e.preventDefault()
        onClose?.()
        return
      }

      if (e.key !== 'Tab') return

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey) {
        // Shift+Tab: if on first element, wrap to last
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        // Tab: if on last element, wrap to first
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    },
    [active, onClose],
  )

  useEffect(() => {
    if (!active) return
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [active, handleKeyDown])

  return containerRef
}
