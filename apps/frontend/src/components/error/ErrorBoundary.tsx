/**
 * ErrorBoundary | v1.0.0 | 2026-06-17
 * Purpose: React error boundary with pixel-art fallback panel. Catches
 * unhandled render errors in descendants and shows a retry button.
 *
 * T68: root boundary wraps the entire app; widget boundaries wrap heavy
 * components (Phaser, AgentModal). Each level can customise the fallback
 * label via `label` prop.
 *
 * Layout safety: the fallback always fills its parent with reserved space
 * (minHeight) so the rest of the UI does not collapse.
 */

import React, { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { palette, accents, fonts, borders, shadows, type as typo, zIndex } from '@/styles/tokens'

export interface ErrorBoundaryProps {
  children: ReactNode
  /** Label shown in the fallback header (e.g. "Game View", "Agent Dossier"). */
  label?: string
  /** Minimum height for the fallback panel (CSS value). Default: 200px. */
  minHeight?: string
  /**
   * If true, the fallback fills the entire viewport (used for the root boundary).
   * Default: false.
   */
  fullScreen?: boolean
  /** Optional callback when an error is caught (for logging/telemetry). */
  onError?: (error: Error, info: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.label ?? 'root'}]`, error, info.componentStack)
    this.props.onError?.(error, info)
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          label={this.props.label}
          message={this.state.error?.message}
          fullScreen={this.props.fullScreen}
          minHeight={this.props.minHeight}
          onRetry={this.handleRetry}
        />
      )
    }
    return this.props.children
  }
}

// ── Pixel fallback panel ──────────────────────────────────────────────

interface ErrorFallbackProps {
  label?: string
  message?: string
  fullScreen?: boolean
  minHeight?: string
  onRetry: () => void
}

function ErrorFallback({ label, message, fullScreen, minHeight = '200px', onRetry }: ErrorFallbackProps) {
  const containerStyle: React.CSSProperties = fullScreen
    ? {
        position: 'fixed',
        inset: 0,
        zIndex: zIndex.overlay,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: palette.bgBlack,
      }
    : {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight,
        width: '100%',
        background: palette.surface,
      }

  return (
    <div style={containerStyle} role="alert" aria-live="assertive">
      <div
        style={{
          background: palette.wood900,
          border: `${borders.width}px solid ${accents.red}`,
          boxShadow: shadows.hard,
          padding: '24px 32px',
          maxWidth: 420,
          width: '90%',
          textAlign: 'center',
        }}
      >
        {/* Header */}
        <div
          style={{
            fontFamily: fonts.header,
            ...typo.svgLabel,
            color: accents.red,
            letterSpacing: '1px',
            marginBottom: 12,
          }}
        >
          {label ? `${label} — Error` : 'Something went wrong'}
        </div>

        {/* Description */}
        <div
          style={{
            ...typo.body,
            color: palette.paper,
            marginBottom: 16,
            wordBreak: 'break-word',
          }}
        >
          {message ?? 'An unexpected error occurred.'}
        </div>

        {/* Retry button — pixel style */}
        <button
          onClick={onRetry}
          style={{
            fontFamily: fonts.header,
            ...typo.svgAxis,
            color: palette.bgBlack,
            background: accents.gold,
            border: `${borders.width}px solid ${palette.bgBlack}`,
            padding: '8px 20px',
            cursor: 'pointer',
            letterSpacing: '1px',
            boxShadow: `2px 2px 0 ${palette.bgBlack}`,
          }}
        >
          RETRY
        </button>
      </div>
    </div>
  )
}
