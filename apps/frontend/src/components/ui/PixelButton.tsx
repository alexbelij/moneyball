/**
 * PixelButton | v1.1.0 | 2026-06-17
 * Purpose: SNES-styled button with pressed/hover/disabled/focus states.
 * T14: 2px pixel borders, bevel shadow, design-spec palette.
 * T67: `busy` prop — disables button, shows inline Spinner, preserves width.
 */

import React from 'react'
import styles from './pixel.module.css'
import { Spinner } from './Spinner'

export interface PixelButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'danger' | 'ghost'
  size?: 'default' | 'small'
  /** When true: disabled + shows a Spinner before the label. */
  busy?: boolean
}

const variantClass: Record<string, string> = {
  primary: styles.btnPrimary,
  danger: styles.btnDanger,
  ghost: styles.btnGhost,
}

export function PixelButton({
  variant = 'default',
  size = 'default',
  busy = false,
  className,
  children,
  disabled,
  ...rest
}: PixelButtonProps) {
  const classes = [
    styles.btn,
    variantClass[variant] ?? '',
    size === 'small' ? styles.btnSmall : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  const isDisabled = disabled || busy

  return (
    <button
      className={classes}
      disabled={isDisabled}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy && <Spinner size={size === 'small' ? 10 : 14} />}
      {children}
    </button>
  )
}
