/**
 * LiteDashboard.tsx | v2.0.0 | 2026-06-19
 * P0 UI polish: agent pixel icons, better visual hierarchy, SNES-styled cards,
 * responsive grid, hackathon branding bar, section headers with accent borders.
 * Mobile-first, no animations. Reads from zustand stores + public API.
 */

import React, { useEffect, useState, useMemo } from 'react'
import { useGameStore } from '@/store/gameStore'
import type { WorldAgentState } from '@moneyball/shared/events'
import { getAgentPredictions, getMatches, getAgentParams } from '@/lib/api'
import { StatsReport } from '@/components/StatsReport'
import { RankMedal } from '@/components/ui'
import { PixelIcon } from '@/components/icons/PixelIcon'
import { palette, accents, text, fonts, borders, shadows, type as typo, agentColors, spacing } from '@/styles/tokens'
import { formatKickoff } from '@/lib/formatDate'

/* ── Types ──────────────────────────────────────────────────────────────── */

interface PredictionSummary {
  total: number
  correct: number
  latest: { matchId: string; pick: string; confidence: number } | null
}

interface MatchInfo {
  id: string
  homeTeam: string
  awayTeam: string
  kickoffUtc: string
  status: string
  result: { homeScore: number; awayScore: number; outcome: string } | null
}

interface ParamsSummary {
  version: number
  confidenceBias: number
  hedgingLevel: number
}

/* ── Subcomponents ──────────────────────────────────────────────────────── */

