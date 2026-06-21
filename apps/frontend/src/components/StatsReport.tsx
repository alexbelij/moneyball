/**
 * StatsReport | v1.3.0 | 2026-06-14
 * Purpose: Interactive predictions table + rolling Brier score SVG chart.
 * T15: hand-rolled SVG (no chart deps), pixel-styled per design-spec,
 * hover tooltips, keyboard-accessible data points.
 * T33: migrated to shared tokens (fixed wrong wood values).
 * T35: pending outcome glyph (was emoji) -> token-coloured ellipsis.
 * Rendered inside StatsBoard modal AND in Lite mode.
 */

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { getAgentPredictions, type PredictionItem } from '@/lib/api'
import { buildAllBrierSeries, type AgentBrierSeries, type BrierPoint } from '@/lib/brierSeries'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { palette, accents, text, fonts, borders, shadows, agentColors, chartGrid, type as typo } from '@/styles/tokens'

/* ── Agent IDs ──────────────────────────────────────────────────────── */

const AGENT_IDS = ['dr_morgan', 'scout_alvarez', 'viktor_kane', 'sofia_mendes', 'madame_pythia'] as const

/* ── Sortable table types ──────────────────────────────────────────── */

interface TableRow {
  agentId: string
  matchId: string
  pick: string
  confidence: number
  correct: boolean | null
  brierScore: number | null
  resolvedAt: string | null
}

type SortKey = 'agentId' | 'matchId' | 'confidence' | 'brierScore'
type SortDir = 'asc' | 'desc'

/* ── Component ──────────────────────────────────────────────────────── */

