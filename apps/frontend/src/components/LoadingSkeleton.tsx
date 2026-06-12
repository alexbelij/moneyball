/**
 * LoadingSkeleton | v1.0.0 | 2026-06-13
 * Purpose: SNES-styled loading skeleton shown until Phaser scene:ready fires.
 * T13: pixel-art frame, animated dots (CSS only), design-spec palette.
 * Reserves the full viewport to avoid layout shift.
 */

import React, { useEffect, useState } from 'react'
import { GameEventBus } from '@/events/GameEventBus'

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
        background: '#0c0c0c',
        zIndex: 50,
      }}
    >
      {/* Pixel-art frame */}
      <div style={{
        border: '2px solid #3a3020',
        borderRadius: 0,
        padding: '24px 32px',
        background: '#181009',
        boxShadow: '4px 4px 0 #000',
        textAlign: 'center',
      }}>
        {/* CRT scanline effect */}
        <div style={{
          fontFamily: '"Press Start 2P", monospace',
          fontSize: 12,
          color: '#e8a44a',
          letterSpacing: '-0.5px',
          marginBottom: 12,
        }}>
          MONEYBALL CABINET
        </div>

        {/* Animated pixel loading bar */}
        <div style={{
          width: 200,
          height: 8,
          border: '2px solid #3a3020',
          borderRadius: 0,
          background: '#0c0c0c',
          overflow: 'hidden',
          margin: '0 auto 12px',
        }}>
          <div style={{
            width: '40%',
            height: '100%',
            background: '#e8a44a',
            animation: 'pixelLoadSlide 1.5s steps(8) infinite',
          }} />
        </div>

        <div style={{
          fontFamily: '"VT323", monospace',
          fontSize: 18,
          color: '#d5cec0',
          minWidth: 160,
        }}>
          Loading{dots}
        </div>

        <div style={{
          fontFamily: '"VT323", monospace',
          fontSize: 14,
          color: '#7a7060',
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
      `}</style>
    </div>
  )
}
