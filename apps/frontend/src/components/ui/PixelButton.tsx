/**
 * PixelButton | v1.0.0 | 2026-06-13
 * Purpose: SNES-styled button with pressed/hover/disabled/focus states.
 * T14: 2px pixel borders, bevel shadow, design-spec palette.
 */

import React from 'react'
import styles from './pixel.module.css'

export interface PixelButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'danger' | 'ghost'
  size?: 'default' | 'small'
}

const variantClass: Record<string, string> = {
  primary: styles.btnPrimary,
  danger: styles.btnDanger,
  ghost: styles.btnGhost,
}

export function PixelButton({
  variant = 'default',
  size = 'default',
  className,
  children,
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

  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  )
}