export function StatsReport() {
  const [allItems, setAllItems] = useState<Array<{ agentId: string; items: PredictionItem[] }> | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('matchId')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  useEffect(() => {
    let alive = true
    Promise.allSettled(
      AGENT_IDS.map(async (id) => {
        const r = await getAgentPredictions(id)
        return { agentId: id, items: r.items }
      }),
    ).then((results) => {
      if (!alive) return
      const data: Array<{ agentId: string; items: PredictionItem[] }> = []
      for (const r of results) {
        if (r.status === 'fulfilled') data.push(r.value)
      }
      if (data.length === 0) setErr('No agent data available')
      else setAllItems(data)
    })
    return () => { alive = false }
  }, [])

  // Flat table rows
  const rows = useMemo(() => {
    if (!allItems) return []
    const flat: TableRow[] = []
    for (const { agentId, items } of allItems) {
      for (const p of items) {
        const outcome = p.outcome?.correct ?? null
        flat.push({
          agentId,
          matchId: p.matchId,
          pick: p.pick,
          confidence: p.confidence,
          correct: outcome,
          brierScore: outcome !== null ? (p.confidence - (outcome ? 1 : 0)) ** 2 : null,
          resolvedAt: p.outcome?.resolvedAt ?? null,
        })
      }
    }
    return flat
  }, [allItems])

  // Sorted rows
  const sortedRows = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      const va = a[sortKey]
      const vb = b[sortKey]
      if (va === null && vb === null) return 0
      if (va === null) return 1
      if (vb === null) return -1
      const cmp = typeof va === 'number' ? va - (vb as number) : String(va).localeCompare(String(vb))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [rows, sortKey, sortDir])

  // Brier series for chart
  const brierData = useMemo(() => {
    if (!allItems) return []
    return buildAllBrierSeries(allItems)
  }, [allItems])

  const resolvedCount = brierData.reduce((acc, s) => Math.max(acc, s.points.length), 0)

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        return key
      }
      setSortDir('asc')
      return key
    })
  }, [])

  if (err) {
    return <div style={{ color: accents.red, fontFamily: fonts.body, padding: 12 }}>{err}</div>
  }
  if (!allItems) {
    return <div style={{ padding: 12 }}><SkeletonRows count={5} /></div>
  }

  return (
    <div style={{ fontFamily: fonts.body, color: text.dim }}>
      {/* Chart */}
      {resolvedCount < 2 ? (
        <div style={{
          padding: 16, textAlign: 'center', color: text.muted, ...typo.dataSm,
          border: borders.standard, background: palette.surface, marginBottom: 12,
        }}>
          Need ≥2 resolved matches per agent to draw the accuracy chart.
        </div>
      ) : (
        <BrierChart data={brierData} />
      )}

      {/* Table */}
      <div style={{
        border: borders.standard,
        background: palette.surface,
        maxHeight: 320,
        overflowY: 'auto',
        overflowX: 'auto',
      }}>
        <table style={{ width: '100%', minWidth: 360, borderCollapse: 'collapse', ...typo.dataSm }}>
          <thead style={{ position: 'sticky', top: 0, background: palette.wood900, zIndex: 1 }}>
            <tr>
              {(['agentId', 'matchId', 'confidence', 'brierScore'] as SortKey[]).map((key) => (
                <th
                  key={key}
                  onClick={() => toggleSort(key)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort(key) } }}
                  tabIndex={0}
                  role="columnheader"
                  aria-sort={sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  style={{
                    padding: '6px 8px', textAlign: 'left', cursor: 'pointer',
                    color: sortKey === key ? palette.paper : text.muted,
                    borderBottom: borders.standard,
                    userSelect: 'none',
                    ...typo.hdrSm, fontFamily: fonts.header, letterSpacing: '-0.5px',
                  }}
                >
                  {HEADER_LABELS[key]} {sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
              ))}
              <th style={{
                padding: '6px 8px', textAlign: 'left', color: text.muted,
                borderBottom: borders.standard,
                ...typo.hdrXs, fontFamily: fonts.header, letterSpacing: '-0.5px',
              }}>
                Pick
              </th>
              <th style={{
                padding: '6px 8px', textAlign: 'center', color: text.muted,
                borderBottom: borders.standard,
                ...typo.hdrXs, fontFamily: fonts.header, letterSpacing: '-0.5px',
              }}>
                ✓
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r, i) => (
              <tr key={`${r.agentId}-${r.matchId}-${i}`} style={{ borderTop: `1px solid ${chartGrid}` }}>
                <td style={tdStyle}>
                  <span style={{ color: agentColors[r.agentId] ?? text.dim }}>
                    {r.agentId.replace('_', ' ')}
                  </span>
                </td>
                <td style={tdStyle}>{r.matchId}</td>
                <td style={tdStyle}>{(r.confidence * 100).toFixed(0)}%</td>
                <td style={tdStyle}>{r.brierScore !== null ? r.brierScore.toFixed(3) : '—'}</td>
                <td style={tdStyle}>{r.pick}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  {r.correct === null ? (
                    <span style={{ color: text.faint }} aria-label="pending">…</span>
                  ) : r.correct ? (
                    <span style={{ color: accents.green }}>✓</span>
                  ) : (
                    <span style={{ color: accents.red }}>✗</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const HEADER_LABELS: Record<SortKey, string> = {
  agentId: 'SCOUT',
  matchId: 'MATCH',
  confidence: 'CONF',
  brierScore: 'BRIER',
}

const tdStyle: React.CSSProperties = { padding: '5px 8px' }

/* ── SVG Brier Chart ──────────────────────────────────────────────── */

const CHART_W = 480
const CHART_H = 200
const PAD = { top: 16, right: 16, bottom: 28, left: 42 }
const PLOT_W = CHART_W - PAD.left - PAD.right
const PLOT_H = CHART_H - PAD.top - PAD.bottom

function BrierChart({ data }: { data: AgentBrierSeries[] }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // Y-axis: 0 to max rolling Brier (at least 0.5 for readability)
  const maxY = useMemo(() => {
    let max = 0.5
    for (const s of data) for (const p of s.points) max = Math.max(max, p.rollingBrier)
    return Math.ceil(max * 10) / 10 // round up to 0.1
  }, [data])

  // X-axis: max match index across agents
  const maxX = useMemo(() => {
    let max = 1
    for (const s of data) if (s.points.length > 0) max = Math.max(max, s.points[s.points.length - 1].matchIndex)
    return max
  }, [data])

  const xScale = (idx: number) => PAD.left + ((idx - 1) / Math.max(maxX - 1, 1)) * PLOT_W
  const yScale = (val: number) => PAD.top + (1 - val / maxY) * PLOT_H

  // Scanline grid lines
  const yTicks = useMemo(() => {
    const ticks: number[] = []
    const step = maxY <= 0.5 ? 0.1 : 0.2
    for (let v = 0; v <= maxY + 0.001; v += step) ticks.push(Math.round(v * 100) / 100)
    return ticks
  }, [maxY])

  const handlePoint = useCallback((series: AgentBrierSeries, pt: BrierPoint, cx: number, cy: number) => {
    setTooltip({
      x: cx,
      y: cy,
      text: `${series.agentId.replace('_', ' ')} | ${pt.matchId}\nBrier: ${pt.rollingBrier.toFixed(3)} | ${pt.correct ? '✓' : '✗'} ${pt.pick}`,
    })
  }, [])

  return (
    <div style={{
      marginBottom: 12, border: borders.standard, background: palette.surface,
      padding: 4, position: 'relative',
    }}>
      <div style={{
        ...typo.hdrSm, fontFamily: fonts.header, color: text.muted,
        padding: '4px 8px', letterSpacing: '-0.5px',
      }}>
        ROLLING BRIER SCORE
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label="Rolling Brier score chart showing prediction accuracy over resolved matches"
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Scanline grid */}
        {yTicks.map((v) => (
          <g key={`grid-${v}`}>
            <line
              x1={PAD.left} y1={yScale(v)} x2={CHART_W - PAD.right} y2={yScale(v)}
              stroke={chartGrid} strokeWidth={1} strokeDasharray="2 4"
            />
            <text
              x={PAD.left - 4} y={yScale(v) + 4}
              textAnchor="end" fill={text.muted}
              style={{ ...typo.svgAxis, fontFamily: fonts.body }}
            >
              {v.toFixed(1)}
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {Array.from({ length: maxX }, (_, i) => i + 1).map((idx) => (
          <text
            key={`x-${idx}`}
            x={xScale(idx)} y={CHART_H - 6}
            textAnchor="middle" fill={text.muted}
            style={{ ...typo.svgAxis, fontFamily: fonts.body }}
          >
            {idx}
          </text>
        ))}

        {/* Series lines + markers */}
        {data.map((series) => {
          if (series.points.length === 0) return null
          const color = agentColors[series.agentId] ?? text.dim

          // Stepped line path (pixel-art style: horizontal then vertical)
          let pathD = ''
          series.points.forEach((pt, i) => {
            const cx = xScale(pt.matchIndex)
            const cy = yScale(pt.rollingBrier)
            if (i === 0) {
              pathD += `M ${cx} ${cy}`
            } else {
              // Step: go horizontal first, then vertical
              pathD += ` H ${cx} V ${cy}`
            }
          })

          return (
            <g key={series.agentId}>
              <path d={pathD} fill="none" stroke={color} strokeWidth={2} />
              {/* Square markers (pixel-art style) */}
              {series.points.map((pt) => {
                const cx = xScale(pt.matchIndex)
                const cy = yScale(pt.rollingBrier)
                return (
                  <rect
                    key={`${series.agentId}-${pt.matchIndex}`}
                    x={cx - 3} y={cy - 3} width={6} height={6}
                    fill={color} stroke={palette.surface} strokeWidth={1}
                    style={{ cursor: 'pointer' }}
                    tabIndex={0}
                    role="button"
                    aria-label={`${series.agentId} match ${pt.matchIndex}: Brier ${pt.rollingBrier.toFixed(3)}`}
                    onMouseEnter={() => handlePoint(series, pt, cx, cy)}
                    onFocus={() => handlePoint(series, pt, cx, cy)}
                    onBlur={() => setTooltip(null)}
                  />
                )
              })}
            </g>
          )
        })}
      </svg>

      {/* Tooltip (SNES dialog box style) */}
      {tooltip && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            left: `${(tooltip.x / CHART_W) * 100}%`,
            top: `${((tooltip.y / CHART_H) * 100) - 8}%`,
            transform: 'translate(-50%, -100%)',
            background: palette.wood900,
            border: borders.standard,
            padding: '4px 8px',
            ...typo.caption, fontFamily: fonts.body,
            color: palette.paper,
            whiteSpace: 'pre-line',
            pointerEvents: 'none',
            zIndex: 10,
            boxShadow: shadows.hardSmall,
          }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Legend */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, padding: '4px 8px',
        ...typo.hdrSm, fontFamily: fonts.body, color: text.muted,
      }}>
        {data.map((s) => (
          <span key={s.agentId} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              display: 'inline-block', width: 8, height: 8,
              background: agentColors[s.agentId] ?? text.dim,
            }} />
            {s.agentId.replace('_', ' ')}
          </span>
        ))}
      </div>
    </div>
  )
}
