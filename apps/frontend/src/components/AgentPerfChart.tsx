/**
 * AgentPerfChart | v1.1.0 | 2026-06-14
 * Purpose: Compact single-agent performance chart for the dossier (T27).
 * Hand-rolled SVG (no chart deps), pixel-styled per design-spec. Plots the
 * agent's rolling Brier score over resolved matches, draws vertical markers
 * where the params version bumped (evolution), and shows headline accuracy +
 * Brier. Keyboard-accessible data points, reduced-motion safe (no animation).
 */

import React, { useCallback, useMemo, useState } from 'react'
import type { AgentPerfPoint, AgentPerfSeries } from '@/lib/agentPerf'
import { versionChangeIndices } from '@/lib/agentPerf'
import { palette, accents, text, fonts, borders, shadows, agentColors, chartGrid, type as typo } from '@/styles/tokens'

const CHART_W = 408
const CHART_H = 150
const PAD = { top: 14, right: 12, bottom: 24, left: 36 }
const PLOT_W = CHART_W - PAD.left - PAD.right
const PLOT_H = CHART_H - PAD.top - PAD.bottom

export function AgentPerfChart({ series }: { series: AgentPerfSeries }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)
  const color = agentColors[series.agentId] ?? accents.gold
  const pts = series.points
  const markers = useMemo(() => versionChangeIndices(pts), [pts])

  const maxY = useMemo(() => {
    let max = 0.5
    for (const p of pts) max = Math.max(max, p.rollingBrier)
    return Math.ceil(max * 10) / 10
  }, [pts])

  const maxX = pts.length > 0 ? pts[pts.length - 1].matchIndex : 1
  const xScale = (idx: number) => PAD.left + ((idx - 1) / Math.max(maxX - 1, 1)) * PLOT_W
  const yScale = (val: number) => PAD.top + (1 - val / maxY) * PLOT_H

  const yTicks = useMemo(() => {
    const ticks: number[] = []
    const step = maxY <= 0.5 ? 0.1 : 0.2
    for (let v = 0; v <= maxY + 0.001; v += step) ticks.push(Math.round(v * 100) / 100)
    return ticks
  }, [maxY])

  const onPoint = useCallback((pt: AgentPerfPoint, cx: number, cy: number) => {
    setTooltip({
      x: cx, y: cy,
      text: `${pt.matchId}\nBrier ${pt.rollingBrier.toFixed(3)} · acc ${(pt.rollingAccuracy * 100).toFixed(0)}%\n${pt.correct ? '✓' : '✗'} ${pt.pick}${pt.paramsVersion != null ? ` · params v${pt.paramsVersion}` : ''}`,
    })
  }, [])

  // Stepped pixel-art path
  let pathD = ''
  pts.forEach((pt, i) => {
    const cx = xScale(pt.matchIndex)
    const cy = yScale(pt.rollingBrier)
    pathD += i === 0 ? `M ${cx} ${cy}` : ` H ${cx} V ${cy}`
  })

  const accStr = series.finalAccuracy != null ? `${(series.finalAccuracy * 100).toFixed(0)}%` : '—'
  const brierStr = series.finalBrier != null ? series.finalBrier.toFixed(3) : '—'

  return (
    <div style={{
      marginBottom: 8, border: borders.standard, background: palette.surface,
      padding: 4, position: 'relative',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        padding: '4px 8px',
      }}>
        <span style={{ ...typo.hdrSm, fontFamily: fonts.header, color: text.muted, letterSpacing: '-0.5px' }}>
          ROLLING BRIER
        </span>
        <span style={{ ...typo.caption, color: text.dim }}>
          acc <b style={{ color: accents.green }}>{accStr}</b> · brier <b style={{ color }}>{brierStr}</b>
        </span>
      </div>

      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label={`Rolling Brier score for ${series.agentId.replace('_', ' ')} over ${series.resolvedCount} resolved matches; lower is better.`}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* grid */}
        {yTicks.map((v) => (
          <g key={`g-${v}`}>
            <line x1={PAD.left} y1={yScale(v)} x2={CHART_W - PAD.right} y2={yScale(v)}
              stroke={chartGrid} strokeWidth={1} strokeDasharray="2 4" />
            <text x={PAD.left - 4} y={yScale(v) + 4} textAnchor="end" fill={text.muted}
              style={{ ...typo.svgAxis, fontFamily: fonts.body }}>{v.toFixed(1)}</text>
          </g>
        ))}

        {/* evolution markers (params version bump) */}
        {markers.map((idx) => (
          <g key={`m-${idx}`}>
            <line x1={xScale(idx)} y1={PAD.top} x2={xScale(idx)} y2={PAD.top + PLOT_H}
              stroke={accents.gold} strokeWidth={1} strokeDasharray="3 2" opacity={0.7} />
            <text x={xScale(idx)} y={PAD.top - 4} textAnchor="middle" fill={accents.gold}
              style={{ ...typo.svgAxis, fontFamily: fonts.body }}>evo</text>
          </g>
        ))}

        {/* x labels */}
        {pts.map((pt) => (
          <text key={`x-${pt.matchIndex}`} x={xScale(pt.matchIndex)} y={CHART_H - 6}
            textAnchor="middle" fill={text.muted} style={{ ...typo.svgAxis, fontFamily: fonts.body }}>
            {pt.matchIndex}
          </text>
        ))}

        {/* line + markers */}
        <path d={pathD} fill="none" stroke={color} strokeWidth={2} />
        {pts.map((pt) => {
          const cx = xScale(pt.matchIndex)
          const cy = yScale(pt.rollingBrier)
          return (
            <rect
              key={`p-${pt.matchIndex}`}
              x={cx - 3} y={cy - 3} width={6} height={6}
              fill={pt.correct ? accents.green : accents.red} stroke={palette.surface} strokeWidth={1}
              style={{ cursor: 'pointer' }}
              tabIndex={0}
              role="button"
              aria-label={`Match ${pt.matchIndex}: Brier ${pt.rollingBrier.toFixed(3)}, ${pt.correct ? 'correct' : 'incorrect'}`}
              onMouseEnter={() => onPoint(pt, cx, cy)}
              onFocus={() => onPoint(pt, cx, cy)}
              onBlur={() => setTooltip(null)}
            />
          )
        })}
      </svg>

      {tooltip && (
        <div role="tooltip" style={{
          position: 'absolute',
          left: `${(tooltip.x / CHART_W) * 100}%`,
          top: `${((tooltip.y / CHART_H) * 100) - 6}%`,
          transform: 'translate(-50%, -100%)',
          background: palette.wood900, border: borders.standard, padding: '4px 8px',
          ...typo.caption, fontFamily: fonts.body, color: palette.paper,
          whiteSpace: 'pre-line', pointerEvents: 'none', zIndex: 10,
          boxShadow: shadows.hardSmall,
        }}>
          {tooltip.text}
        </div>
      )}
    </div>
  )
}
