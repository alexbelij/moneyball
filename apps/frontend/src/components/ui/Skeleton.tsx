/**
 * Skeleton | v1.0.0 | 2026-06-17
 * Purpose: Pixel shimmer placeholder for loading data.
 * T67: async blocking-states — skeleton loaders for data panels.
 * Variants: text, block, avatar, row.
 * Respects prefers-reduced-motion (static, no shimmer).
 * All colours from tokens.ts — no border-radius.
 */

import React from 'react'
import { palette, borders } from '@/styles/tokens'

export type SkeletonVariant = 'text' | 'block' | 'avatar' | 'row'

export interface SkeletonProps {
  /** Shape variant. Default: 'text'. */
  variant?: SkeletonVariant
  /** Width in px or CSS string. Default: auto based on variant. */
  width?: number | string
  /** Height in px or CSS string. Default: auto based on variant. */
  height?: number | string
  /** Number of text lines to show (only for variant='text'). Default: 1. */
  lines?: number
}

const SHIMMER_KEYFRAMES = `
@keyframes px-shimmer {
  0%   { opacity: 0.15; }
  50%  { opacity: 0.35; }
  100% { opacity: 0.15; }
}
@media (prefers-reduced-motion: reduce) {
  .px-skeleton-bar { animation: none !important; opacity: 0.25 !important; }
}
`

let injected = false
function injectOnce() {
  if (injected || typeof document === 'undefined') return
  const s = document.createElement('style')
  s.textContent = SHIMMER_KEYFRAMES
  document.head.appendChild(s)
  injected = true
}

const DEFAULTS: Record<SkeletonVariant, { w: number | string; h: number }> = {
  text:   { w: '100%', h: 16 },
  block:  { w: '100%', h: 80 },
  avatar: { w: 40,     h: 40 },
  row:    { w: '100%', h: 28 },
}

export function Skeleton({ variant = 'text', width, height, lines = 1 }: SkeletonProps) {
  injectOnce()
  const def = DEFAULTS[variant]
  const w = width ?? def.w
  const h = height ?? def.h

  if (variant === 'text' && lines > 1) {
    return (
      <div role="status" aria-label="Loading" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className="px-skeleton-bar"
            style={{
              ...barStyle,
              width: i === lines - 1 ? '60%' : (w as string),
              height: typeof h === 'number' ? h : undefined,
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      role="status"
      aria-label="Loading"
      className="px-skeleton-bar"
      style={{
        ...barStyle,
        width: typeof w === 'number' ? w : w,
        height: typeof h === 'number' ? h : h,
      }}
    />
  )
}

const barStyle: React.CSSProperties = {
  background: palette.wood700,
  border: borders.rule,
  animation: 'px-shimmer 1.4s ease-in-out infinite',
  flexShrink: 0,
}

/**
 * SkeletonRows: convenience wrapper for table-like loading.
 * Renders N rows of skeleton bars.
 */
export function SkeletonRows({ count = 3, rowHeight = 28 }: { count?: number; rowHeight?: number }) {
  return (
    <div role="status" aria-label="Loading data" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} variant="row" height={rowHeight} />
      ))}
    </div>
  )
}
