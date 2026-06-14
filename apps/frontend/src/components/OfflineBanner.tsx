/**
 * OfflineBanner | v2.1.0 | 2026-06-14
 * Purpose: When the backend is waking (cold start / 502 / timeout), show an
 * in-character "the pundits are waking up…" pixel state with auto-retry,
 * instead of a raw error. Tokens only; reduced-motion respected.
 *
 * T18: original offline indicator.
 * T33: migrated to shared tokens.
 * T41: waking-state UX — auto-retry with progress, character flavour.
 */

import React, { useEffect, useRef, useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import { palette, accents, fonts, zIndex, borders, shadows, type as typo } from '@/styles/tokens'

/** Lazy backend URL — avoids crash when VITE_BACKEND_URL is missing (tests). */
function getBackendUrl(): string {
  try {
    const v = (import.meta as any).env?.VITE_BACKEND_URL as string | undefined
    return v || ''
  } catch { return '' }
}

/** Flavour messages that cycle while the backend wakes. */
const WAKING_LINES = [
  'The pundits are waking up…',
  'Dr. Morgan is reviewing overnight xG data…',
  'Scout Alvarez is brewing coffee…',
  'Viktor Kane is sharpening his contrarian takes…',
  'Sofia Mendes is checking the morning lines…',
  'Madame Pythia is consulting the stars…',
  'Server cold-starting on Render free tier…',
  'Almost there — warming up the prediction engine…',
] as const

/** How often to retry the health check (ms). */
const RETRY_INTERVAL = 4000
/** How often to cycle the flavour line (ms). */
const LINE_CYCLE_MS = 3000

export function OfflineBanner() {
  const isConnected = useGameStore((s) => s.ui.isConnected)
  const [retryCount, setRetryCount] = useState(0)
  const [lineIndex, setLineIndex] = useState(0)
  const [isWaking, setIsWaking] = useState(false)
  const retryTimer = useRef<ReturnType<typeof setInterval>>()
  const lineTimer = useRef<ReturnType<typeof setInterval>>()

  // When disconnected, start probing the backend health endpoint
  useEffect(() => {
    if (isConnected) {
      // Reset state when reconnected
      setRetryCount(0)
      setLineIndex(0)
      setIsWaking(false)
      return
    }

    // Mark as waking after a brief delay (avoid flash for quick reconnects)
    const wakingDelay = setTimeout(() => setIsWaking(true), 800)

    // Health check polling
    let count = 0
    const probe = async () => {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)
        const base = getBackendUrl()
        if (!base) return
        await fetch(new URL('/health', base).toString(), {
          signal: controller.signal,
        })
        clearTimeout(timeout)
        // Health OK — socket.io will reconnect on its own
      } catch {
        // Still waking
      }
      count++
      setRetryCount(count)
    }

    void probe()
    retryTimer.current = setInterval(probe, RETRY_INTERVAL)

    return () => {
      clearTimeout(wakingDelay)
      clearInterval(retryTimer.current)
    }
  }, [isConnected])

  // Cycle flavour lines
  useEffect(() => {
    if (!isWaking) return
    lineTimer.current = setInterval(() => {
      setLineIndex((prev) => (prev + 1) % WAKING_LINES.length)
    }, LINE_CYCLE_MS)
    return () => clearInterval(lineTimer.current)
  }, [isWaking])

  if (isConnected) return null

  // Brief disconnection: don't flash the full panel
  if (!isWaking) return null

  // Check reduced-motion preference
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Reconnecting to server"
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        zIndex: zIndex.topmost,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '12px 16px',
        background: palette.wood900,
        borderBottom: `2px solid ${accents.gold}`,
        fontFamily: fonts.body,
        boxShadow: shadows.hard,
        pointerEvents: 'none',
      }}
    >
      {/* Flavour line */}
      <div style={{
        ...typo.body,
        color: accents.gold,
        letterSpacing: '0.5px',
      }}>
        {WAKING_LINES[lineIndex]}
      </div>

      {/* Progress bar */}
      <div style={{
        marginTop: 8,
        width: '100%',
        maxWidth: 320,
        height: 6,
        background: palette.surface,
        border: borders.rule,
        overflow: 'hidden',
        position: 'relative',
      }}>
        {!prefersReducedMotion && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: '30%',
            background: accents.gold,
            animation: 'waking-slide 1.5s ease-in-out infinite',
          }} />
        )}
        {prefersReducedMotion && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: '100%',
            background: accents.gold,
            opacity: 0.3,
          }} />
        )}
      </div>

      {/* Retry counter */}
      <div style={{
        marginTop: 6,
        ...typo.caption,
        color: palette.wood300,
        letterSpacing: '0.5px',
      }}>
        {retryCount > 0
          ? `Retry ${retryCount} · auto-reconnecting`
          : 'Connecting…'}
      </div>

      {/* Inject animation keyframes */}
      <style>{`
        @keyframes waking-slide {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(250%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  )
}
