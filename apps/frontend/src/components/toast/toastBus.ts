/**
 * toastBus | v1.0.0 | 2026-06-17
 * Purpose: Module-level event emitter so non-React code (API client,
 * handlers) can fire toast notifications. ToastProvider subscribes to it.
 *
 * T66: Full implementation with variant support and coach selection.
 *      When no ToastProvider is mounted, messages fall through to console.
 */

export type ToastVariant = 'error' | 'success' | 'info' | 'warning'

export interface ToastOptions {
  /** Agent avatar to show (agent ID or 'system'). Default: 'system'. */
  coach?: string
  /** Optional bold title line above the message. */
  title?: string
  /** Custom auto-dismiss duration in ms. */
  durationMs?: number
  /** If true, toast won't auto-dismiss. */
  sticky?: boolean
}

export interface ToastEvent {
  variant: ToastVariant
  message: string
  options: ToastOptions
}

type Listener = (event: ToastEvent) => void

const listeners = new Set<Listener>()

/** Subscribe to toast events. Returns unsubscribe function. */
export function onToast(fn: Listener): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

/** Fire a toast event. If no ToastProvider is mounted yet, logs to console. */
function emit(variant: ToastVariant, message: string, options: ToastOptions = {}) {
  const event: ToastEvent = { variant, message, options }
  if (listeners.size === 0) {
    // Fallback: no UI listener mounted
    const method = variant === 'error' ? 'error' : variant === 'warning' ? 'warn' : 'info'
    console[method](`[toast:${variant}]`, message)
    return
  }
  listeners.forEach((fn) => fn(event))
}

export const toast = {
  error:   (message: string, opts?: ToastOptions) => emit('error',   message, opts),
  success: (message: string, opts?: ToastOptions) => emit('success', message, opts),
  info:    (message: string, opts?: ToastOptions) => emit('info',    message, opts),
  warning: (message: string, opts?: ToastOptions) => emit('warning', message, opts),
}
