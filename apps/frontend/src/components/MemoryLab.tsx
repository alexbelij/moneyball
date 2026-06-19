/**
 * MemoryLab | v1.0.0 | 2026-06-18
 * Purpose: "Memory Lab" modal opened from board_left click.
 * Shows the self-learning loop: Sleep → Reflect → Evolve → Predict cycle,
 * per-agent evolution stats, and latest parameter changes.
 *
 * Data from existing endpoints: getAgentProfile, getAgentEvolution, getAgentParams.
 * Token-only styles. WAI-ARIA dialog + focus trap. No chart libraries.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getAgentEvolution, getAgentParams,
  type EvolutionItem, type AgentParamsInfo,
} from '@/lib/api'
import { PixelButton } from '@/components/ui'
import { GameEventBus } from '@/events/GameEventBus'
import { useFocusTrap } from '@/lib/a11y/useFocusTrap'
import {
  palette, accents, text, fonts, borders, shadows, zIndex,
  type as typo, agentColors, spacing, overlay,
} from '@/styles/tokens'

/* ═══════════════════════════════════════════════════════════════════════
 * CONSTANTS
 * ═══════════════════════════════════════════════════════════════════════ */

const AGENT_IDS = ['dr_morgan', 'scout_alvarez', 'viktor_kane', 'sofia_mendes', 'madame_pythia'] as const
const AGENT_NAMES: Record<string, string> = {
  dr_morgan: 'Dr. Morgan',
  scout_alvarez: 'Scout Alvarez',
  viktor_kane: 'Viktor Kane',
  sofia_mendes: 'Sofia Mendes',
  madame_pythia: 'Mme Pythia',
}
const MODAL_TITLE_ID = 'memory-lab-title'

/* ═══════════════════════════════════════════════════════════════════════
 * TYPES
 * ═══════════════════════════════════════════════════════════════════════ */

interface AgentEvoData {
  agentId: string
  name: string
  color: string
  evolutions: EvolutionItem[]
  substantive: number
  noop: number
  params: AgentParamsInfo | null
  latest: EvolutionItem | null
}

/* ═══════════════════════════════════════════════════════════════════════
 * SVG CYCLE DIAGRAM
 * ═══════════════════════════════════════════════════════════════════════ */

function CycleDiagram() {
  const W = 320
  const H = 200
  const CX = W / 2
  const CY = H / 2 + 4
  const R = 62

  const steps = [
    { label: 'SLEEP', angle: -90, icon: '▾' },
    { label: 'REFLECT', angle: 0, icon: '◎' },
    { label: 'EVOLVE', angle: 90, icon: '△' },
    { label: 'PREDICT', angle: 180, icon: '◆' },
  ]

  const points = steps.map((s) => {
    const rad = (s.angle * Math.PI) / 180
    return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad), ...s }
  })

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: 'block', margin: '0 auto' }}>
      {/* Circle path */}
      <circle cx={CX} cy={CY} r={R} fill="none" stroke={palette.wood500} strokeWidth={2} strokeDasharray="6 4" />

      {/* Arrows between steps */}
      {points.map((p, i) => {
        const next = points[(i + 1) % points.length]
        const dx = next.x - p.x
        const dy = next.y - p.y
        const len = Math.sqrt(dx * dx + dy * dy)
        const nx = dx / len
        const ny = dy / len
        const mx = (p.x + next.x) / 2
        const my = (p.y + next.y) / 2
        return (
          <polygon
            key={i}
            points={`${mx},${my - 4} ${mx + 6 * nx},${my + 6 * ny - 4 * nx} ${mx - 6 * nx},${my - 6 * ny - 4 * nx}`}
            fill={accents.gold}
            transform={`rotate(${Math.atan2(dy, dx) * 180 / Math.PI}, ${mx}, ${my})`}
          />
        )
      })}

      {/* Step nodes */}
      {points.map((p, i) => (
        <g key={i}>
          <rect
            x={p.x - 28} y={p.y - 14} width={56} height={28}
            fill={palette.wood700} stroke={palette.wood500} strokeWidth={2}
          />
          <text
            x={p.x} y={p.y - 2}
            textAnchor="middle" dominantBaseline="middle"
            fill={accents.gold}
            fontFamily={fonts.header} fontSize={7}
          >
            {p.icon}
          </text>
          <text
            x={p.x} y={p.y + 10}
            textAnchor="middle" dominantBaseline="middle"
            fill={text.primary}
            fontFamily={fonts.header} fontSize={6}
          >
            {p.label}
          </text>
        </g>
      ))}

      {/* Center label */}
      <text
        x={CX} y={CY}
        textAnchor="middle" dominantBaseline="middle"
        fill={text.muted} fontFamily={fonts.body} fontSize={12}
      >
        self-learning loop
      </text>
    </svg>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
 * MAIN COMPONENT
 * ═══════════════════════════════════════════════════════════════════════ */

