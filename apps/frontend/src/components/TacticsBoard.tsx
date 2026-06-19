/**
 * TacticsBoard | v2.0.0 | 2026-06-18
 * Purpose: Multi-tab analytics hub opened from board_main click.
 *
 * Tabs:
 *   📊 Matrix       — 5 agents × N matches prediction grid
 *   🕸 Radar        — SVG spider chart (accuracy, confidence, coverage, agreement, streak)
 *   🤝 Agreement    — SVG heatmap: pairwise agent agreement rate
 *   📈 Calibration  — Confidence-band bar chart (predicted vs actual win rate)
 *   📋 Dossier      — Submission pack: architecture, tech stack, agent personas
 *
 * All data from existing endpoints (predictions, profile, data-source, params).
 * Tokens only. Mobile-first. WAI-ARIA tabs + focus trap. No chart libraries.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import {
  getAgentPredictions, getMatches, getAgentProfile, getDataSource, getAgentParams,
  type PredictionItem, type MatchInfo, type AgentProfile, type DataSourceSummary,
  type AgentParamsInfo,
} from '@/lib/api'
import { PixelButton } from '@/components/ui'
import { GameEventBus } from '@/events/GameEventBus'
import { useRovingTabs } from '@/lib/a11y/useRovingTabs'
import { useFocusTrap } from '@/lib/a11y/useFocusTrap'
import {
  palette, accents, text, fonts, borders, shadows, zIndex,
  type as typo, agentColors, spacing, overlay, chartGrid,
} from '@/styles/tokens'

/* ═══════════════════════════════════════════════════════════════════════
 * SHARED TYPES & CONSTANTS
 * ═══════════════════════════════════════════════════════════════════════ */

const AGENT_IDS = ['dr_morgan', 'scout_alvarez', 'viktor_kane', 'sofia_mendes', 'madame_pythia'] as const

const AGENT_SHORT: Record<string, string> = {
  dr_morgan: 'Morgan',
  scout_alvarez: 'Alvarez',
  viktor_kane: 'Kane',
  sofia_mendes: 'Mendes',
  madame_pythia: 'Pythia',
}

interface AgentData {
  agentId: string
  name: string
  color: string
  predictions: PredictionItem[]
  predMap: Map<string, PredictionItem>
  resolved: PredictionItem[]
  correct: number
  accuracy: number
  avgConfidence: number
  streak: number
}

type Tab = 'matrix' | 'radar' | 'agreement' | 'calibration' | 'dossier'
const TABS: readonly Tab[] = ['matrix', 'radar', 'agreement', 'calibration', 'dossier']
const TAB_LABELS: Record<Tab, string> = {
  matrix: 'MATRIX',
  radar: 'RADAR',
  agreement: 'AGREE',
  calibration: 'CALIB',
  dossier: 'ABOUT',
}
const TAB_ICONS: Record<Tab, string> = {
  matrix: '▦',
  radar: '◎',
  agreement: '⇄',
  calibration: '△',
  dossier: '≡',
}

/* ═══════════════════════════════════════════════════════════════════════
 * HELPERS
 * ═══════════════════════════════════════════════════════════════════════ */

function pickLabel(pick: string): string {
  if (pick === '1') return 'H'
  if (pick === '2') return 'A'
  if (pick === 'X') return 'D'
  return pick.slice(0, 3).toUpperCase()
}

function matchLabel(m: MatchInfo): string {
  return `${m.homeTeam} – ${m.awayTeam}`
}

function matchScore(m: MatchInfo): string | null {
  if (!m.result) return null
  return `${m.result.homeScore}–${m.result.awayScore}`
}

function computeStreak(items: PredictionItem[]): number {
  const resolved = items
    .filter((p) => p.outcome)
    .sort((a, b) => a.outcome!.resolvedAt.localeCompare(b.outcome!.resolvedAt))
  let streak = 0
  for (let i = resolved.length - 1; i >= 0; i--) {
    const ok = resolved[i].outcome!.correct
    if (streak === 0) streak = ok ? 1 : -1
    else if (ok && streak > 0) streak++
    else if (!ok && streak < 0) streak--
    else break
  }
  return streak
}

