/**
 * ToastProvider | v1.0.0 | 2026-06-17
 * Purpose: Mount once at the app root. Subscribes to toastBus, manages
 * the visible toast stack (max 3, FIFO queue), and renders Toast items.
 *
 * T66: Anna's spec — top-right stack, 8px gap, z-index above modal scrim,
 * max 3 visible, FIFO queue, prefers-reduced-motion support.
 */

import React, { useEffect, useCallback, useReducer, useRef } from 'react'
import { onToast } from './toastBus'
import type { ToastEvent } from './toastBus'
import { Toast } from './Toast'
import type { ToastItemData } from './Toast'
import { zIndex } from '@/styles/tokens'

const MAX_VISIBLE = 3

// ── Reducer ───────────────────────────────────────────────────────────

type Action =
  | { type: 'ADD'; item: ToastItemData }
  | { type: 'DISMISS'; id: number }

interface State {
  items: ToastItemData[]
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD': {
      const next = [...state.items, action.item]
      // Keep only the newest MAX_VISIBLE — older ones are dropped
      return { items: next.length > MAX_VISIBLE ? next.slice(-MAX_VISIBLE) : next }
    }
    case 'DISMISS':
      return { items: state.items.filter((t) => t.id !== action.id) }
    default:
      return state
  }
}

// ── Detect prefers-reduced-motion ─────────────────────────────────────

function useReducedMotion(): boolean {
  const [reduce, setReduce] = React.useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e: MediaQueryListEvent) => setReduce(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return reduce
}

// ── Provider ──────────────────────────────────────────────────────────

export function ToastProvider() {
  const [state, dispatch] = useReducer(reducer, { items: [] })
  const nextId = useRef(0)
  const reduceMotion = useReducedMotion()

  // Subscribe to toastBus
  useEffect(() => {
    const unsub = onToast((event: ToastEvent) => {
      const id = nextId.current++
      dispatch({
        type: 'ADD',
        item: {
          id,
          variant: event.variant,
          message: event.message,
          options: event.options,
        },
      })
    })
    return unsub
  }, [])

  const handleDismiss = useCallback((id: number) => {
    dispatch({ type: 'DISMISS', id })
  }, [])

  if (state.items.length === 0) return null

  return (
    <div
      aria-label="Notifications"
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: zIndex.toast,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {state.items.map((item) => (
        <div key={item.id} style={{ pointerEvents: 'auto' }}>
          <Toast item={item} onDismiss={handleDismiss} reduceMotion={reduceMotion} />
        </div>
      ))}
    </div>
  )
}
