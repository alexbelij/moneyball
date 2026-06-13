/**
 * LiteModeToggle.tsx | v1.1.0 | 2026-06-13
 * Purpose: Pixel-art power switch to toggle lite/full mode. Fixed bottom-left,
 * pure CSS (no image assets), WAI-ARIA switch role, keyboard operable.
 * T33: migrated to shared tokens.
 */

import React, { useCallback } from 'react'
import { useUiPrefs } from '@/store/uiPrefs'
import { palette, accents, text, fonts, borders, zIndex } from '@/styles/tokens'

const TOGGLE_SIZE = 48

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

  /* Dynamic colours based on mode */
  const borderC   = liteMode ? palette.wood700  : accents.green
  const bgC       = liteMode ? palette.wood900  : palette.wallGreen
  const highlightC = liteMode ? palette.wood500  : accents.green
  const ledBorderC = liteMode ? palette.wood700  : accents.green
  const ledBgC     = liteMode ? palette.wood300  : accents.green
  const glowC      = liteMode ? 'transparent'    : `${accents.green}66`
  const innerGlowC = liteMode ? palette.wood900  : accents.green

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
        width: TOGGLE_SIZE,
        height: TOGGLE_SIZE,
        cursor: 'pointer',
        imageRendering: 'pixelated',
        outline: 'none',
      }}
    >
      <style>{`
        .lite-toggle-switch {
          display: flex;
          align-items: center;
          justify-content: center;
          width: ${TOGGLE_SIZE}px;
          height: ${TOGGLE_SIZE}px;
          border: 3px solid ${borderC};
          border-radius: 0;
          background: ${bgC};
          box-shadow:
            inset -2px -2px 0 ${palette.wood900},
            inset 2px 2px 0 ${highlightC},
            0 0 ${liteMode ? '0' : '8px'} ${glowC};
          transition: background 0.15s, box-shadow 0.15s;
          image-rendering: pixelated;
        }
        .lite-toggle-switch:focus-visible,
        [role="switch"]:focus-visible .lite-toggle-switch {
          outline: 3px solid ${accents.gold};
          outline-offset: 2px;
        }
        .lite-toggle-led {
          width: 12px;
          height: 12px;
          border: 2px solid ${ledBorderC};
          border-radius: 0;
          background: ${ledBgC};
          box-shadow: ${liteMode ? 'none' : `0 0 6px ${innerGlowC}, 0 0 12px ${glowC}`};
          image-rendering: pixelated;
        }
        .lite-toggle-label {
          position: absolute;
          bottom: -18px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 12px;
          font-family: ${fonts.body};
          color: ${text.muted};
          white-space: nowrap;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          image-rendering: pixelated;
        }
      `}</style>
      <div className="lite-toggle-switch">
        <div className="lite-toggle-led" />
      </div>
      <span className="lite-toggle-label">
        {liteMode ? 'lite' : 'full'}
      </span>
    </div>
  )
}