function buildAgentData(agentId: string, items: PredictionItem[], agentName?: string): AgentData {
  const predMap = new Map<string, PredictionItem>()
  for (const p of items) predMap.set(p.matchId, p)
  const resolved = items.filter((p) => p.outcome)
  const correct = resolved.filter((p) => p.outcome!.correct).length
  const accuracy = resolved.length > 0 ? correct / resolved.length : 0
  const avgConf = items.length > 0
    ? items.reduce((s, p) => s + p.confidence, 0) / items.length
    : 0
  return {
    agentId,
    name: agentName ?? AGENT_SHORT[agentId] ?? agentId,
    color: agentColors[agentId] ?? accents.gold,
    predictions: items,
    predMap,
    resolved,
    correct,
    accuracy,
    avgConfidence: avgConf,
    streak: computeStreak(items),
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * MAIN COMPONENT
 * ═══════════════════════════════════════════════════════════════════════ */

export function TacticsBoard() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('matrix')

  const [agentData, setAgentData] = useState<AgentData[]>([])
  const [matches, setMatches] = useState<MatchInfo[]>([])
  const [profiles, setProfiles] = useState<Record<string, AgentProfile>>({})
  const [dataSource, setDataSource] = useState<DataSourceSummary | null>(null)
  const [agentParams, setAgentParams] = useState<Record<string, AgentParamsInfo>>({})

  const agents = useGameStore((s) => s.agents)

  const trapRef = useFocusTrap<HTMLDivElement>({ onClose: () => setOpen(false), active: open })
  const { getTabProps, getTabPanelProps, getTabListProps } = useRovingTabs({
    tabs: TABS,
    activeTab: tab,
    onSelect: setTab,
  })

  /* ── Open on board_main click ─────────────────────────────────── */

  useEffect(() => {
    const handler = ({ propId }: { propId: string }) => {
      if (propId === 'board_main') setOpen(true)
    }
    GameEventBus.on('prop:click', handler)
    return () => { GameEventBus.off('prop:click', handler) }
  }, [])

  /* ── Pause scene while open ───────────────────────────────────── */

  useEffect(() => {
    if (!open) return
    GameEventBus.emit('scene:pause', undefined)
    return () => { GameEventBus.emit('scene:resume', undefined) }
  }, [open])

  /* ── Data fetch ───────────────────────────────────────────────── */

  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    setError(null)

    const ids = Object.keys(agents).length > 0
      ? Object.values(agents).map((a) => a.agentId)
      : [...AGENT_IDS]

    const agentNames = Object.fromEntries(
      Object.values(agents).map((a) => [a.agentId, a.name]),
    )

    Promise.all([
      // Predictions for all agents
      Promise.all(ids.map((id) =>
        getAgentPredictions(id)
          .then((r) => ({ agentId: id, items: r.items }))
          .catch(() => ({ agentId: id, items: [] as PredictionItem[] })),
      )),
      // Matches
      getMatches().catch(() => ({ ok: true as const, live: [], upcoming: [], recent: [] })),
      // Profiles (best-effort)
      Promise.all(ids.map((id) =>
        getAgentProfile(id)
          .then((r) => r.profile)
          .catch(() => null),
      )),
      // Data source (best-effort)
      getDataSource().catch(() => null),
      // Agent params (best-effort)
      Promise.all(ids.map((id) =>
        getAgentParams(id)
          .then((r) => r.params)
          .catch(() => null),
      )),
    ]).then(([predResults, matchData, profileResults, ds, paramResults]) => {
      if (!alive) return

      // Agent data
      const ad = predResults.map((r) =>
        buildAgentData(r.agentId, r.items, agentNames[r.agentId]),
      )
      setAgentData(ad)

      // Merge matches
      const md = matchData as { live: MatchInfo[]; upcoming: MatchInfo[]; recent: MatchInfo[] }
      const allMatches = [...md.recent.reverse(), ...md.live, ...md.upcoming]
      const seen = new Set<string>()
      const unique: MatchInfo[] = []
      for (const m of allMatches) {
        if (!seen.has(m.id)) { seen.add(m.id); unique.push(m) }
      }
      setMatches(unique)

      // Profiles
      const profs: Record<string, AgentProfile> = {}
      for (const p of profileResults) {
        if (p) profs[p.id] = p
      }
      setProfiles(profs)

      // Data source
      if (ds) setDataSource(ds as DataSourceSummary)

      // Params
      const pmap: Record<string, AgentParamsInfo> = {}
      for (const p of paramResults) {
        if (p) pmap[p.agentId] = p
      }
      setAgentParams(pmap)

      setLoading(false)
    }).catch((e) => {
      if (alive) {
        setError((e as Error)?.message ?? String(e))
        setLoading(false)
      }
    })

    return () => { alive = false }
  }, [open, agents])

  const close = useCallback(() => { setOpen(false); setTab('matrix') }, [])

  if (!open) return null

  return (
    <div
      style={S.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) close() }}
      role="presentation"
    >
      <div
        ref={trapRef}
        style={S.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tactics-title"
      >
        {/* Header */}
        <div style={S.header}>
          <h2 id="tactics-title" style={S.title}>TACTICS BOARD</h2>
          <PixelButton size="small" onClick={close} aria-label="Close tactics board">
            ✕
          </PixelButton>
        </div>

        {/* Tab bar */}
        <div style={S.tabBar} {...getTabListProps()}>
          {TABS.map((t) => (
            <button
              key={t}
              {...getTabProps(t)}
              onClick={() => setTab(t)}
              style={{
                ...S.tabBtn,
                color: tab === t ? accents.gold : text.muted,
                borderBottom: tab === t ? `2px solid ${accents.gold}` : '2px solid transparent',
                background: tab === t ? palette.wood700 : 'transparent',
              }}
            >
              <span style={{ marginRight: 3 }}>{TAB_ICONS[t]}</span>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Content area */}
        <div style={S.content}>
          {loading && <div style={S.status}>Analyzing scouting data…</div>}
          {error && <div style={{ ...S.status, color: accents.red }}>{error}</div>}

          {!loading && !error && (
            <>
              {tab === 'matrix' && (
                <div {...getTabPanelProps('matrix')}>
                  <MatrixTab agentData={agentData} matches={matches} />
                </div>
              )}
              {tab === 'radar' && (
                <div {...getTabPanelProps('radar')}>
                  <RadarTab agentData={agentData} />
                </div>
              )}
              {tab === 'agreement' && (
                <div {...getTabPanelProps('agreement')}>
                  <AgreementTab agentData={agentData} />
                </div>
              )}
              {tab === 'calibration' && (
                <div {...getTabPanelProps('calibration')}>
                  <CalibrationTab agentData={agentData} />
                </div>
              )}
              {tab === 'dossier' && (
                <div {...getTabPanelProps('dossier')}>
                  <DossierTab profiles={profiles} dataSource={dataSource} agentParams={agentParams} agentData={agentData} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
 * TAB 1 — MATRIX (prediction grid)
 * ═══════════════════════════════════════════════════════════════════════ */

interface MatchRow {
  match: MatchInfo
  consensus: string | null
  hasDisagreement: boolean
}

function MatrixTab({ agentData, matches }: { agentData: AgentData[]; matches: MatchInfo[] }) {
  const predicted = matches.filter((m) =>
    agentData.some((a) => a.predMap.has(m.id)),
  )

  const rows: MatchRow[] = predicted.map((match) => {
    const picks: Record<string, number> = {}
    for (const a of agentData) {
      const p = a.predMap.get(match.id)
      if (p) picks[p.pick] = (picks[p.pick] ?? 0) + 1
    }
    const entries = Object.entries(picks)
    entries.sort((a, b) => b[1] - a[1])
    const consensus = entries.length > 0 && entries[0][1] >= 3 ? entries[0][0] : null
    const uniquePicks = new Set(Object.keys(picks))
    return { match, consensus, hasDisagreement: uniquePicks.size > 1 }
  })

  if (rows.length === 0) {
    return <div style={S.empty}>No predictions yet. The scouts are still studying the fixtures.</div>
  }

  return (
    <>
      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr style={S.thead}>
              <th style={{ ...S.th, ...S.matchCol }}>Match</th>
              <th style={{ ...S.th, ...S.scoreCol }}>Score</th>
              {agentData.map((a) => (
                <th key={a.agentId} style={{ ...S.th, ...S.agentCol, borderBottom: `3px solid ${a.color}` }}>
                  {AGENT_SHORT[a.agentId] ?? a.name}
                </th>
              ))}
              <th style={{ ...S.th, ...S.consensusCol }}>ALL</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isLive = row.match.status === 'live'
              return (
                <tr key={row.match.id} style={{ ...S.row, background: isLive ? 'rgba(192,48,48,0.08)' : undefined }}>
                  <td style={{ ...S.td, ...S.matchCol }}>
                    <span style={{ ...typo.dataSm, fontFamily: fonts.body, color: palette.paper }}>
                      {matchLabel(row.match)}
                    </span>
                    {isLive && <span style={S.liveTag}>LIVE</span>}
                  </td>
                  <td style={{ ...S.td, ...S.scoreCol, ...typo.data, fontFamily: fonts.body, color: text.dim }}>
                    {matchScore(row.match) ?? '—'}
                  </td>
                  {agentData.map((a) => {
                    const pred = a.predMap.get(row.match.id)
                    if (!pred) return <td key={a.agentId} style={{ ...S.td, ...S.agentCol, color: text.faint }}>—</td>
                    const resolved = pred.outcome != null
                    const correct = pred.outcome?.correct
                    return (
                      <td key={a.agentId} style={{
                        ...S.td, ...S.agentCol, ...typo.data, fontFamily: fonts.body, fontWeight: 700,
                        color: resolved ? (correct ? accents.green : accents.red) : palette.paper,
                        background: resolved ? (correct ? 'rgba(57,192,74,0.08)' : 'rgba(192,48,48,0.08)') : undefined,
                      }} title={pred.reasoning}>
                        {pickLabel(pred.pick)}
                        {pred.confidence > 0 && (
                          <span style={{ ...typo.caption, color: text.faint, marginLeft: 2 }}>
                            {Math.round(pred.confidence * 100)}
                          </span>
                        )}
                      </td>
                    )
                  })}
                  <td style={{
                    ...S.td, ...S.consensusCol, ...typo.dataSm, fontFamily: fonts.body, fontWeight: 700,
                    color: row.consensus ? accents.gold : text.faint,
                    borderLeft: `2px solid ${palette.wood700}`,
                  }}>
                    {row.consensus ? pickLabel(row.consensus) : '–'}
                    {row.hasDisagreement && <span style={S.disagreeDot} title="Scouts disagree">●</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={S.tfoot}>
              <td style={{ ...S.td, ...S.matchCol, ...typo.hdrXs, fontFamily: fonts.header, color: accents.gold }} colSpan={2}>
                ACCURACY
              </td>
              {agentData.map((a) => (
                <td key={a.agentId} style={{ ...S.td, ...S.agentCol, ...typo.dataSm, fontFamily: fonts.body }}>
                  <span style={{ color: palette.paper }}>{a.resolved.length > 0 ? `${Math.round(a.accuracy * 100)}%` : '—'}</span>
                  <br />
                  <span style={{ ...typo.caption, color: text.faint }}>{a.correct}/{a.resolved.length}</span>
                </td>
              ))}
              <td style={{ ...S.td, ...S.consensusCol }} />
            </tr>
          </tfoot>
        </table>
      </div>
      <div style={S.legend}>
        <span><span style={{ color: accents.green, marginRight: 3 }}>■</span>Correct</span>
        <span style={{ marginLeft: spacing.md }}><span style={{ color: accents.red, marginRight: 3 }}>■</span>Wrong</span>
        <span style={{ marginLeft: spacing.md }}><span style={{ color: accents.red, marginRight: 3, fontSize: 8 }}>●</span>Disagreement</span>
        <span style={{ marginLeft: spacing.md }}>H=Home · D=Draw · A=Away</span>
      </div>
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
 * TAB 2 — RADAR (spider chart)
 * ═══════════════════════════════════════════════════════════════════════ */

const RADAR_AXES = ['Accuracy', 'Confidence', 'Coverage', 'Agreement', 'Streak'] as const
const RADAR_SIZE = 260
const RADAR_CX = RADAR_SIZE / 2
const RADAR_CY = RADAR_SIZE / 2
const RADAR_R = 100

function radarPoint(axisIndex: number, value: number, total: number): { x: number; y: number } {
  const angle = (Math.PI * 2 * axisIndex) / total - Math.PI / 2
  const r = RADAR_R * value
  return { x: RADAR_CX + r * Math.cos(angle), y: RADAR_CY + r * Math.sin(angle) }
}

function RadarTab({ agentData }: { agentData: AgentData[] }) {
  const [animProgress, setAnimProgress] = useState(0)

  useEffect(() => {
    let frame: number
    const start = performance.now()
    const duration = 600
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      // Ease out quad
      setAnimProgress(1 - (1 - t) * (1 - t))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  // Compute normalized values per agent
  const maxCoverage = Math.max(...agentData.map((a) => a.predictions.length), 1)

  // Agreement: avg pairwise agreement
  const agreementScores = useMemo(() => {
    const scores: Record<string, number> = {}
    for (const a of agentData) {
      let agree = 0
      let total = 0
      for (const b of agentData) {
        if (a.agentId === b.agentId) continue
        for (const [matchId, pred] of a.predMap) {
          const bPred = b.predMap.get(matchId)
          if (bPred) {
            total++
            if (pred.pick === bPred.pick) agree++
          }
        }
      }
      scores[a.agentId] = total > 0 ? agree / total : 0
    }
    return scores
  }, [agentData])

  const agentAxes = agentData.map((a) => ({
    agentId: a.agentId,
    color: a.color,
    name: AGENT_SHORT[a.agentId] ?? a.name,
    values: [
      a.accuracy,
      a.avgConfidence,
      a.predictions.length / maxCoverage,
      agreementScores[a.agentId] ?? 0,
      Math.min(1, Math.max(0, (a.streak + 5) / 10)), // normalize streak -5..5 → 0..1
    ],
  }))

  const axisCount = RADAR_AXES.length

  // Grid rings at 0.25, 0.5, 0.75, 1.0
  const rings = [0.25, 0.5, 0.75, 1.0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: spacing.sm }}>
      <svg
        viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}
        style={{ width: '100%', maxWidth: 340, height: 'auto' }}
        role="img"
        aria-label="Spider chart comparing agent performance across 5 axes"
      >
        {/* Grid rings */}
        {rings.map((r) => {
          const points = Array.from({ length: axisCount }, (_, i) => {
            const p = radarPoint(i, r, axisCount)
            return `${p.x},${p.y}`
          }).join(' ')
          return (
            <polygon
              key={r}
              points={points}
              fill="none"
              stroke={chartGrid}
              strokeWidth={1}
              strokeDasharray={r < 1 ? '2 3' : undefined}
            />
          )
        })}

        {/* Axis lines + labels */}
        {RADAR_AXES.map((label, i) => {
          const end = radarPoint(i, 1.0, axisCount)
          const labelPos = radarPoint(i, 1.18, axisCount)
          return (
            <g key={label}>
              <line x1={RADAR_CX} y1={RADAR_CY} x2={end.x} y2={end.y} stroke={chartGrid} strokeWidth={1} />
              <text
                x={labelPos.x} y={labelPos.y}
                textAnchor="middle" dominantBaseline="middle"
                fill={text.muted}
                style={{ fontSize: 9, fontFamily: fonts.header }}
              >
                {label.slice(0, 5).toUpperCase()}
              </text>
            </g>
          )
        })}

        {/* Agent polygons */}
        {agentAxes.map((agent) => {
          const points = agent.values.map((v, i) => {
            const p = radarPoint(i, v * animProgress, axisCount)
            return `${p.x},${p.y}`
          }).join(' ')
          return (
            <g key={agent.agentId}>
              <polygon
                points={points}
                fill={agent.color}
                fillOpacity={0.12}
                stroke={agent.color}
                strokeWidth={2}
              />
              {/* Vertex dots */}
              {agent.values.map((v, i) => {
                const p = radarPoint(i, v * animProgress, axisCount)
                return (
                  <rect
                    key={i}
                    x={p.x - 3} y={p.y - 3}
                    width={6} height={6}
                    fill={agent.color}
                    stroke={palette.wood900}
                    strokeWidth={1}
                  />
                )
              })}
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      <div style={S.radarLegend}>
        {agentAxes.map((a) => (
          <span key={a.agentId} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, background: a.color }} />
            <span style={{ color: palette.paper }}>{a.name}</span>
          </span>
        ))}
      </div>

      {/* Stats table below radar */}
      <div style={{ width: '100%', overflowX: 'auto', marginTop: spacing.sm }}>
        <table style={{ ...S.table, minWidth: 400 }}>
          <thead>
            <tr style={S.thead}>
              <th style={{ ...S.th, textAlign: 'left', paddingLeft: spacing.sm }}>Scout</th>
              {RADAR_AXES.map((ax) => (
                <th key={ax} style={{ ...S.th, textAlign: 'center' }}>{ax.slice(0, 4)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agentAxes.map((a) => (
              <tr key={a.agentId} style={S.row}>
                <td style={{ ...S.td, paddingLeft: spacing.sm }}>
                  <span style={{ color: a.color, ...typo.dataSm, fontFamily: fonts.body }}>{a.name}</span>
                </td>
                {a.values.map((v, i) => (
                  <td key={i} style={{ ...S.td, textAlign: 'center', ...typo.dataSm, fontFamily: fonts.body, color: palette.paper }}>
                    {(v * 100).toFixed(0)}%
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
 * TAB 3 — AGREEMENT HEATMAP
 * ═══════════════════════════════════════════════════════════════════════ */

function AgreementTab({ agentData }: { agentData: AgentData[] }) {
  // Pairwise agreement matrix
  const matrix = useMemo(() => {
    const n = agentData.length
    const m: number[][] = Array.from({ length: n }, () => Array(n).fill(0))

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) { m[i][j] = 1; continue }
        let agree = 0
        let total = 0
        for (const [matchId, pred] of agentData[i].predMap) {
          const other = agentData[j].predMap.get(matchId)
          if (other) {
            total++
            if (pred.pick === other.pick) agree++
          }
        }
        m[i][j] = total > 0 ? agree / total : 0
      }
    }
    return m
  }, [agentData])

  const n = agentData.length
  const CELL = 52
  const LABEL_W = 64
  const LABEL_H = 28
  const W = LABEL_W + n * CELL
  const H = LABEL_H + n * CELL

  // Color interpolation: low agreement = dark, high = gold
  function heatColor(val: number): string {
    if (val >= 1) return agentColors.dr_morgan ?? accents.gold
    const r = Math.round(24 + val * (232 - 24))
    const g = Math.round(16 + val * (164 - 16))
    const b = Math.round(9 + val * (74 - 9))
    return `rgb(${r},${g},${b})`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: spacing.sm }}>
      <p style={{ ...typo.dataSm, fontFamily: fonts.body, color: text.muted, margin: `0 0 ${spacing.sm}px` }}>
        Pairwise pick agreement rate between scouts
      </p>
      <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, height: 'auto' }} role="img" aria-label="Agent agreement heatmap">
          {/* Column labels */}
          {agentData.map((a, j) => (
            <text
              key={`col-${j}`}
              x={LABEL_W + j * CELL + CELL / 2}
              y={LABEL_H - 6}
              textAnchor="middle"
              fill={a.color}
              style={{ fontSize: 9, fontFamily: fonts.header }}
            >
              {(AGENT_SHORT[a.agentId] ?? a.name).slice(0, 5)}
            </text>
          ))}

          {/* Rows */}
          {agentData.map((a, i) => (
            <g key={`row-${i}`}>
              {/* Row label */}
              <text
                x={LABEL_W - 6}
                y={LABEL_H + i * CELL + CELL / 2 + 4}
                textAnchor="end"
                fill={a.color}
                style={{ fontSize: 9, fontFamily: fonts.header }}
              >
                {(AGENT_SHORT[a.agentId] ?? a.name).slice(0, 5)}
              </text>

              {/* Cells */}
              {agentData.map((_, j) => {
                const val = matrix[i][j]
                const isDiag = i === j
                return (
                  <g key={`cell-${i}-${j}`}>
                    <rect
                      x={LABEL_W + j * CELL + 1}
                      y={LABEL_H + i * CELL + 1}
                      width={CELL - 2}
                      height={CELL - 2}
                      fill={isDiag ? palette.wood700 : heatColor(val)}
                      stroke={palette.wood900}
                      strokeWidth={1}
                    />
                    <text
                      x={LABEL_W + j * CELL + CELL / 2}
                      y={LABEL_H + i * CELL + CELL / 2 + 5}
                      textAnchor="middle"
                      fill={isDiag ? text.faint : (val > 0.5 ? palette.wood900 : palette.paper)}
                      style={{ fontSize: isDiag ? 10 : 13, fontFamily: fonts.body, fontWeight: 700 }}
                    >
                      {isDiag ? '—' : `${Math.round(val * 100)}%`}
                    </text>
                  </g>
                )
              })}
            </g>
          ))}
        </svg>
      </div>

      {/* Color scale legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
        <span style={{ ...typo.caption, fontFamily: fonts.body, color: text.faint }}>0%</span>
        <div style={{
          width: 120, height: 12,
          background: palette.wood900,
          border: borders.rule,
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: 0, right: 0,
            width: '50%', height: '100%',
            background: accents.gold,
          }} />
        </div>
        <span style={{ ...typo.caption, fontFamily: fonts.body, color: text.faint }}>100%</span>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
 * TAB 4 — CALIBRATION (confidence bands vs actual outcome rate)
 * ═══════════════════════════════════════════════════════════════════════ */

interface CalibBand {
  label: string
  lo: number
  hi: number
  expected: number
  count: number
  actual: number
}

function CalibrationTab({ agentData }: { agentData: AgentData[] }) {
  const bands = useMemo(() => {
    // Pool all resolved predictions across agents
    const all: { confidence: number; correct: boolean }[] = []
    for (const a of agentData) {
      for (const p of a.resolved) {
        all.push({ confidence: p.confidence, correct: p.outcome!.correct })
      }
    }

    const defs: [string, number, number][] = [
      ['40–50%', 0.4, 0.5],
      ['50–60%', 0.5, 0.6],
      ['60–70%', 0.6, 0.7],
      ['70–80%', 0.7, 0.8],
      ['80–90%', 0.8, 0.9],
      ['90–100%', 0.9, 1.01],
    ]

    return defs.map(([label, lo, hi]) => {
      const inBand = all.filter((p) => p.confidence >= lo && p.confidence < hi)
      const correct = inBand.filter((p) => p.correct).length
      return {
        label,
        lo,
        hi,
        expected: (lo + hi) / 2,
        count: inBand.length,
        actual: inBand.length > 0 ? correct / inBand.length : 0,
      } as CalibBand
    })
  }, [agentData])

  const nonEmpty = bands.filter((b) => b.count > 0)

  if (nonEmpty.length === 0) {
    return <div style={S.empty}>Not enough resolved predictions to build calibration chart.</div>
  }

  const CHART_W = 400
  const CHART_H = 220
  const PAD = { top: 20, right: 20, bottom: 40, left: 48 }
  const plotW = CHART_W - PAD.left - PAD.right
  const plotH = CHART_H - PAD.top - PAD.bottom
  const barW = Math.min(40, plotW / (bands.length * 2.5))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: spacing.sm }}>
      <p style={{ ...typo.dataSm, fontFamily: fonts.body, color: text.muted, margin: `0 0 ${spacing.sm}px` }}>
        Are scouts well-calibrated? Expected confidence vs actual hit rate (all agents pooled)
      </p>
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        style={{ width: '100%', maxWidth: 460, height: 'auto' }}
        role="img"
        aria-label="Calibration chart: confidence bands versus actual accuracy"
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1.0].map((v) => {
          const y = PAD.top + plotH * (1 - v)
          return (
            <g key={v}>
              <line x1={PAD.left} y1={y} x2={CHART_W - PAD.right} y2={y} stroke={chartGrid} strokeWidth={1} strokeDasharray="2 4" />
              <text x={PAD.left - 4} y={y + 4} textAnchor="end" fill={text.muted} style={{ fontSize: 10, fontFamily: fonts.body }}>
                {Math.round(v * 100)}%
              </text>
            </g>
          )
        })}

        {/* Perfect calibration diagonal */}
        <line
          x1={PAD.left} y1={PAD.top + plotH}
          x2={PAD.left + plotW} y2={PAD.top}
          stroke={text.faint} strokeWidth={1} strokeDasharray="4 4" opacity={0.5}
        />
        <text
          x={CHART_W - PAD.right - 2} y={PAD.top - 4}
          textAnchor="end" fill={text.faint}
          style={{ fontSize: 9, fontFamily: fonts.body }}
        >
          perfect
        </text>

        {/* Bars */}
        {bands.map((band, i) => {
          const groupX = PAD.left + (i + 0.5) * (plotW / bands.length)
          const expectedH = band.expected * plotH
          const actualH = band.actual * plotH
          const halfBar = barW / 2

          return (
            <g key={band.label}>
              {/* Expected bar (outline) */}
              <rect
                x={groupX - halfBar - barW * 0.6}
                y={PAD.top + plotH - expectedH}
                width={barW}
                height={expectedH}
                fill="none"
                stroke={text.faint}
                strokeWidth={2}
                strokeDasharray="4 2"
              />

              {/* Actual bar (filled) */}
              {band.count > 0 && (
                <rect
                  x={groupX - halfBar + barW * 0.6}
                  y={PAD.top + plotH - actualH}
                  width={barW}
                  height={Math.max(actualH, 2)}
                  fill={Math.abs(band.actual - band.expected) < 0.15 ? accents.green : accents.gold}
                  stroke={palette.wood900}
                  strokeWidth={1}
                />
              )}

              {/* Count label */}
              {band.count > 0 && (
                <text
                  x={groupX}
                  y={PAD.top + plotH - actualH - 4}
                  textAnchor="middle" fill={palette.paper}
                  style={{ fontSize: 11, fontFamily: fonts.body }}
                >
                  n={band.count}
                </text>
              )}

              {/* X-axis label */}
              <text
                x={groupX}
                y={CHART_H - PAD.bottom + 16}
                textAnchor="middle" fill={text.muted}
                style={{ fontSize: 10, fontFamily: fonts.body }}
              >
                {band.label}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: spacing.md, ...typo.caption, fontFamily: fonts.body, color: text.faint, marginTop: spacing.xs }}>
        <span>
          <span style={{ display: 'inline-block', width: 12, height: 8, border: `2px dashed ${text.faint}`, marginRight: 4, verticalAlign: 'middle' }} />
          Expected
        </span>
        <span>
          <span style={{ display: 'inline-block', width: 12, height: 8, background: accents.gold, marginRight: 4, verticalAlign: 'middle' }} />
          Actual
        </span>
        <span>
          <span style={{ display: 'inline-block', width: 12, height: 8, background: accents.green, marginRight: 4, verticalAlign: 'middle' }} />
          Well-calibrated (±15%)
        </span>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
 * TAB 5 — DOSSIER (submission pack)
 * ═══════════════════════════════════════════════════════════════════════ */

function DossierTab({
  profiles,
  dataSource,
  agentParams,
  agentData,
}: {
  profiles: Record<string, AgentProfile>
  dataSource: DataSourceSummary | null
  agentParams: Record<string, AgentParamsInfo>
  agentData: AgentData[]
}) {
  return (
    <div style={{ padding: spacing.sm }}>
      {/* Mission */}
      <Section title="MISSION">
        <P>
          Five AI scouting agents predict FIFA World Cup 2026 match outcomes from an
          SNES-style pixel-art arcade cabinet. Each agent has a unique personality,
          methodology, and calibration parameters that <Em>evolve autonomously</Em> through
          a nightly reflection → evolution pipeline.
        </P>
        <P>
          All agent memory — predictions, evolution events, parameters — persists on
          <Em> Walrus mainnet</Em> via MemWal semantic storage. Every prediction is
          an immutable, timestamped blob retrievable by anyone.
        </P>
      </Section>

      {/* Architecture */}
      <Section title="ARCHITECTURE">
        <Pre>{`
┌──────────────────────────────────────────────────────┐
│                   Browser (SPA)                      │
│  React 18 + Phaser 3 + Vite                          │
│  ┌──────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Cabinet  │ │  HUD   │ │ Modals   │ │ Tactics  │  │
│  │ (Phaser) │ │        │ │ (Agent,  │ │  Board   │  │
│  │          │ │        │ │  Stats)  │ │          │  │
│  └────┬─────┘ └───┬────┘ └────┬─────┘ └────┬─────┘  │
│       └────────────┴──────────┴─────────────┘        │
│                    │ REST + WebSocket                 │
├────────────────────┼─────────────────────────────────┤
│              Node.js Backend                         │
│  Express + Socket.io                                 │
│  ┌────────────────┐ ┌────────────────┐               │
│  │  Match Pipeline│ │  sleep-worker  │               │
│  │  (football-    │ │  Reflection →  │               │
│  │   data.org)    │ │  Evolution     │               │
│  └───────┬────────┘ └───────┬────────┘               │
│          └──────────────────┘                        │
│                    │ remember() / recall()            │
├────────────────────┼─────────────────────────────────┤
│           Walrus Mainnet (MemWal)                    │
│           Append-only semantic blob store            │
└──────────────────────────────────────────────────────┘`}
        </Pre>
      </Section>

      {/* Tech Stack */}
      <Section title="TECH STACK">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: spacing.sm }}>
          {[
            ['Frontend', 'React 18, Phaser 3, Vite, Zustand, Socket.io-client'],
            ['Backend', 'Node.js, Express, Socket.io, TypeScript'],
            ['Storage', 'MemWal (Walrus mainnet), semantic KV overlay'],
            ['Auth', 'Sui wallet sign-in (personal message signature)'],
            ['Data', 'football-data.org v4 API (live fixtures)'],
            ['Design', 'SNES pixel-art, Press Start 2P, VT323, token system'],
          ].map(([label, desc]) => (
            <div key={label} style={{ padding: spacing.sm, border: borders.rule, background: 'rgba(52,29,14,0.3)' }}>
              <div style={{ ...typo.hdrXs, fontFamily: fonts.header, color: accents.gold, marginBottom: 4 }}>{label}</div>
              <div style={{ ...typo.dataSm, fontFamily: fonts.body, color: text.dim }}>{desc}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Agent Personas */}
      <Section title="AGENT PERSONAS">
        {agentData.map((a) => {
          const profile = profiles[a.agentId]
          const params = agentParams[a.agentId]
          return (
            <div key={a.agentId} style={{
              padding: spacing.sm, marginBottom: spacing.sm,
              borderLeft: `3px solid ${a.color}`, background: 'rgba(52,29,14,0.2)',
            }}>
              <div style={{ ...typo.hdrXs, fontFamily: fonts.header, color: a.color }}>
                {profile?.name ?? AGENT_SHORT[a.agentId] ?? a.agentId}
                <span style={{ ...typo.caption, fontFamily: fonts.body, color: text.muted, marginLeft: spacing.sm }}>
                  {profile?.role ?? ''}
                </span>
              </div>
              {profile?.personality && (
                <P style={{ marginTop: 4 }}>{profile.personality}</P>
              )}
              {profile?.methodology && (
                <P style={{ color: text.faint, marginTop: 2 }}>
                  Method: {profile.methodology.type}
                  {profile.methodology.description ? ` — ${profile.methodology.description}` : ''}
                </P>
              )}
              {params && (
                <div style={{ ...typo.caption, fontFamily: fonts.body, color: text.faint, marginTop: 2 }}>
                  Params v{params.version} · bias {(params.confidenceBias * 100).toFixed(0)}% · hedge {(params.hedgingLevel * 100).toFixed(0)}%
                </div>
              )}
              {profile?.catchphrases && profile.catchphrases.length > 0 && (
                <div style={{ ...typo.caption, fontFamily: fonts.body, color: text.faint, fontStyle: 'italic', marginTop: 2 }}>
                  "{profile.catchphrases[0]}"
                </div>
              )}
            </div>
          )
        })}
      </Section>

      {/* Data Sources */}
      {dataSource && (
        <Section title="DATA PROVENANCE">
          <P>{dataSource.headline}</P>
          <div style={{ display: 'grid', gap: 4, marginTop: spacing.xs }}>
            {dataSource.inputs.map((inp) => (
              <div key={inp.key} style={{ display: 'flex', gap: spacing.sm, ...typo.dataSm, fontFamily: fonts.body }}>
                <span style={{
                  display: 'inline-block', padding: '1px 6px',
                  background: inp.source === 'live' ? accents.green : inp.source === 'manual' ? accents.gold : palette.wood700,
                  color: inp.source === 'live' || inp.source === 'manual' ? palette.wood900 : palette.paper,
                  ...typo.caption, fontFamily: fonts.header,
                  minWidth: 60, textAlign: 'center',
                }}>
                  {inp.source.toUpperCase()}
                </span>
                <span style={{ color: palette.paper }}>{inp.label}</span>
                <span style={{ color: text.faint }}> — {inp.detail}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Self-Learning Loop */}
      <Section title="SELF-LEARNING LOOP">
        <Pre>{`
Match resolves (football-data.org)
  ↓
ReflectionEngine
  • Compute Brier score per prediction
  • Analyse confidence calibration errors
  • Identify systematic biases
  ↓
EvolutionEngine
  • Adjust confidenceBias, hedgingLevel
  • Re-weight topicCalibration
  • Bump parameter version
  ↓
MemWal (Walrus)
  • remember(evolution_event)
  • remember(params_v{N+1})
  • Immutable, append-only`}
        </Pre>
      </Section>

      {/* Links */}
      <Section title="LINKS">
        <P>
          Live: <Em>taken.wal.app</Em> · Hackathon: Walrus Memory World Cup · Deadline: 24.06.2026
        </P>
      </Section>
    </div>
  )
}

/* ── Dossier sub-components ──────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: spacing.md }}>
      <h3 style={{
        ...typo.hdrSm, fontFamily: fonts.header, color: accents.gold,
        margin: `0 0 ${spacing.xs}px`, paddingBottom: spacing.xs,
        borderBottom: borders.rule,
      }}>{title}</h3>
      {children}
    </div>
  )
}

function P({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{ ...typo.dataSm, fontFamily: fonts.body, color: text.dim, margin: `0 0 ${spacing.xs}px`, ...style }}>
      {children}
    </p>
  )
}

function Em({ children }: { children: React.ReactNode }) {
  return <span style={{ color: accents.gold }}>{children}</span>
}

function Pre({ children }: { children: React.ReactNode }) {
  return (
    <pre style={{
      ...typo.caption, fontFamily: fonts.body, color: text.dim,
      background: palette.surface, border: borders.rule,
      padding: spacing.sm, margin: `${spacing.xs}px 0`,
      overflowX: 'auto', whiteSpace: 'pre',
    }}>
      {children}
    </pre>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
 * STYLES (inline, token-only)
 * ═══════════════════════════════════════════════════════════════════════ */

const S = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    zIndex: zIndex.stats,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    background: overlay,
    paddingTop: 40,
    paddingBottom: 24,
    overflowY: 'auto' as const,
  },

  panel: {
    position: 'relative' as const,
    width: 720,
    maxWidth: '96vw',
    maxHeight: 'calc(100vh - 64px)',
    display: 'flex',
    flexDirection: 'column' as const,
    background: palette.wood900,
    border: borders.standard,
    borderRadius: 0,
    boxShadow: shadows.hard,
    color: palette.paper,
    fontFamily: fonts.body,
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${spacing.sm}px ${spacing.md}px`,
    borderBottom: borders.standard,
    flexShrink: 0,
  },

  title: {
    margin: 0,
    ...typo.hdr,
    fontFamily: fonts.header,
    letterSpacing: '-0.5px',
    color: accents.gold,
  } as React.CSSProperties,

  tabBar: {
    display: 'flex',
    borderBottom: borders.standard,
    overflowX: 'auto' as const,
    flexShrink: 0,
    WebkitOverflowScrolling: 'touch' as const,
  },

  tabBtn: {
    flex: '0 0 auto',
    padding: `${spacing.sm}px ${spacing.sm + 4}px`,
    ...typo.hdrXs,
    fontFamily: fonts.header,
    letterSpacing: '-0.5px',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    transition: 'background 120ms steps(2)',
  } as React.CSSProperties,

  content: {
    flex: 1,
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const,
    minHeight: 200,
  },

  status: {
    padding: spacing.md,
    color: text.muted,
    ...typo.body,
    fontFamily: fonts.body,
  },

  empty: {
    padding: spacing.lg,
    color: text.muted,
    ...typo.body,
    fontFamily: fonts.body,
    textAlign: 'center' as const,
  },

  /* Matrix tab */
  tableWrap: {
    overflowX: 'auto' as const,
    overflowY: 'auto' as const,
    WebkitOverflowScrolling: 'touch' as const,
  },

  table: {
    width: '100%',
    minWidth: 520,
    borderCollapse: 'collapse' as const,
    fontFamily: fonts.body,
  },

  thead: {
    background: palette.wood700,
    color: palette.paper,
    textAlign: 'left' as const,
    position: 'sticky' as const,
    top: 0,
    zIndex: 1,
  },

  th: {
    padding: '6px 6px',
    ...typo.hdrXs,
    fontFamily: fonts.header,
    fontWeight: 400,
    letterSpacing: '-0.5px',
    textTransform: 'uppercase' as const,
    textAlign: 'center' as const,
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  matchCol: { textAlign: 'left' as const, minWidth: 110, paddingLeft: spacing.sm },
  scoreCol: { textAlign: 'center' as const, minWidth: 44 },
  agentCol: { textAlign: 'center' as const, minWidth: 48 },
  consensusCol: { textAlign: 'center' as const, minWidth: 44 },

  row: { borderTop: borders.rule },
  td: { padding: '5px 6px', verticalAlign: 'middle' as const },

  tfoot: { background: palette.wood700, borderTop: borders.standard },

  liveTag: {
    display: 'inline-block',
    marginLeft: 6,
    padding: '1px 4px',
    ...typo.caption,
    fontFamily: fonts.header,
    fontSize: 8,
    background: accents.red,
    color: palette.paper,
    border: `1px solid ${palette.wood900}`,
    verticalAlign: 'middle' as const,
  } as React.CSSProperties,

  disagreeDot: {
    display: 'inline-block',
    marginLeft: 3,
    color: accents.red,
    fontSize: 8,
    verticalAlign: 'super' as const,
  },

  legend: {
    padding: `${spacing.xs}px ${spacing.md}px ${spacing.sm}px`,
    ...typo.caption,
    fontFamily: fonts.body,
    color: text.faint,
    borderTop: borders.rule,
    flexShrink: 0,
  },

  /* Radar tab */
  radarLegend: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: spacing.md,
    marginTop: spacing.sm,
    ...typo.dataSm,
    fontFamily: fonts.body,
  },
} as const
