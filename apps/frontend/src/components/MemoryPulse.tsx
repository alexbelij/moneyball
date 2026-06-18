/**
 * MemoryPulse | v1.0.0 | 2026-06-17
 * Purpose: Animated "heartbeat" indicator showing an agent's memory
 * activity — how many times it has slept, evolved, and persisted to
 * Walrus. The pulse animates faster when there's recent activity.
 */

import React, { useEffect, useState } from 'react'
import { palette, accents, text, fonts, borders, type as typo } from '@/styles/tokens'
import { getAgentEvolution, getAgentParams } from '@/lib/api'

interface PulseData {
  version: number
  evolutionCount: number
  /** Hours since last evolution */
  hoursSinceLastEvo: number | null
}

export function MemoryPulse({ agentId }: { agentId: string }) {
  const [data, setData] = useState<PulseData | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([getAgentParams(agentId), getAgentEvolution(agentId)]).then(
      ([paramsRes, evoRes]) => {
        if (!alive) return
        const items = evoRes.items ?? []
        const lastEvo = items.length > 0
          ? items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
          : null
        const hoursSince = lastEvo
          ? (Date.now() - new Date(lastEvo.createdAt).getTime()) / 3600000
          : null
        setData({
          version: paramsRes?.params?.version ?? 0,
          evolutionCount: items.length,
          hoursSinceLastEvo: hoursSince,
        })
      },
      () => { /* ignore errors — pulse is non-critical */ },
    )
    return () => { alive = false }
  }, [agentId])

  if (!data) return null

  // Pulse speed based on recency (faster = more recent activity)
  const isRecent = data.hoursSinceLastEvo !== null && data.hoursSinceLastEvo < 24
  const pulseClass = isRecent ? 'fast' : 'slow'

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 8px',
        border: borders.rule,
        background: palette.surface,
      }}
      title={`Memory v${data.version} · ${data.evolutionCount} evolution${data.evolutionCount !== 1 ? 's' : ''}`}
    >
      {/* Animated pulse dot */}
      <span style={{
        display: 'inline-block',
        width: 6,
        height: 6,
        background: isRecent ? accents.green : accents.gold,
        animation: `pulse-${pulseClass} ${isRecent ? '1s' : '2.5s'} ease-in-out infinite`,
      }} />
      <span style={{ ...typo.caption, color: text.muted, fontFamily: fonts.body }}>
        mem v{data.version}
      </span>
      <span style={{ ...typo.caption, color: text.faint, fontFamily: fonts.body }}>
        {data.evolutionCount} evo
      </span>

      {/* Inline CSS animation */}
      <style>{`
        @keyframes pulse-fast {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
