/**
 * Toast | v1.0.0 | 2026-06-17
 * Purpose: Single pixel "coach dialogue" toast notification.
 *
 * T66: Anna's design — rounded 16-bit bevel box, 240px wide, 56×56 coach
 * avatar on the left, scrollable text column, variant accent border,
 * thin progress bar, pause-on-hover, Esc to dismiss focused toast.
 * All colours from tokens.ts.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'
import type { ToastVariant, ToastOptions } from './toastBus'
import { palette, accents, fonts, borders, shadows, text as textTokens, type as typo } from '@/styles/tokens'

// ── Agent avatar mapping ──────────────────────────────────────────────

const AVATAR_BASE = '/assets/avatars'
const AGENT_AVATARS: Record<string, string> = {
  dr_morgan: `${AVATAR_BASE}/dr_morgan.png`,
  scout_alvarez: `${AVATAR_BASE}/scout_alvarez.png`,
  viktor_kane: `${AVATAR_BASE}/viktor_kane.png`,
  sofia_mendes: `${AVATAR_BASE}/sofia_mendes.png`,
  madame_pythia: `${AVATAR_BASE}/madame_pythia.png`,
  system: `${AVATAR_BASE}/system.png`,
}

function getAvatarSrc(coach?: string): string {
  if (coach && AGENT_AVATARS[coach]) return AGENT_AVATARS[coach]
  return AGENT_AVATARS.system
}

// ── Variant accent colours ────────────────────────────────────────────

const VARIANT_COLORS: Record<ToastVariant, string> = {
  error: accents.red,
  success: accents.green,
  info: accents.gold,
  warning: accents.gold,
}

// ── Default durations ─────────────────────────────────────────────────

const DEFAULT_DURATION: Record<ToastVariant, number> = {
  info: 4500,
  success: 4500,
  error: 7000,
  warning: 7000,
}

// ── Component ─────────────────────────────────────────────────────────

export interface ToastItemData {
  id: number
  variant: ToastVariant
  message: string
  options: ToastOptions
}

interface ToastProps {
  item: ToastItemData
  onDismiss: (id: number) => void
  /** If true, use instant show/hide (prefers-reduced-motion). */
  reduceMotion: boolean
}

export function Toast({ item, onDismiss, reduceMotion }: ToastProps) {
  const { id, variant, message, options } = item
  const durationMs = options.sticky ? 0 : (options.durationMs ?? DEFAULT_DURATION[variant])
  const accentColor = VARIANT_COLORS[variant]

  const [paused, setPaused] = useState(false)
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)
  const elapsed = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Slide in on mount
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  // Auto-dismiss timer (interval-based for pause support)
  useEffect(() => {
    if (!durationMs || paused) return
    timerRef.current = setInterval(() => {
      elapsed.current += 50
      if (elapsed.current >= durationMs) {
        dismiss()
      }
    }, 50)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [durationMs, paused]) // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = useCallback(() => {
    if (reduceMotion) {
      onDismiss(id)
      return
    }
    setExiting(true)
    setTimeout(() => onDismiss(id), 180)
  }, [id, onDismiss, reduceMotion])

  // Esc key dismisses focused toast
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') dismiss()
  }, [dismiss])

  // Progress fraction (0→1)
  const progress = durationMs ? Math.min(elapsed.current / durationMs, 1) : 0

  // a11y role
  const role = variant === 'error' ? 'alert' : 'status'
  const ariaLive = variant === 'error' ? 'assertive' as const : 'polite' as const

  // Animation styles
  const transitionDuration = reduceMotion ? '0ms' : '180ms'
  const transform = visible && !exiting ? 'translateX(0)' : 'translateX(110%)'
  const opacity = visible && !exiting ? 1 : 0

  return (
    <div
      ref={containerRef}
      role={role}
      aria-live={ariaLive}
      tabIndex={0}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={handleKeyDown}
      style={{
        width: 240,
        display: 'flex',
        alignItems: 'stretch',
        background: palette.wood900,
        border: `${borders.width}px solid ${accentColor}`,
        borderRadius: 0,
        boxShadow: shadows.hardSmall,
        overflow: 'hidden',
        position: 'relative',
        transform,
        opacity,
        transition: `transform ${transitionDuration} ease-out, opacity ${transitionDuration} ease-out`,
        outline: 'none',
      }}
    >
      {/* Avatar column */}
      <div
        style={{
          width: 56,
          minHeight: 56,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 0 8px 8px',
        }}
      >
        <img
          src={getAvatarSrc(options.coach)}
          alt={options.coach ?? 'system'}
          width={56}
          height={56}
          // Guarantee an image always shows: if an agent avatar fails to load
          // (network blip, cold start), fall back to the system avatar.
          onError={(e) => {
            const img = e.currentTarget
            if (!img.src.endsWith('system.png')) img.src = AGENT_AVATARS.system
          }}
          style={{
            imageRendering: 'pixelated',
            borderRadius: 0,
            border: `1px solid ${palette.wood500}`,
          }}
        />
      </div>

      {/* Text column */}
      <div
        style={{
          flex: 1,
          padding: '8px 24px 8px 8px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          minHeight: 56,
          maxHeight: 76,
        }}
      >
        {options.title && (
          <div
            style={{
              fontFamily: fonts.header,
              ...typo.svgDot,
              color: accentColor,
              letterSpacing: '0.5px',
              marginBottom: 4,
              lineHeight: '18px',
            }}
          >
            {options.title}
          </div>
        )}
        <div
          style={{
            fontFamily: fonts.body,
            ...typo.body,
            lineHeight: '24px',
            color: palette.paper,
            overflowY: 'auto',
            maxHeight: options.title ? 40 : 56,
            wordBreak: 'break-word',
            /* Pixel scrollbar */
            scrollbarWidth: 'thin',
            scrollbarColor: `${palette.wood500} transparent`,
          }}
        >
          {message}
        </div>
      </div>

      {/* Close button */}
      <button
        onClick={() => dismiss()}
        aria-label="Dismiss notification"
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
          width: 18,
          height: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          color: textTokens.muted,
          fontFamily: fonts.body,
          ...typo.body,
          cursor: 'pointer',
          padding: 0,
          lineHeight: '18px',
        }}
      >
        ✕
      </button>

      {/* Progress bar (thin pixel line at the bottom) */}
      {durationMs > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            height: 2,
            width: `${(1 - progress) * 100}%`,
            background: accentColor,
            transition: paused ? 'none' : 'width 50ms linear',
          }}
        />
      )}
    </div>
  )
}
