/**
 * TimelineScrubber | v1.0.0 | 2026-06-17
 * Purpose: Horizontal timeline slider showing agent parameter evolution
 * over time. Scrub through days to see how an agent's memory mutated.
 * Renders a mini sparkline of confidence bias over versions.
 */

import React, { useMemo, useState } from 'react'
import { palette, accents, text, fonts, borders, shadows, type as typo } from '@/styles/tokens'
import { formatDateShort } from '@/lib/formatDate'
import type { EvolutionItem } from '@/lib/api'

interface TimelinePoint {
  date: string
  version: number
  confidenceBias: number
  hedgingLevel: number
  summary: string
}

/**
 * Build timeline data by accumulating evolution diffs from a base.
 */
function buildTimeline(
  evolutions: EvolutionItem[],
  baseBias: number,
  baseHedging: number,
): TimelinePoint[] {
  const sorted = [...evolutions].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const points: TimelinePoint[] = []

  let bias = baseBias
  let hedging = baseHedging
  let version = 0

  // Day 1 baseline
  if (sorted.length > 0) {
    // Walk backwards to compute initial values
    for (const ev of sorted) {
      bias -= ev.parameterDiff?.confidenceBias ?? 0
      hedging -= ev.parameterDiff?.hedgingLevel ?? 0
    }
    // Reset and accumulate forward
    let accBias = bias
    let accHedging = hedging
    points.push({
      date: sorted[0].createdAt,
      version: 0,
      confidenceBias: accBias,
      hedgingLevel: accHedging,
      summary: 'Day 1 — initial calibration',
    })

    for (const ev of sorted) {
      accBias += ev.parameterDiff?.confidenceBias ?? 0
      accHedging += ev.parameterDiff?.hedgingLevel ?? 0
      version++
      points.push({
        date: ev.createdAt,
        version,
        confidenceBias: accBias,
        hedgingLevel: accHedging,
        summary: ev.summary ?? `Evolution v${version}`,
      })
    }
  }

  return points
}

function Sparkline({ points, accessor, color, height = 32 }: {
  points: TimelinePoint[]
  accessor: (p: TimelinePoint) => number
  color: string
  height?: number
}) {
  if (points.length < 2) return null

  const values = points.map(accessor)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 0.001

  const w = 200
  const padding = 4

  const pathPoints = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * (w - padding * 2)
    const y = padding + (1 - (v - min) / range) * (height - padding * 2)
    return `${x},${y}`
  })

  return (
    <svg
      width={w}
      height={height}
      viewBox={`0 0 ${w} ${height}`}
      style={{ display: 'block' }}
      aria-hidden="true"
    >
      {/* Grid line at zero if visible */}
      {min <= 0 && max >= 0 && (
        <line
          x1={padding} x2={w - padding}
          y1={padding + (1 - (0 - min) / range) * (height - padding * 2)}
          y2={padding + (1 - (0 - min) / range) * (height - padding * 2)}
          stroke={palette.wood500}
          strokeWidth={1}
          strokeDasharray="2,2"
        />
      )}
      <polyline
        points={pathPoints.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="miter"
      />
      {/* Data dots */}
      {pathPoints.map((pt, i) => {
        const [x, y] = pt.split(',').map(Number)
        return (
          <rect
            key={i}
            x={x - 2}
            y={y - 2}
            width={4}
            height={4}
            fill={color}
          />
        )
      })}
    </svg>
  )
}

export function TimelineScrubber({ evolutions, currentBias, currentHedging }: {
  evolutions: EvolutionItem[]
  currentBias: number
  currentHedging: number
}) {
  const timeline = useMemo(
    () => buildTimeline(evolutions, currentBias, currentHedging),
    [evolutions, currentBias, currentHedging],
  )

  const [activeIdx, setActiveIdx] = useState<number>(timeline.length - 1)

  if (timeline.length < 2) {
    return (
      <div style={{ ...typo.dataSm, color: text.muted, marginTop: 8 }}>
        Timeline needs at least one evolution event to display.
      </div>
    )
  }

  const active = timeline[Math.min(activeIdx, timeline.length - 1)]

  return (
    <div
      style={{
        background: palette.surface,
        border: borders.standard,
        padding: 10,
        marginBottom: 8,
        boxShadow: shadows.hardSmall,
      }}
    >
      <div style={{
        ...typo.hdrSm, fontFamily: fonts.header, color: text.muted,
        letterSpacing: '-0.5px', textTransform: 'uppercase', marginBottom: 8,
      }}>
        MEMORY TIMELINE
      </div>

      {/* Sparklines */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
        <div>
          <div style={{ ...typo.caption, color: accents.gold, marginBottom: 2 }}>confidence bias</div>
          <Sparkline points={timeline} accessor={(p) => p.confidenceBias} color={accents.gold} />
        </div>
        <div>
          <div style={{ ...typo.caption, color: accents.green, marginBottom: 2 }}>hedging level</div>
          <Sparkline points={timeline} accessor={(p) => p.hedgingLevel} color={accents.green} />
        </div>
      </div>

      {/* Scrubber input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ ...typo.caption, color: text.muted, whiteSpace: 'nowrap' }}>v0</span>
        <input
          type="range"
          min={0}
          max={timeline.length - 1}
          value={activeIdx}
          onChange={(e) => setActiveIdx(Number(e.target.value))}
          aria-label="Timeline scrubber"
          style={{
            flex: 1,
            accentColor: accents.gold,
            cursor: 'pointer',
          }}
        />
        <span style={{ ...typo.caption, color: text.muted, whiteSpace: 'nowrap' }}>v{timeline.length - 1}</span>
      </div>

      {/* Active point info */}
      <div style={{
        marginTop: 8,
        padding: '6px 8px',
        border: `1px solid ${palette.wood500}`,
        background: palette.wood900,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', ...typo.caption }}>
          <span style={{ color: accents.gold }}>v{active.version}</span>
          <span style={{ color: text.faint }}>{formatDateShort(active.date)}</span>
        </div>
        <div style={{ ...typo.caption, color: text.dim, marginTop: 2 }}>
          {active.summary}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 4, ...typo.caption, fontFamily: 'monospace' }}>
          <span style={{ color: accents.gold }}>
            bias: {active.confidenceBias >= 0 ? '+' : ''}{active.confidenceBias.toFixed(3)}
          </span>
          <span style={{ color: accents.green }}>
            hedge: {active.hedgingLevel >= 0 ? '+' : ''}{active.hedgingLevel.toFixed(3)}
          </span>
        </div>
      </div>
    </div>
  )
}
