/**
 * useAsyncAction | v1.0.0 | 2026-06-17
 * Purpose: Generic hook for async click handlers — guards against double-submit,
 * exposes pending state, and routes errors to toast or inline.
 * T67: async blocking-states spec (Anna's requirement 14.06).
 */

import { useCallback, useRef, useState } from 'react'
import { toast } from '@/components/toast/toastBus'

export interface UseAsyncActionOptions {
  /** How to surface errors: 'toast' fires via toastBus, 'inline' exposes error. */
  onError?: 'toast' | 'inline'
}

export interface UseAsyncActionReturn<A extends unknown[]> {
  /** Call this instead of the raw async function. Re-entry is blocked while pending. */
  run: (...args: A) => Promise<void>
  /** True while the async function is in flight. */
  pending: boolean
  /** Last error (only populated when onError='inline'). Cleared on next run. */
  error: string | null
}

/**
 * Wraps an async function with pending-state tracking, double-submit guard,
 * and error routing.
 *
 * @example
 * const { run, pending, error } = useAsyncAction(
 *   async () => { await roast(agentId) },
 *   { onError: 'toast' },
 * )
 * <PixelButton busy={pending} onClick={run}>Roast me</PixelButton>
 */
export function useAsyncAction<A extends unknown[]>(
  asyncFn: (...args: A) => Promise<unknown>,
  options: UseAsyncActionOptions = {},
): UseAsyncActionReturn<A> {
  const { onError = 'toast' } = options
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inflightRef = useRef(false)

  const run = useCallback(
    async (...args: A) => {
      // Re-entry guard (ref is synchronous — no race)
      if (inflightRef.current) return
      inflightRef.current = true
      setPending(true)
      setError(null)

      try {
        await asyncFn(...args)
      } catch (e: any) {
        const msg = e?.message ?? String(e)
        if (onError === 'toast') {
          toast.error(msg)
        } else {
          setError(msg)
        }
      } finally {
        inflightRef.current = false
        setPending(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [asyncFn, onError],
  )

  return { run, pending, error }
}
