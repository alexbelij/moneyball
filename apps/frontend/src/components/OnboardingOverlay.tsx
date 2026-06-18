/**
 * OnboardingOverlay | v1.0.0 | 2026-06-17
 * Purpose: First-run guided overlay (T59). 3-step walkthrough that introduces
 *          the cabinet, explains what to do, and highlights the memory story.
 *          Dismissible, skippable, remembered in localStorage.
 *          Pixel-styled, token-pure, English-only, no emoji.
 */

import React, { useState, useCallback, useEffect } from 'react'
import { PixelButton } from '@/components/ui'
import { palette, text, fonts, borders, shadows, zIndex, spacing, type as typo } from '@/styles/tokens'

const STORAGE_KEY = 'moneyball.onboarding-done'

interface Step {
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    title: 'Welcome to the Cabinet',
    body: 'Five autonomous agents predict real football matches. Each one has its own methodology, personality, and persistent memory on Walrus.',
  },
  {
    title: 'Explore the Agents',
    body: 'Click any agent in the room to open their dossier. Browse predictions, see their scoring formula, and start a conversation.',
  },
  {
    title: 'Watch Memory Evolve',
    body: 'Open the "Day 1 vs Now" tab in any dossier to see how an agent changed over time. Every parameter shift is verifiable on-chain.',
  },
]

export function OnboardingOverlay() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })
  const [step, setStep] = useState(0)

  const dismiss = useCallback(() => {
    setDismissed(true)
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* quota / private mode — still dismiss for session */
    }
  }, [])

  // Don't render if already seen.
  if (dismissed) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div
      style={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome tour"
    >
      <div style={styles.card}>
        {/* Step indicator */}
        <div style={styles.stepIndicator}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                background: i === step ? palette.wood100 : palette.wood700,
                border: borders.standard,
              }}
            />
          ))}
        </div>

        {/* Content */}
        <h2 style={styles.title}>{current.title}</h2>
        <p style={styles.body}>{current.body}</p>

        {/* Actions */}
        <div style={styles.actions}>
          <PixelButton size="small" variant="ghost" onClick={dismiss}>
            Skip
          </PixelButton>
          <div style={{ display: 'flex', gap: spacing.sm }}>
            {step > 0 && (
              <PixelButton size="small" onClick={() => setStep((s) => s - 1)}>
                Back
              </PixelButton>
            )}
            {isLast ? (
              <PixelButton size="small" variant="primary" onClick={dismiss}>
                Got it
              </PixelButton>
            ) : (
              <PixelButton size="small" variant="primary" onClick={() => setStep((s) => s + 1)}>
                Next
              </PixelButton>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Reset onboarding (for testing / dev). */
export function resetOnboarding(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* noop */
  }
}

/* ── Styles ──────────────────────────────────────────────────────────── */

const styles = {
  backdrop: {
    position: 'fixed' as const,
    inset: 0,
    zIndex: zIndex.overlay + 10,
    background: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },

  card: {
    background: palette.surface,
    border: borders.standard,
    boxShadow: shadows.hard,
    padding: spacing.lg,
    maxWidth: 420,
    width: '100%',
  },

  stepIndicator: {
    display: 'flex',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },

  title: {
    ...typo.hdr,
    fontFamily: fonts.header,
    color: text.primary,
    margin: `0 0 ${spacing.sm}px`,
  } as React.CSSProperties,

  body: {
    ...typo.body,
    fontFamily: fonts.body,
    color: text.dim,
    margin: `0 0 ${spacing.lg}px`,
    lineHeight: '1.5',
  } as React.CSSProperties,

  actions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
}