function AgentCard({
  agent,
  predictions,
  params,
  onSelect,
}: {
  agent: WorldAgentState
  predictions: PredictionSummary
  params: ParamsSummary | null
  onSelect: () => void
}) {
  const accuracy =
    predictions.total > 0
      ? Math.round((predictions.correct / predictions.total) * 100)
      : null
  const color = agentColors[agent.agentId] ?? accents.gold

  return (
    <button
      onClick={onSelect}
      style={styles.card}
      aria-label={`View details for ${agent.name}`}
    >
      {/* Top accent bar in agent color */}
      <div style={{ height: 3, background: color, marginBottom: spacing.sm }} />

      <div style={styles.cardHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PixelIcon name={agent.agentId} size={16} color={color} />
          <span style={{ ...styles.agentName, color }}>{agent.name}</span>
        </div>
        <span
          style={{
            ...styles.statusBadge,
            background:
              agent.status === 'idle'
                ? palette.wood700
                : agent.status === 'thinking'
                  ? accents.gold
                  : accents.green,
            color:
              agent.status === 'thinking' || agent.status !== 'idle'
                ? palette.wood900
                : palette.paper,
          }}
        >
          {agent.status}
        </span>
      </div>
      <div style={styles.cardRole}>{agent.role}</div>

      {/* Stats row */}
      <div style={styles.statsRow}>
        <div style={styles.statBlock}>
          <span style={styles.statValue}>{predictions.total}</span>
          <span style={styles.statLabel}>calls</span>
        </div>
        <div style={styles.statBlock}>
          <span style={{ ...styles.statValue, color: accuracy != null && accuracy > 50 ? accents.green : text.primary }}>
            {accuracy != null ? `${accuracy}%` : '—'}
          </span>
          <span style={styles.statLabel}>accuracy</span>
        </div>
        <div style={styles.statBlock}>
          <span style={styles.statValue}>
            {predictions.latest ? `${Math.round(predictions.latest.confidence * 100)}%` : '—'}
          </span>
          <span style={styles.statLabel}>conf.</span>
        </div>
        {params && (
          <div style={styles.statBlock}>
            <span style={styles.statValue}>v{params.version}</span>
            <span style={styles.statLabel}>ver.</span>
          </div>
        )}
      </div>

      {/* Latest prediction */}
      {predictions.latest && (
        <div style={styles.cardPrediction}>
          <span style={styles.label}>Latest call:</span>{' '}
          <span style={{ ...styles.pick, color }}>{predictions.latest.pick}</span>
        </div>
      )}
    </button>
  )
}

function MatchCard({ match }: { match: MatchInfo }) {
  const time = formatKickoff(match.kickoffUtc)
  const isLive = match.status === 'live'

  return (
    <div style={{ ...styles.matchCard, borderLeftColor: isLive ? accents.red : palette.wood700 }}>
      <div style={styles.matchTeams}>
        <span style={styles.matchTeamName}>{match.homeTeam}</span>
        {match.result ? (
          <span style={styles.matchScore}>
            {match.result.homeScore} – {match.result.awayScore}
          </span>
        ) : (
          <span style={styles.matchVs}>vs</span>
        )}
        <span style={styles.matchTeamName}>{match.awayTeam}</span>
      </div>
      <div style={styles.matchTime}>
        {isLive ? (
          <span style={styles.liveTag}>
            <PixelIcon name="live_dot" size={8} color={accents.red} />
            LIVE
          </span>
        ) : (
          time
        )}
      </div>
    </div>
  )
}

function SectionHeader({ title, icon }: { title: string; icon?: string }) {
  return (
    <div style={styles.sectionHeader}>
      {icon && <PixelIcon name={icon} size={12} color={accents.gold} />}
      <h2 style={styles.sectionTitle}>{title}</h2>
      <div style={styles.sectionRule} />
    </div>
  )
}

function Leaderboard({
  agents,
  predictions,
}: {
  agents: WorldAgentState[]
  predictions: Record<string, PredictionSummary>
}) {
  const sorted = useMemo(() => {
    return [...agents]
      .map((a) => ({
        ...a,
        correct: predictions[a.agentId]?.correct ?? 0,
        total: predictions[a.agentId]?.total ?? 0,
      }))
      .sort((a, b) => b.correct - a.correct || a.total - b.total)
  }, [agents, predictions])

  return (
    <div style={styles.section}>
      <SectionHeader title="LEADERBOARD" icon="sort_up" />
      <div style={styles.leaderboard}>
        {sorted.map((a, i) => {
          const color = agentColors[a.agentId] ?? accents.gold
          return (
            <div
              key={a.agentId}
              style={{
                ...styles.leaderRow,
                background: i % 2 === 0 ? palette.paperBright : palette.paper,
                borderTop: i === 0 ? 'none' : borders.rule,
              }}
            >
              <RankMedal rank={i + 1} />
              <PixelIcon name={a.agentId} size={12} color={color} />
              <span style={styles.leaderName}>{a.name}</span>
              <span style={styles.leaderScore}>
                {a.correct}/{a.total}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Main Dashboard ─────────────────────────────────────────────────────── */

export function LiteDashboard() {
  const agentsMap = useGameStore((s) => s.agents)
  const isConnected = useGameStore((s) => s.ui.isConnected)
  const selectAgent = useGameStore((s) => s.selectAgent)

  const agents = useMemo(
    () => Object.values(agentsMap),
    [agentsMap],
  )

  const [predictions, setPredictions] = useState<
    Record<string, PredictionSummary>
  >({})
  const [params, setParams] = useState<Record<string, ParamsSummary>>({})
  const [matches, setMatches] = useState<{
    live: MatchInfo[]
    upcoming: MatchInfo[]
    recent: MatchInfo[]
  }>({ live: [], upcoming: [], recent: [] })

  useEffect(() => {
    let cancelled = false

    async function load() {
      const agentIds = [
        'dr_morgan',
        'scout_alvarez',
        'viktor_kane',
        'sofia_mendes',
        'madame_pythia',
      ]

      const predMap: Record<string, PredictionSummary> = {}
      const paramMap: Record<string, ParamsSummary> = {}

      await Promise.all(
        agentIds.map(async (id) => {
          try {
            const predRes = await getAgentPredictions(id)
            const items = predRes.items ?? []
            const resolved = items.filter(
              (p: { outcome?: { correct: boolean } | null }) => p.outcome != null,
            )
            const correct = resolved.filter(
              (p: { outcome?: { correct: boolean } | null }) => p.outcome?.correct === true,
            ).length
            const latest = items[0] ?? null
            predMap[id] = {
              total: resolved.length,
              correct,
              latest: latest
                ? {
                    matchId: latest.matchId,
                    pick: latest.pick,
                    confidence: latest.confidence,
                  }
                : null,
            }
          } catch {
            predMap[id] = { total: 0, correct: 0, latest: null }
          }

          try {
            const paramRes = await getAgentParams(id)
            const p = paramRes.params
            if (p) {
              paramMap[id] = {
                version: p.version,
                confidenceBias: p.confidenceBias,
                hedgingLevel: p.hedgingLevel,
              }
            }
          } catch {
            // params not critical
          }
        }),
      )

      if (!cancelled) {
        setPredictions(predMap)
        setParams(paramMap)
      }
    }

    void load()
    const interval = setInterval(() => void load(), 30_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadMatches() {
      try {
        const res = await getMatches()
        if (!cancelled) {
          setMatches({
            live: res.live ?? [],
            upcoming: res.upcoming ?? [],
            recent: res.recent ?? [],
          })
        }
      } catch {
        // non-critical
      }
    }

    void loadMatches()
    const interval = setInterval(() => void loadMatches(), 30_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const displayMatches = [
    ...matches.live,
    ...matches.upcoming.slice(0, 3),
  ]

  return (
    <div style={styles.root}>
      {/* Branding header */}
      <div style={styles.header}>
        <div style={styles.titleRow}>
          <PixelIcon name="hackathon" size={16} color={accents.gold} />
          <h1 style={styles.title}>MONEYBALL CABINET</h1>
          <span
            style={{
              ...styles.connectionDot,
              background: isConnected ? accents.green : accents.red,
            }}
            aria-label={isConnected ? 'Connected' : 'Disconnected'}
          />
        </div>
        <p style={styles.subtitle}>
          5 AI Agents × FIFA World Cup 2026 × Walrus Memory
        </p>
      </div>

      {/* Matches */}
      {displayMatches.length > 0 && (
        <div style={styles.section}>
          <SectionHeader title="MATCHES" icon="play" />
          {displayMatches.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      )}

      {/* Agents */}
      <div style={styles.section}>
        <SectionHeader title="AGENTS" icon="predict" />
        <div style={styles.agentsGrid}>
          {agents.map((agent) => (
            <AgentCard
              key={agent.agentId}
              agent={agent}
              predictions={
                predictions[agent.agentId] ?? {
                  total: 0,
                  correct: 0,
                  latest: null,
                }
              }
              params={params[agent.agentId] ?? null}
              onSelect={() => selectAgent(agent.agentId)}
            />
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      {agents.length > 0 && (
        <Leaderboard agents={agents} predictions={predictions} />
      )}

      {/* Detailed predictions + Brier chart */}
      <div style={styles.section}>
        <SectionHeader title="SCOUTING REPORT" icon="radar" />
        <StatsReport />
      </div>

      {/* Recent results */}
      {matches.recent.length > 0 && (
        <div style={styles.section}>
          <SectionHeader title="RECENT RESULTS" icon="correct" />
          {matches.recent.slice(0, 5).map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={styles.footer}>
        <PixelIcon name="walrus" size={12} color={text.faint} />
        <span>Walrus Memory World Cup Hackathon 2026</span>
      </div>
    </div>
  )
}

/* ── Styles (inline, mobile-first) ──────────────────────────────────────── */

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: 'absolute',
    inset: 0,
    overflow: 'auto',
    background: palette.surface,
    color: palette.paper,
    fontFamily: fonts.body,
    padding: spacing.md,
    paddingBottom: 80,
  },

  /* ── Header ─────────────────────────────────────────────── */
  header: {
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottom: `2px solid ${accents.gold}`,
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typo.hdrLg,
    fontWeight: 700,
    margin: 0,
    color: accents.gold,
    fontFamily: fonts.header,
    letterSpacing: '-0.5px',
    flex: 1,
  },
  subtitle: {
    ...typo.dataSm,
    color: text.muted,
    fontFamily: fonts.body,
    margin: `${spacing.xs}px 0 0`,
  },
  connectionDot: {
    width: 10,
    height: 10,
    borderRadius: 0,
    flexShrink: 0,
  },

  /* ── Sections ───────────────────────────────────────────── */
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typo.hdrSm,
    fontWeight: 600,
    color: text.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    fontFamily: fonts.header,
    margin: 0,
    whiteSpace: 'nowrap',
  },
  sectionRule: {
    flex: 1,
    height: 1,
    background: palette.wood700,
    marginLeft: spacing.sm,
  },

  /* ── Agent cards ────────────────────────────────────────── */
  agentsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: spacing.sm,
  },
  card: {
    display: 'block',
    width: '100%',
    textAlign: 'left' as const,
    background: palette.wood900,
    border: borders.standard,
    borderRadius: 0,
    padding: 0,
    paddingBottom: spacing.sm,
    cursor: 'pointer',
    color: palette.paper,
    fontFamily: fonts.body,
    boxShadow: shadows.hardSmall,
    overflow: 'hidden',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `0 ${spacing.sm}px`,
    marginBottom: 2,
  },
  agentName: {
    fontWeight: 700,
    fontFamily: fonts.header,
    ...typo.hdrXs,
  },
  statusBadge: {
    ...typo.hdrXs,
    padding: '2px 6px',
    borderRadius: 0,
    color: palette.paper,
    textTransform: 'uppercase' as const,
    fontFamily: fonts.header,
    letterSpacing: '-0.5px',
    fontSize: 8,
  },
  cardRole: {
    ...typo.caption,
    color: text.muted,
    padding: `0 ${spacing.sm}px`,
    marginBottom: spacing.xs,
  },

  /* Stats row */
  statsRow: {
    display: 'flex',
    gap: 1,
    padding: `0 ${spacing.sm}px`,
    marginBottom: spacing.xs,
  },
  statBlock: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: palette.surface,
    padding: '4px 2px',
  },
  statValue: {
    fontFamily: fonts.body,
    ...typo.data,
    fontWeight: 700,
    color: text.primary,
  },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: text.faint,
    textTransform: 'uppercase' as const,
  },

  cardPrediction: {
    padding: `0 ${spacing.sm}px`,
    ...typo.dataSm,
  },
  label: {
    color: text.faint,
    ...typo.caption,
  },
  pick: {
    fontWeight: 700,
    fontFamily: fonts.body,
    ...typo.data,
  },

  /* ── Match cards ────────────────────────────────────────── */
  matchCard: {
    background: palette.wood900,
    border: borders.standard,
    borderLeft: `3px solid ${palette.wood700}`,
    borderRadius: 0,
    padding: `${spacing.sm}px ${spacing.sm + 4}px`,
    marginBottom: spacing.xs,
    boxShadow: shadows.hardSmall,
  },
  matchTeams: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...typo.data,
  },
  matchTeamName: {
    fontWeight: 700,
    flex: 1,
  },
  matchVs: {
    color: text.faint,
    ...typo.caption,
    padding: `0 ${spacing.sm}px`,
  },
  matchScore: {
    color: accents.gold,
    fontWeight: 700,
    ...typo.bodyLg,
    padding: `0 ${spacing.sm}px`,
  },
  matchTime: {
    ...typo.caption,
    color: text.faint,
    marginTop: 2,
  },
  liveTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    color: accents.red,
    fontFamily: fonts.header,
    ...typo.hdrXs,
    letterSpacing: '-0.5px',
  },

  /* ── Leaderboard ────────────────────────────────────────── */
  leaderboard: {
    background: palette.paper,
    border: borders.standard,
    borderRadius: 0,
    overflow: 'hidden',
    boxShadow: shadows.hardSmall,
  },
  leaderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: `${spacing.sm}px ${spacing.sm + 4}px`,
    ...typo.body,
    color: palette.wood900,
  },
  leaderName: {
    flex: 1,
    fontWeight: 700,
    color: palette.wood900,
  },
  leaderScore: {
    fontWeight: 700,
    color: palette.wood700,
  },

  /* ── Footer ─────────────────────────────────────────────── */
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingTop: spacing.lg,
    ...typo.caption,
    color: text.faint,
    fontFamily: fonts.body,
  },
}
