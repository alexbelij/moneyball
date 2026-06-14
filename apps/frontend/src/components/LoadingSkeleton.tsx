/**
 * LoadingSkeleton | v1.2.0 | 2026-06-14
 * Purpose: SNES-styled loading skeleton shown until Phaser scene:ready fires.
 * T13: pixel-art frame, animated dots (CSS only), design-spec palette.
 * T33: migrated to shared tokens (fixed wrong wood-700/500 values).
 * Reserves the full viewport to avoid layout shift.
 */

import React, { useEffect, useState } from 'react'
import { GameEventBus } from '@/events/GameEventBus'
import { palette, accents, text, fonts, borders, shadows, zIndex, type as typo } from '@/styles/tokens'

/** Hook: returns true once GameEventBus 'scene:ready' has fired. */
export function useSceneReady(): boolean {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const handler = () => setReady(true)
    GameEventBus.on('scene:ready', handler)
    return () => GameEventBus.off('scene:ready', handler)
  }, [])

  return ready
}

export function LoadingSkeleton() {
  const [dots, setDots] = useState('')

  useEffect(() => {
    const id = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'))
    }, 400)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      role="status"
      aria-label="Loading game"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: palette.surface,
        zIndex: zIndex.loading,
      }}
    >
      {/* Pixel-art frame */}
      <div style={{
        border: borders.standard,
        borderRadius: 0,
        padding: '24px 32px',
        background: palette.wood900,
        boxShadow: shadows.hard,
        textAlign: 'center',
      }}>
        {/* CRT scanline effect */}
        <div style={{
          fontFamily: fonts.header,
          ...typo.hdr,
          color: accents.gold,
          letterSpacing: '-0.5px',
          marginBottom: 12,
        }}>
          MONEYBALL CABINET
        </div>

        {/* Animated pixel loading bar */}
        <div style={{
          width: 200,
          height: 8,
          border: borders.standard,
          borderRadius: 0,
          background: palette.surface,
          overflow: 'hidden',
          margin: '0 auto 12px',
        }}>
          <div style={{
            width: '40%',
            height: '100%',
            background: accents.gold,
            animation: 'pixelLoadSlide 1.5s steps(8) infinite',
          }} />
        </div>

        <div style={{
          fontFamily: fonts.body,
          ...typo.bodyLg,
          color: text.dim,
          minWidth: 160,
        }}>
          Loading{dots}
        </div>

        <div style={{
          fontFamily: fonts.body,
          ...typo.dataSm,
          color: text.muted,
          marginTop: 8,
        }}>
          Preparing the scouting room
        </div>
      </div>

      {/* Inline keyframes for the loading bar animation */}
      <style>{`
        @keyframes pixelLoadSlide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
        }
      `}</style>
    </div>
  )
}
