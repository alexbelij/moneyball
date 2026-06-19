/**
 * LiteModeToggle.tsx | v2.0.0 | 2026-06-19
 * Purpose: Pixel-art toggle button to switch between lite/full mode.
 * Redesigned: text inside button, LED indicator, no floating label.
 * Fixed bottom-left, WAI-ARIA switch role, keyboard operable.
 */

import React, { useCallback } from 'react'
import { useUiPrefs } from '@/store/uiPrefs'
import { palette, accents, text, fonts, borders, zIndex, type as typo } from '@/styles/tokens'

export function LiteModeToggle() {
  const liteMode = useUiPrefs((s) => s.liteMode)
  const toggleLiteMode = useUiPrefs((s) => s.toggleLiteMode)

  const handleClick = useCallback(() => {
    toggleLiteMode()
  }, [toggleLiteMode])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        toggleLiteMode()
      }
    },
    [toggleLiteMode],
  )

  const borderC = liteMode ? palette.wood700 : accents.green
  const bgC = liteMode ? palette.wood900 : palette.wallGreen
  const ledBgC = liteMode ? palette.wood500 : accents.green
  const glowC = liteMode ? 'transparent' : `${accents.green}44`

  return (
    <div
      role="switch"
      aria-checked={!liteMode}
      aria-label={liteMode ? 'Switch to full arcade mode' : 'Switch to lite dashboard mode'}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        zIndex: zIndex.topmost,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px',
        background: bgC,
        border: `2px solid ${borderC}`,
        borderRadius: 0,
        cursor: 'pointer',
        outline: 'none',
        boxShadow: `0 0 ${liteMode ? '0' : '8px'} ${glowC}`,
        imageRendering: 'pixelated',
        transition: 'background 0.15s, box-shadow 0.15s',
      }}
    >
      {/* LED indicator */}
      <span
        style={{
          width: 8,
          height: 8,
          background: ledBgC,
          border: `1px solid ${borderC}`,
          boxShadow: liteMode ? 'none' : `0 0 4px ${accents.green}`,
          flexShrink: 0,
        }}
      />
      {/* Mode label */}
      <span
        style={{
          fontFamily: fonts.header,
          ...typo.hdrSm,
          color: liteMode ? text.muted : accents.green,
          letterSpacing: 1,
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        {liteMode ? 'LITE' : 'FULL'}
      </span>
    </div>
  )
}
