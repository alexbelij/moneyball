/**
 * LoadingSkeleton | v2.0.0 | 2026-06-19
 * P0: Enhanced SNES-styled loading skeleton with agent roster preview,
 * animated pixel loading bar, and hackathon branding.
 * Shown until Phaser scene:ready fires.
 */

import React, { useEffect, useState } from 'react'
import { GameEventBus } from '@/events/GameEventBus'
import { PixelIcon } from '@/components/icons/PixelIcon'
import { palette, accents, text, fonts, borders, shadows, zIndex, type as typo, agentColors, spacing } from '@/styles/tokens'

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

const AGENTS = [
  { id: 'dr_morgan', name: 'Dr. Morgan', role: 'Statistician' },
  { id: 'scout_alvarez', name: 'Scout Alvarez', role: 'Form Analyst' },
  { id: 'viktor_kane', name: 'Viktor Kane', role: 'Contrarian' },
  { id: 'sofia_mendes', name: 'Sofia Mendes', role: 'Market Oracle' },
  { id: 'madame_pythia', name: 'Madame Pythia', role: 'Intuition' },
] as const

export function LoadingSkeleton() {
  const [dots, setDots] = useState('')
  const [agentIdx, setAgentIdx] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'))
    }, 400)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      setAgentIdx((i) => (i + 1) % AGENTS.length)
    }, 1200)
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
      {/* Main loading card */}
      <div style={{
        border: borders.standard,
        borderRadius: 0,
        padding: `${spacing.lg}px ${spacing.xl}px`,
        background: palette.wood900,
        boxShadow: shadows.hard,
        textAlign: 'center',
        minWidth: 300,
        maxWidth: '90vw',
      }}>
        {/* Title */}
        <div style={{
          fontFamily: fonts.header,
          ...typo.hdrLg,
          color: accents.gold,
          letterSpacing: '-0.5px',
          marginBottom: spacing.md,
        }}>
          MONEYBALL CABINET
        </div>

        {/* Agent roster preview */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: spacing.sm,
          marginBottom: spacing.md,
        }}>
          {AGENTS.map((agent, i) => {
            const color = agentColors[agent.id] ?? accents.gold
            const isActive = i === agentIdx
            return (
              <div key={agent.id} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                opacity: isActive ? 1 : 0.3,
                transition: 'opacity 0.3s steps(2)',
              }}>
                <PixelIcon name={agent.id} size={16} color={color} />
              </div>
            )
          })}
        </div>

        {/* Active agent name */}
        <div style={{
          fontFamily: fonts.body,
          ...typo.dataSm,
          color: agentColors[AGENTS[agentIdx].id] ?? accents.gold,
          marginBottom: spacing.sm,
        }}>
          {AGENTS[agentIdx].name} — {AGENTS[agentIdx].role}
        </div>

        {/* Animated pixel loading bar */}
        <div style={{
          width: '100%',
          height: 8,
          border: borders.standard,
          borderRadius: 0,
          background: palette.surface,
          overflow: 'hidden',
          margin: `0 auto ${spacing.sm}px`,
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
          ...typo.body,
          color: text.dim,
        }}>
          Loading{dots}
        </div>

        <div style={{
          fontFamily: fonts.body,
          ...typo.caption,
          color: text.faint,
          marginTop: spacing.xs,
        }}>
          Preparing the scouting room
        </div>
      </div>

      {/* Bottom branding */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: spacing.xl,
        fontFamily: fonts.body,
        ...typo.caption,
        color: text.faint,
      }}>
        <PixelIcon name="walrus" size={10} color={text.faint} />
        Walrus Memory World Cup 2026
      </div>

      {/* Inline keyframes */}
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
