/**
 * useToast | v1.0.0 | 2026-06-17
 * Purpose: React hook to fire toasts from components.
 *
 * T66: Thin wrapper over toastBus — same API, but importable as a hook
 * for consistency with React patterns. Non-component code should import
 * toast directly from toastBus.
 */

import { toast } from './toastBus'
import type { ToastOptions } from './toastBus'

export interface UseToastReturn {
  error:   (message: string, opts?: ToastOptions) => void
  success: (message: string, opts?: ToastOptions) => void
  info:    (message: string, opts?: ToastOptions) => void
  warning: (message: string, opts?: ToastOptions) => void
}

/** Returns toast.error / success / info / warning — fires through toastBus. */
export function useToast(): UseToastReturn {
  return toast
}
