/**
 * LiteModeToggle.tsx | v1.0.0 | 2026-06-12
 * Purpose: Pixel-art power switch to toggle lite/full mode. Fixed bottom-left,
 * pure CSS (no image assets), WAI-ARIA switch role, keyboard operable.
 */

import React, { useCallback } from 'react'
import { useUiPrefs } from '@/store/uiPrefs'

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
        zIndex: 9999,
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
          border: 3px solid #374151;
          border-radius: 6px;
          background: ${liteMode ? '#1f2937' : '#065f46'};
          box-shadow:
            inset -2px -2px 0 #111827,
            inset 2px 2px 0 ${liteMode ? '#4b5563' : '#34d399'},
            0 0 ${liteMode ? '0' : '8px'} ${liteMode ? 'transparent' : '#34d39966'};
          transition: background 0.15s, box-shadow 0.15s;
          image-rendering: pixelated;
        }
        .lite-toggle-switch:focus-visible,
        [role="switch"]:focus-visible .lite-toggle-switch {
          outline: 3px solid #60a5fa;
          outline-offset: 2px;
        }
        .lite-toggle-led {
          width: 12px;
          height: 12px;
          border: 2px solid ${liteMode ? '#374151' : '#059669'};
          border-radius: 2px;
          background: ${liteMode ? '#6b7280' : '#34d399'};
          box-shadow: ${liteMode ? 'none' : '0 0 6px #34d399, 0 0 12px #34d39944'};
          image-rendering: pixelated;
        }
        .lite-toggle-label {
          position: absolute;
          bottom: -18px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 9px;
          font-family: monospace;
          color: #9ca3af;
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