export function MemoryLab() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [agentData, setAgentData] = useState<AgentEvoData[]>([])
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)

  const trapRef = useFocusTrap<HTMLDivElement>({ onClose: () => setOpen(false), active: open })

  /* ── Open on board_left click ──────────────────────────────────── */
  useEffect(() => {
    const handler = ({ propId }: { propId: string }) => {
      if (propId === 'board_left') setOpen(true)
    }
    GameEventBus.on('prop:click', handler)
    return () => { GameEventBus.off('prop:click', handler) }
  }, [])

  /* ── Pause scene while open ────────────────────────────────────── */
  useEffect(() => {
    if (!open) return
    GameEventBus.emit('scene:pause', undefined)
    return () => { GameEventBus.emit('scene:resume', undefined) }
  }, [open])

  /* ── Fetch data ────────────────────────────────────────────────── */
  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    setError(null)

    async function load() {
      try {
        const results = await Promise.all(
          AGENT_IDS.map(async (agentId) => {
            const [evoRes, paramsRes] = await Promise.all([
              getAgentEvolution(agentId),
              getAgentParams(agentId),
            ])
            const evolutions = evoRes.items
            const substantive = evolutions.filter(
              (e) => e.evolutionType !== 'noop' && Object.keys(e.parameterDiff ?? {}).length > 0,
            )
            const noop = evolutions.length - substantive.length
            const sorted = [...substantive].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
            return {
              agentId,
              name: AGENT_NAMES[agentId] ?? agentId,
              color: agentColors[agentId] ?? accents.gold,
              evolutions: substantive,
              substantive: substantive.length,
              noop,
              params: paramsRes.params,
              latest: sorted[0] ?? null,
            } satisfies AgentEvoData
          }),
        )
        if (alive) setAgentData(results)
      } catch (err: any) {
        if (alive) setError(err.message ?? String(err))
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [open])

  const close = useCallback(() => { setOpen(false); setExpandedAgent(null) }, [])

  const totalEvolutions = useMemo(
    () => agentData.reduce((s, a) => s + a.substantive, 0),
    [agentData],
  )
  const totalSleeps = useMemo(
    () => agentData.reduce((s, a) => s + a.noop + a.substantive, 0),
    [agentData],
  )

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
        aria-labelledby={MODAL_TITLE_ID}
      >
        {/* Header */}
        <div style={S.header}>
          <h2 id={MODAL_TITLE_ID} style={S.title}>▾ MEMORY LAB</h2>
          <PixelButton size="small" onClick={close} aria-label="Close memory lab">✕</PixelButton>
        </div>

        {/* Content */}
        <div style={S.content}>
          {loading && <div style={S.status}>Loading evolution data…</div>}
          {error && <div style={{ ...S.status, color: accents.red }}>Error: {error}</div>}

          {!loading && !error && (
            <>
              {/* Cycle diagram */}
              <div style={S.section}>
                <h3 style={S.sectionTitle}>How agents learn</h3>
                <p style={S.description}>
                  Every agent runs an autonomous loop: after enough match outcomes accumulate,
                  they <strong>sleep</strong>, <strong>reflect</strong> on their prediction accuracy,
                  and <strong>evolve</strong> their parameters — adjusting confidence bias,
                  hedging level, and topic-specific calibration weights. All changes are
                  recorded permanently on Walrus via MemWal.
                </p>
                <CycleDiagram />
              </div>

              {/* Summary stats */}
              <div style={S.statsRow}>
                <div style={S.statCard}>
                  <div style={S.statValue}>{totalSleeps}</div>
                  <div style={S.statLabel}>Sleep cycles</div>
                </div>
                <div style={S.statCard}>
                  <div style={S.statValue}>{totalEvolutions}</div>
                  <div style={S.statLabel}>Evolutions</div>
                </div>
                <div style={S.statCard}>
                  <div style={S.statValue}>{AGENT_IDS.length}</div>
                  <div style={S.statLabel}>Agents</div>
                </div>
              </div>

              {/* Per-agent evolution list */}
              <div style={S.section}>
                <h3 style={S.sectionTitle}>Agent evolution history</h3>
                {agentData.map((a) => (
                  <div key={a.agentId} style={S.agentRow}>
                    <button
                      style={{
                        ...S.agentHeader,
                        borderLeft: `3px solid ${a.color}`,
                      }}
                      onClick={() => setExpandedAgent(
                        expandedAgent === a.agentId ? null : a.agentId,
                      )}
                      aria-expanded={expandedAgent === a.agentId}
                    >
                      <span style={S.agentName}>{a.name}</span>
                      <span style={S.agentMeta}>
                        {a.substantive} evolution{a.substantive !== 1 ? 's' : ''}
                        {' · '}
                        {a.noop} sleep{a.noop !== 1 ? 's' : ''}
                        {a.params ? ` · v${a.params.version}` : ''}
                      </span>
                      <span style={S.chevron}>{expandedAgent === a.agentId ? '▾' : '▸'}</span>
                    </button>

                    {expandedAgent === a.agentId && (
                      <div style={S.agentDetail}>
                        {/* Current params */}
                        {a.params && (
                          <div style={S.paramBlock}>
                            <div style={S.paramTitle}>Current parameters (v{a.params.version})</div>
                            <div style={S.paramGrid}>
                              <div style={S.paramItem}>
                                <span style={S.paramLabel}>Confidence bias</span>
                                <span style={S.paramValue}>
                                  {a.params.confidenceBias >= 0 ? '+' : ''}{a.params.confidenceBias.toFixed(3)}
                                </span>
                              </div>
                              <div style={S.paramItem}>
                                <span style={S.paramLabel}>Hedging level</span>
                                <span style={S.paramValue}>{a.params.hedgingLevel.toFixed(3)}</span>
                              </div>
                              {Object.entries(a.params.topicCalibration).map(([topic, val]) => (
                                <div key={topic} style={S.paramItem}>
                                  <span style={S.paramLabel}>{topic}</span>
                                  <span style={S.paramValue}>{(val as number).toFixed(3)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Evolution log */}
                        {a.evolutions.length === 0 && (
                          <div style={S.emptyNote}>No evolutions yet — agent is still in initial parameters.</div>
                        )}
                        {a.evolutions
                          .sort((x, y) => (x.createdAt < y.createdAt ? 1 : -1))
                          .slice(0, 5)
                          .map((ev, i) => (
                          <div key={i} style={S.evoEntry}>
                            <div style={S.evoTime}>
                              {new Date(ev.createdAt).toLocaleString(undefined, {
                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                              })}
                              {ev.fromVersion != null && ev.toVersion != null && (
                                <span style={S.evoVersion}> v{ev.fromVersion} → v{ev.toVersion}</span>
                              )}
                            </div>
                            <div style={S.evoSummary}>{ev.summary}</div>
                            {ev.parameterDiff && Object.keys(ev.parameterDiff).length > 0 && (
                              <div style={S.evoDiff}>
                                {Object.entries(ev.parameterDiff).map(([k, v]) => (
                                  <span key={k} style={{
                                    ...S.diffBadge,
                                    color: (v as number) > 0 ? accents.green : accents.red,
                                  }}>
                                    {k}: {(v as number) > 0 ? '+' : ''}{(v as number).toFixed(4)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
 * STYLES (token-only)
 * ═══════════════════════════════════════════════════════════════════════ */

const S: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: zIndex.modal,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: overlay,
  },
  panel: {
    position: 'relative',
    width: 'min(90vw, 720px)',
    maxHeight: '86vh',
    overflowY: 'auto',
    background: palette.wood900,
    border: borders.standard,
    boxShadow: shadows.hard,
    padding: spacing.md,
    color: text.primary,
    fontFamily: fonts.body,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottom: borders.standard,
  },
  title: {
    fontFamily: fonts.header,
    ...typo.hdr,
    color: accents.gold,
    margin: 0,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.md,
  },
  status: {
    fontFamily: fonts.body,
    ...typo.body,
    color: text.muted,
    textAlign: 'center',
    padding: spacing.xl,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.header,
    ...typo.hdrSm,
    color: accents.gold,
    margin: 0,
  },
  description: {
    fontFamily: fonts.body,
    ...typo.body,
    color: text.dim,
    margin: 0,
    lineHeight: '22px',
  },
  statsRow: {
    display: 'flex',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    padding: spacing.sm,
    background: palette.wood700,
    border: borders.standard,
    textAlign: 'center',
  },
  statValue: {
    fontFamily: fonts.header,
    ...typo.hdrLg,
    color: accents.gold,
  },
  statLabel: {
    fontFamily: fonts.body,
    ...typo.dataSm,
    color: text.muted,
    marginTop: 4,
  },
  agentRow: {
    borderBottom: borders.rule,
  },
  agentHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
    padding: `${spacing.sm}px ${spacing.sm}px`,
    background: 'transparent',
    border: 'none',
    borderLeft: `3px solid ${accents.gold}`,
    cursor: 'pointer',
    color: text.primary,
    fontFamily: fonts.body,
    ...typo.body,
    textAlign: 'left',
  },
  agentName: {
    fontFamily: fonts.header,
    ...typo.hdrXs,
    color: text.primary,
    minWidth: 100,
  },
  agentMeta: {
    flex: 1,
    fontFamily: fonts.body,
    ...typo.dataSm,
    color: text.muted,
  },
  chevron: {
    fontFamily: fonts.body,
    ...typo.body,
    color: text.muted,
  },
  agentDetail: {
    padding: `${spacing.sm}px ${spacing.md}px`,
    background: palette.surface,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
  },
  paramBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  paramTitle: {
    fontFamily: fonts.header,
    ...typo.hdrXs,
    color: text.muted,
    marginBottom: 4,
  },
  paramGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  paramItem: {
    display: 'flex',
    flexDirection: 'column',
    padding: `4px ${spacing.sm}px`,
    background: palette.wood700,
    border: borders.rule,
    minWidth: 100,
  },
  paramLabel: {
    fontFamily: fonts.body,
    ...typo.caption,
    color: text.faint,
  },
  paramValue: {
    fontFamily: fonts.body,
    ...typo.data,
    color: text.primary,
  },
  emptyNote: {
    fontFamily: fonts.body,
    ...typo.dataSm,
    color: text.faint,
    fontStyle: 'italic',
  },
  evoEntry: {
    padding: `${spacing.xs}px 0`,
    borderTop: borders.rule,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  evoTime: {
    fontFamily: fonts.body,
    ...typo.caption,
    color: text.faint,
  },
  evoVersion: {
    color: text.muted,
  },
  evoSummary: {
    fontFamily: fonts.body,
    ...typo.dataSm,
    color: text.dim,
  },
  evoDiff: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  diffBadge: {
    fontFamily: fonts.body,
    ...typo.caption,
    padding: '1px 4px',
    background: palette.wood700,
    border: borders.rule,
  },
}
